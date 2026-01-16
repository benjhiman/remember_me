import { Injectable, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';
import { IntegrationProvider, WebhookEventStatus, IntegrationJobType, MessageDirection } from '@remember-me/prisma';
import { InboxService } from '../inbox/inbox.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class InstagramWebhookService {
  private readonly logger = new Logger(InstagramWebhookService.name);
  private readonly verifyToken = process.env.INSTAGRAM_VERIFY_TOKEN;

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationQueueService: IntegrationQueueService,
    private readonly inboxService: InboxService,
    private readonly configService: ConfigService,
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
   * Resolve organizationId from webhook payload
   * Priority:
   * 1. ConnectedAccount lookup by pageId/externalAccountId
   * 2. X-Organization-Id header (dev mode only)
   * 3. First organization (dev mode only)
   */
  private async resolveOrganizationId(
    pageId?: string,
    headerOrganizationId?: string,
  ): Promise<string | undefined> {
    // Try ConnectedAccount lookup first
    if (pageId) {
      const connectedAccount = await this.prisma.connectedAccount.findFirst({
        where: {
          provider: IntegrationProvider.INSTAGRAM,
          externalAccountId: pageId,
          status: 'CONNECTED',
        },
      });

      if (connectedAccount) {
        return connectedAccount.organizationId;
      }
    }

    // Dev mode: allow header override
    const isDev = this.configService.get('NODE_ENV') !== 'production';
    if (isDev && headerOrganizationId) {
      // Verify organization exists
      const org = await this.prisma.organization.findUnique({
        where: { id: headerOrganizationId },
      });
      if (org) {
        return headerOrganizationId;
      }
    }

    // Dev mode: fallback to first organization (for testing)
    if (isDev) {
      const firstOrg = await this.prisma.organization.findFirst({
        orderBy: { createdAt: 'asc' },
      });
      if (firstOrg) {
        this.logger.warn(
          `Using fallback organization ${firstOrg.id} for Instagram webhook (dev mode)`,
        );
        return firstOrg.id;
      }
    }

    return undefined;
  }

  /**
   * Process incoming webhook (POST request from Meta)
   */
  async processWebhook(payload: any, organizationId?: string): Promise<void> {
    // Validate payload structure
    if (!payload.object || payload.object !== 'instagram') {
      throw new BadRequestException('Invalid webhook payload: object must be "instagram"');
    }

    if (!payload.entry || !Array.isArray(payload.entry) || payload.entry.length === 0) {
      throw new BadRequestException('Invalid entry array');
    }

    // Process each entry
    for (const entry of payload.entry) {
      const pageId = entry.id;

      // Resolve organizationId
      const resolvedOrgId = await this.resolveOrganizationId(pageId, organizationId);
      if (!resolvedOrgId) {
        this.logger.warn(
          `Could not resolve organizationId for Instagram webhook with pageId: ${pageId}`,
        );
        continue;
      }

      // Process messaging events
      if (entry.messaging && Array.isArray(entry.messaging)) {
        for (const messagingEvent of entry.messaging) {
          await this.processMessagingEvent(messagingEvent, resolvedOrgId, pageId);
        }
      }
    }
  }

  /**
   * Process a messaging event (message received)
   */
  private async processMessagingEvent(
    messagingEvent: any,
    organizationId: string,
    pageId: string,
  ): Promise<void> {
    const sender = messagingEvent.sender;
    const recipient = messagingEvent.recipient;
    const message = messagingEvent.message;
    const timestamp = messagingEvent.timestamp;

    if (!sender || !sender.id) {
      this.logger.warn('Messaging event missing sender.id');
      return;
    }

    if (!message) {
      // Not a message event (could be delivery receipt, read receipt, etc.)
      return;
    }

    const messageId = message.mid;
    const text = message.text || '';
    const messageType = message.type || 'text';

    // Only process text messages for MVP
    if (messageType !== 'text' || !text) {
      this.logger.debug(`Skipping non-text message type: ${messageType}`);
      return;
    }

    // Check for duplicate message (idempotency)
    const existingMessage = await this.prisma.messageLog.findFirst({
      where: {
        provider: IntegrationProvider.INSTAGRAM,
        metaJson: {
          path: ['messageId'],
          equals: messageId,
        },
      },
    });

    if (existingMessage) {
      // Duplicate message, skip
      this.logger.debug(`Duplicate Instagram message ${messageId}, skipping`);
      return;
    }

    // Save webhook event
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider: IntegrationProvider.INSTAGRAM,
        eventType: 'message',
        payloadJson: {
          messageId,
          senderId: sender.id,
          recipientId: recipient?.id,
          timestamp,
          text,
          type: messageType,
        },
        status: WebhookEventStatus.PENDING,
      },
    });

    // Get Instagram username if available (from sender.id, we might need to fetch it)
    // For MVP, we'll use sender.id as handle
    const handle = sender.id; // TODO: Fetch username from Graph API if needed

    // Sync conversation (upsert)
    const conversationId = await this.inboxService.syncConversationFromMessage(
      organizationId,
      IntegrationProvider.INSTAGRAM,
      MessageDirection.INBOUND,
      null, // phone (not applicable for Instagram)
      handle, // handle (Instagram username/ID)
      null, // leadId (will be linked if found)
      timestamp ? new Date(parseInt(timestamp) * 1000) : new Date(),
    );

    // Save message log (INBOUND)
    await this.prisma.messageLog.create({
      data: {
        provider: IntegrationProvider.INSTAGRAM,
        direction: MessageDirection.INBOUND,
        to: recipient?.id || pageId,
        from: handle,
        text,
        conversationId,
        externalMessageId: messageId,
        metaJson: {
          messageId,
          senderId: sender.id,
          recipientId: recipient?.id,
          timestamp,
          type: messageType,
          threadId: messagingEvent.thread_id || null,
          organizationId,
        },
      },
    });

    // Create integration job to process webhook (create/update Lead)
    await this.integrationQueueService.enqueue({
      jobType: IntegrationJobType.PROCESS_WEBHOOK,
      provider: IntegrationProvider.INSTAGRAM,
      payload: {
        webhookEventId: webhookEvent.id,
        eventType: 'message',
        messageId,
        from: handle,
        senderId: sender.id,
        text,
        timestamp,
        organizationId,
      },
      organizationId: organizationId,
      dedupeKey: messageId, // Use messageId for deduplication
    });
  }
}
