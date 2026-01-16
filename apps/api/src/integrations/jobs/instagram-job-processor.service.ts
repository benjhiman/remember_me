import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationJobsService } from './integration-jobs.service';
import { InboxService } from '../inbox/inbox.service';
import { MetricsService } from '../../common/metrics/metrics.service';
import { ExternalHttpClientService } from '../../common/http/external-http-client.service';
import {
  IntegrationJobType,
  IntegrationProvider,
  IntegrationJobStatus,
  MessageDirection,
  LeadStatus,
  MessageStatus,
} from '@remember-me/prisma';

@Injectable()
export class InstagramJobProcessorService {
  private readonly logger = new Logger(InstagramJobProcessorService.name);
  private readonly accessToken = process.env.META_PAGE_ACCESS_TOKEN;
  private readonly pageId = process.env.INSTAGRAM_PAGE_ID || process.env.INSTAGRAM_USER_ID;
  private readonly apiVersion = 'v18.0';
  private readonly apiBaseUrl = 'https://graph.facebook.com';

  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationJobsService: IntegrationJobsService,
    private readonly inboxService: InboxService,
    private readonly metricsService?: MetricsService, // Optional to avoid circular dependency
    private readonly externalHttpClient?: ExternalHttpClientService, // Optional for mocking
  ) {}

  /**
   * Process a job from BullMQ queue
   */
  async processJobFromQueue(
    jobId: string,
    jobType: IntegrationJobType,
    payload: any,
    organizationId: string,
  ): Promise<void> {
    // Create a mock job object for compatibility
    const mockJob = {
      id: jobId,
      provider: IntegrationProvider.INSTAGRAM,
      jobType,
      payloadJson: payload,
      organizationId,
      runAt: new Date(),
    };

    await this.processJob(mockJob);
  }

  /**
   * Process a single job (internal)
   */
  private async processJob(job: any): Promise<void> {
    if (job.jobType === IntegrationJobType.PROCESS_WEBHOOK) {
      await this.processWebhookJob(job);
    } else if (job.jobType === IntegrationJobType.SEND_MESSAGE) {
      await this.processSendMessageJob(job);
    }
  }

  /**
   * Process pending Instagram jobs (job runner - DB mode)
   */
  async processPendingJobs(limit: number = 10): Promise<void> {
    const jobs = await this.integrationJobsService.fetchNext(limit);

    for (const job of jobs) {
      if (job.provider !== IntegrationProvider.INSTAGRAM) {
        continue;
      }

      try {
        await this.integrationJobsService.markProcessing(job.id);

        if (job.jobType === IntegrationJobType.PROCESS_WEBHOOK) {
          await this.processWebhookJob(job);
        } else if (job.jobType === IntegrationJobType.SEND_MESSAGE) {
          await this.processSendMessageJob(job);
        }

        await this.integrationJobsService.markDone(job.id);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Instagram job ${job.id} failed: ${errorMessage}`, errorStack);
        await this.integrationJobsService.markFailed(job.id, errorMessage);
      }
    }
  }

  /**
   * Process PROCESS_WEBHOOK job: create/update Lead and add Note
   */
  private async processWebhookJob(job: any): Promise<void> {
    const { messageId, from, senderId, text, timestamp, organizationId } = job.payloadJson;

    if (!organizationId) {
      throw new Error('Organization ID is required for PROCESS_WEBHOOK job');
    }

    // Find or create Lead by Instagram handle/ID
    // Try to find by handle first (if we have it), then by a custom field
    // For MVP, we'll use a simple approach: try to find by any matching identifier
    let lead = await this.prisma.lead.findFirst({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          // Try to match by Instagram handle if stored in a custom field
          // For MVP, we'll just try to find by name or create new
        ],
      },
      include: {
        pipeline: {
          include: {
            stages: {
              orderBy: { order: 'asc' },
              take: 1,
            },
          },
        },
      },
    });

    // For MVP: create a new lead if not found
    // In future, we can add Instagram handle/ID to Lead model or use custom fields
    if (!lead) {
      // Get first admin/owner user for organization (to use as creator)
      const membership = await this.prisma.membership.findFirst({
        where: {
          organizationId,
          role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!membership) {
        this.logger.warn(`No admin user found for organization ${organizationId}, skipping lead creation`);
        return;
      }

      // Get default pipeline for organization
      const pipeline = await this.prisma.pipeline.findFirst({
        where: {
          organizationId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });

      if (!pipeline) {
        this.logger.warn(`No pipeline found for organization ${organizationId}, skipping lead creation`);
        return;
      }

      const firstStage = await this.prisma.stage.findFirst({
        where: {
          pipelineId: pipeline.id,
          deletedAt: null,
        },
        orderBy: { order: 'asc' },
      });

      if (!firstStage) {
        this.logger.warn(`No stage found for pipeline ${pipeline.id}, skipping lead creation`);
        return;
      }

      // Create new lead
      lead = await this.prisma.lead.create({
        data: {
          organizationId,
          name: from || `Instagram User ${senderId?.substring(0, 8)}`,
          status: LeadStatus.ACTIVE,
          pipelineId: pipeline.id,
          stageId: firstStage.id,
          createdById: membership.userId,
          // Store Instagram ID in a custom field or metadata if available
        },
        include: {
          pipeline: {
            include: {
              stages: {
                orderBy: { order: 'asc' },
                take: 1,
              },
            },
          },
        },
      });
    }

    // Lead is already ACTIVE, no need to change status

    // Create Note on Lead
    const userId = lead.createdById || (await this.getFirstAdminUserId(organizationId));
    if (userId) {
      await this.prisma.note.create({
        data: {
          organizationId,
          leadId: lead.id,
          userId,
          content: `Inbound Instagram message: ${text}`,
          isPrivate: false,
        },
      });
    }

    this.logger.log(`Processed Instagram webhook job ${job.id}: Lead ${lead.id} updated with message`);
  }

  /**
   * Process SEND_MESSAGE job: send message via Instagram Graph API
   */
  private async processSendMessageJob(job: any): Promise<void> {
    const { conversationId, recipientId, text, leadId, organizationId, threadId } = job.payloadJson;

    if (!this.accessToken || !this.pageId) {
      throw new Error('Instagram access token or page ID not configured');
    }

    // Get conversation to verify it exists and get recipient info
    const conversation = conversationId
      ? await this.prisma.conversation.findFirst({
          where: {
            id: conversationId,
            organizationId,
            deletedAt: null,
          },
        })
      : null;

    if (conversationId && !conversation) {
      throw new Error(`Conversation ${conversationId} not found`);
    }

    // Determine recipient ID
    const finalRecipientId = recipientId || conversation?.handle || conversation?.externalThreadId;
    if (!finalRecipientId) {
      throw new Error('Recipient ID is required (provide recipientId, conversation.handle, or conversation.externalThreadId)');
    }

    // Call Instagram Graph API (use mock client if available)
    // Instagram uses the same endpoint format as Facebook Messenger
    const url = `${this.apiBaseUrl}/${this.apiVersion}/${this.pageId}/messages`;
    const httpClient = this.externalHttpClient?.isMockMode() ? this.externalHttpClient : { fetch: global.fetch };
    
    const response = await httpClient.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        recipient: {
          id: finalRecipientId,
        },
        message: {
          text: text,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorJson: any = {};
      
      try {
        errorJson = JSON.parse(errorText);
      } catch {
        // If not JSON, use errorText as message
      }
      
      // Check for specific Instagram errors
      if (response.status === 403) {
        if (errorJson.error?.message?.includes('not allowed') || 
            errorJson.error?.message?.includes('messaging') ||
            errorText.includes('not allowed') ||
            errorText.includes('messaging')) {
          throw new BadRequestException({
            message: 'Instagram messaging not supported for this account type',
            errorCode: 'INSTAGRAM_MESSAGING_NOT_SUPPORTED',
          });
        }
      }

      throw new Error(`Instagram API error: ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as any;
    const messageId = result.message_id;

    // Sync conversation first
    const finalConversationId = await this.inboxService.syncConversationFromMessage(
      organizationId,
      IntegrationProvider.INSTAGRAM,
      MessageDirection.OUTBOUND,
      null, // phone (not applicable)
      finalRecipientId, // handle
      threadId || conversation?.externalThreadId || null, // externalThreadId
      new Date(),
    );

    // Save MessageLog (OUTBOUND) with externalMessageId and status
    await this.prisma.messageLog.create({
      data: {
        provider: IntegrationProvider.INSTAGRAM,
        direction: MessageDirection.OUTBOUND,
        to: finalRecipientId,
        from: this.pageId || 'unknown',
        text,
        externalMessageId: messageId, // Instagram message ID for status tracking
        status: MessageStatus.SENT, // Initial status
        statusUpdatedAt: new Date(),
        conversationId: finalConversationId,
        metaJson: {
          messageId,
          instagramMessageId: messageId,
          recipientId: finalRecipientId,
          leadId,
          organizationId,
        },
      },
    });

    // Record outbound message metric
    if (this.metricsService) {
      this.metricsService.recordOutboundMessage(IntegrationProvider.INSTAGRAM, MessageStatus.SENT);
    }

    // If leadId provided, create Note on Lead
    if (leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: leadId,
          organizationId,
          deletedAt: null,
        },
      });

      if (lead) {
        const userId = await this.getFirstAdminUserId(organizationId);
        if (userId) {
          await this.prisma.note.create({
            data: {
              organizationId,
              leadId,
              userId,
              content: `Outbound Instagram message sent: ${text}`,
              isPrivate: false,
            },
          });
        }
      }
    }

    this.logger.log(`Sent Instagram message to ${finalRecipientId} (job ${job.id})`);
  }

  /**
   * Get first admin user ID for organization
   */
  private async getFirstAdminUserId(organizationId: string): Promise<string | null> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    return membership?.userId || null;
  }
}
