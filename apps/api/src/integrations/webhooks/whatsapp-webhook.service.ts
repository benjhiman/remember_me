import { Injectable, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';
import { IntegrationProvider, WebhookEventStatus, IntegrationJobType, MessageStatus, MessageDirection } from '@remember-me/prisma';
import { InboxService } from '../inbox/inbox.service';
import { MetricsService } from '../../common/metrics/metrics.service';

@Injectable()
export class WhatsAppWebhookService {
  private readonly verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  private readonly appSecret = process.env.WHATSAPP_APP_SECRET;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationQueueService: IntegrationQueueService,
    private readonly inboxService: InboxService,
    private readonly metricsService?: MetricsService, // Optional to avoid circular dependency
  ) {}

  /**
   * Verify webhook challenge (GET request from Meta)
   */
  verifyWebhook(mode: string, token: string, challenge: string): string {
    if (mode !== 'subscribe') {
      throw new BadRequestException('Invalid hub.mode');
    }

    if (!this.verifyToken || token !== this.verifyToken) {
      throw new ForbiddenException('Invalid verify token');
    }

    return challenge;
  }

  /**
   * Process incoming webhook (POST request from Meta)
   */
  async processWebhook(payload: any, organizationId?: string): Promise<void> {
    const startTime = Date.now();
    let status = 'success';

    try {
      // Validate payload structure
      if (!payload.object || payload.object !== 'whatsapp_business_account') {
        status = 'invalid_payload';
        throw new BadRequestException('Invalid webhook payload');
      }

    if (!payload.entry || !Array.isArray(payload.entry) || payload.entry.length === 0) {
      throw new BadRequestException('Invalid entry array');
    }

    // Process each entry
    for (const entry of payload.entry) {
      if (!entry.changes || !Array.isArray(entry.changes)) {
        continue;
      }

      for (const change of entry.changes) {
        const value = change.value;

        // Process status events (sent, delivered, read, failed)
        if (change.field === 'statuses' && value?.statuses && Array.isArray(value.statuses)) {
          for (const status of value.statuses) {
            await this.processStatusEvent(status);
          }
          continue;
        }

        // Process message events
        if (change.field !== 'messages') {
          continue;
        }

        if (!value || !value.messages || !Array.isArray(value.messages)) {
          continue;
        }

        // Process each message
        for (const message of value.messages) {
          // Extract message data
          const messageId = message.id;
          const from = message.from;
          const timestamp = message.timestamp;
          const text = message.text?.body || '';
          const type = message.type;

          // Only process text messages for MVP
          if (type !== 'text') {
            continue;
          }

          // Check for duplicate message (idempotency)
          const existingMessage = await this.prisma.messageLog.findFirst({
            where: {
              provider: IntegrationProvider.WHATSAPP,
              metaJson: {
                path: ['messageId'],
                equals: messageId,
              },
            },
          });

          if (existingMessage) {
            // Duplicate message, skip
            continue;
          }

          // Save webhook event
          const webhookEvent = await this.prisma.webhookEvent.create({
            data: {
              provider: IntegrationProvider.WHATSAPP,
              eventType: 'message',
              payloadJson: {
                messageId,
                from,
                timestamp,
                text,
                type,
              },
              status: WebhookEventStatus.PENDING,
            },
          });

          // Save message log (INBOUND)
          await this.prisma.messageLog.create({
            data: {
              provider: IntegrationProvider.WHATSAPP,
              direction: 'INBOUND',
              to: value.metadata?.phone_number_id || 'unknown',
              from,
              text,
              metaJson: {
                messageId,
                timestamp,
                type,
              },
            },
          });

          // Create integration job to process webhook (create/update Lead)
          await this.integrationQueueService.enqueue({
            jobType: IntegrationJobType.PROCESS_WEBHOOK,
            provider: IntegrationProvider.WHATSAPP,
            payload: {
              webhookEventId: webhookEvent.id,
              eventType: 'message',
              messageId,
              from,
              text,
              timestamp,
              organizationId,
            },
            organizationId: organizationId, // organizationId (optional, can be extracted from payload or header)
            dedupeKey: messageId, // Use messageId for deduplication
          });
        }
      }
    }

    // Record webhook metrics
    if (this.metricsService) {
      const durationMs = Date.now() - startTime;
      this.metricsService.recordWebhookEvent(IntegrationProvider.WHATSAPP, status, durationMs);
    }
  } catch (error) {
    status = 'error';
    const durationMs = Date.now() - startTime;
    if (this.metricsService) {
      this.metricsService.recordWebhookEvent(IntegrationProvider.WHATSAPP, status, durationMs);
    }
    throw error;
  }
  }

  /**
   * Process status event (sent, delivered, read, failed)
   */
  private async processStatusEvent(status: any): Promise<void> {
    const messageId = status.id; // WhatsApp message ID
    const statusType = status.status; // sent, delivered, read, failed
    const timestamp = status.timestamp;

    if (!messageId) {
      return;
    }

    // Find MessageLog by externalMessageId
    const messageLog = await this.prisma.messageLog.findUnique({
      where: {
        externalMessageId: messageId,
      },
    });

    if (!messageLog) {
      // Status for unknown message, log but don't fail
      return;
    }

    // Map WhatsApp status to our MessageStatus enum
    let newStatus: MessageStatus;
    let errorCode: string | null = null;
    let errorMessage: string | null = null;

    switch (statusType) {
      case 'sent':
        newStatus = MessageStatus.SENT;
        break;
      case 'delivered':
        newStatus = MessageStatus.DELIVERED;
        break;
      case 'read':
        newStatus = MessageStatus.READ;
        break;
      case 'failed':
        newStatus = MessageStatus.FAILED;
        errorCode = status.errors?.[0]?.code ? String(status.errors[0].code) : null;
        errorMessage = status.errors?.[0]?.title || null;
        break;
      default:
        // Unknown status, skip
        return;
    }

    // Only update if status is newer (idempotency: don't downgrade status)
    const statusOrder = {
      [MessageStatus.QUEUED]: 0,
      [MessageStatus.SENT]: 1,
      [MessageStatus.DELIVERED]: 2,
      [MessageStatus.READ]: 3,
      [MessageStatus.FAILED]: -1, // Failed can happen at any point
    };

    const currentOrder = messageLog.status ? statusOrder[messageLog.status] : -1;
    const newOrder = statusOrder[newStatus];

    // Update if new status is higher (or if failed, always update)
    if (newStatus === MessageStatus.FAILED || newOrder > currentOrder) {
      const oldStatus = messageLog.status || MessageStatus.QUEUED;
      await this.prisma.messageLog.update({
        where: { id: messageLog.id },
        data: {
          status: newStatus,
          statusUpdatedAt: timestamp ? new Date(parseInt(timestamp) * 1000) : new Date(),
          errorCode,
          errorMessage,
        },
      });

      // Record status transition metric
      if (this.metricsService) {
        this.metricsService.recordMessageStatusTransition(
          messageLog.provider,
          oldStatus,
          newStatus,
        );
      }
    }
  }
}
