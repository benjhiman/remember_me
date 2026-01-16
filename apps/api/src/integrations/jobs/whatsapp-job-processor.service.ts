import { Injectable, Logger } from '@nestjs/common';
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
export class WhatsAppJobProcessorService {
  private readonly logger = new Logger(WhatsAppJobProcessorService.name);
  private readonly accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  private readonly phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
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
      provider: IntegrationProvider.WHATSAPP,
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
    } else if (job.jobType === IntegrationJobType.SEND_MESSAGE_TEMPLATE) {
      await this.processSendTemplateJob(job);
    } else if (job.jobType === IntegrationJobType.AUTOMATION_ACTION) {
      await this.processAutomationActionJob(job);
    }
  }

  /**
   * Process pending jobs (job runner - DB mode)
   */
  async processPendingJobs(limit: number = 10): Promise<void> {
    const jobs = await this.integrationJobsService.fetchNext(limit);

    for (const job of jobs) {
      if (job.provider !== IntegrationProvider.WHATSAPP) {
        continue;
      }

      // Record job latency (time from runAt to start)
      const latencyMs = Date.now() - job.runAt.getTime();
      if (this.metricsService) {
        this.metricsService.recordJobLatency(job.provider, job.jobType, latencyMs);
      }

      const startTime = Date.now();
      try {
        await this.integrationJobsService.markProcessing(job.id);

        if (job.jobType === IntegrationJobType.PROCESS_WEBHOOK) {
          await this.processWebhookJob(job);
        } else if (job.jobType === IntegrationJobType.SEND_MESSAGE) {
          await this.processSendMessageJob(job);
        } else if (job.jobType === IntegrationJobType.SEND_MESSAGE_TEMPLATE) {
          await this.processSendTemplateJob(job);
        } else if (job.jobType === IntegrationJobType.AUTOMATION_ACTION) {
          await this.processAutomationActionJob(job);
        }

        const durationMs = Date.now() - startTime;
        await this.integrationJobsService.markDone(job.id);

        // Record job duration (success)
        if (this.metricsService) {
          this.metricsService.recordJobDuration(job.provider, job.jobType, 'success', durationMs);
        }
      } catch (error) {
        const durationMs = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const errorStack = error instanceof Error ? error.stack : undefined;
        this.logger.error(`Job ${job.id} failed: ${errorMessage}`, errorStack);
        await this.integrationJobsService.markFailed(job.id, errorMessage);

        // Record job duration (failure)
        if (this.metricsService) {
          this.metricsService.recordJobDuration(job.provider, job.jobType, 'failed', durationMs);
        }
      }
    }
  }

  /**
   * Process PROCESS_WEBHOOK job: create/update Lead and add Note
   */
  private async processWebhookJob(job: any): Promise<void> {
    const { messageId, from, text, timestamp, organizationId } = job.payloadJson;

    if (!organizationId) {
      throw new Error('Organization ID is required for PROCESS_WEBHOOK job');
    }

    // Find or create Lead by phone
    let lead = await this.prisma.lead.findFirst({
      where: {
        organizationId,
        phone: from,
        deletedAt: null,
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
        throw new Error(`No admin user found for organization ${organizationId}`);
      }

      const createdById = membership.userId;

      // Get default pipeline for organization
      const defaultPipeline = await this.prisma.pipeline.findFirst({
        where: {
          organizationId,
          isDefault: true,
          deletedAt: null,
        },
        include: {
          stages: {
            where: { deletedAt: null },
            orderBy: { order: 'asc' },
            take: 1,
          },
        },
      });

      if (!defaultPipeline || defaultPipeline.stages.length === 0) {
        // Try to get any pipeline
        const anyPipeline = await this.prisma.pipeline.findFirst({
          where: {
            organizationId,
            deletedAt: null,
          },
          include: {
            stages: {
              where: { deletedAt: null },
              orderBy: { order: 'asc' },
              take: 1,
            },
          },
        });

        if (!anyPipeline || anyPipeline.stages.length === 0) {
          throw new Error(`No pipeline found for organization ${organizationId}`);
        }

        // Create Lead with first stage of any pipeline
        lead = await this.prisma.lead.create({
          data: {
            organizationId,
            pipelineId: anyPipeline.id,
            stageId: anyPipeline.stages[0].id,
            name: `WhatsApp ${from}`,
            phone: from,
            source: 'whatsapp',
            status: LeadStatus.ACTIVE,
            createdById,
          },
          include: {
            pipeline: {
              include: {
                stages: true,
              },
            },
          },
        });
      } else {
        // Create Lead with default pipeline's first stage
        lead = await this.prisma.lead.create({
          data: {
            organizationId,
            pipelineId: defaultPipeline.id,
            stageId: defaultPipeline.stages[0].id,
            name: `WhatsApp ${from}`,
            phone: from,
            source: 'whatsapp',
            status: LeadStatus.ACTIVE,
            createdById,
          },
          include: {
            pipeline: {
              include: {
                stages: true,
              },
            },
          },
        });
      }
    }

    // Get first admin user for organization (to use as note creator)
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
      },
      orderBy: { createdAt: 'asc' },
    });

    if (membership) {
      // Create Note with message content
      await this.prisma.note.create({
        data: {
          organizationId,
          leadId: lead.id,
          userId: membership.userId,
          content: `Inbound WhatsApp message: ${text}`,
          isPrivate: false,
        },
      });
    }

    this.logger.log(`Processed webhook job ${job.id}: Lead ${lead.id} updated with message`);
  }

  /**
   * Process SEND_MESSAGE job: send message via WhatsApp API
   */
  private async processSendMessageJob(job: any): Promise<void> {
    const { toPhone, text, leadId, organizationId, mediaUrl, mediaType, caption } = job.payloadJson;

    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WhatsApp access token or phone number ID not configured');
    }

    // Determine message type and payload
    let messagePayload: any;
    if (mediaUrl) {
      // Send media message
      const type = mediaType === 'image' ? 'image' : 'document';
      messagePayload = {
        messaging_product: 'whatsapp',
        to: toPhone.replace(/^\+/, ''), // Remove + prefix
        type,
        [type]: {
          link: mediaUrl, // WhatsApp Cloud API supports direct URLs
          ...(caption && { caption }),
        },
      };
    } else {
      // Send text message
      messagePayload = {
        messaging_product: 'whatsapp',
        to: toPhone.replace(/^\+/, ''), // Remove + prefix
        type: 'text',
        text: {
          body: text,
        },
      };
    }

    // Call WhatsApp Cloud API (use mock client if available)
    const url = `${this.apiBaseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const httpClient = this.externalHttpClient?.isMockMode() ? this.externalHttpClient : { fetch: global.fetch };
    const response = await httpClient.fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(messagePayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as any;
    const messageId = result.messages?.[0]?.id;

    // Sync conversation first
    const conversationId = await this.inboxService.syncConversationFromMessage(
      organizationId,
      IntegrationProvider.WHATSAPP,
      MessageDirection.OUTBOUND,
      toPhone,
      null, // handle
      null, // externalThreadId
      new Date(),
    );

    // Prepare metaJson with media info if present
    const metaJson: any = {
      messageId,
      whatsappMessageId: messageId,
      leadId,
    };

    if (mediaUrl) {
      metaJson.mediaUrl = mediaUrl;
      metaJson.mediaType = mediaType;
      if (caption) {
        metaJson.caption = caption;
      }
    }

    // Save MessageLog (OUTBOUND) with externalMessageId and status
    await this.prisma.messageLog.create({
      data: {
        provider: IntegrationProvider.WHATSAPP,
        direction: MessageDirection.OUTBOUND,
        to: toPhone,
        from: this.phoneNumberId,
        text: text || caption || null, // Use caption if no text
        externalMessageId: messageId, // WhatsApp message ID for status tracking
        status: MessageStatus.SENT, // Initial status (will be updated by webhook)
        statusUpdatedAt: new Date(),
        conversationId,
        metaJson,
      },
    });

    // Record outbound message metric
    if (this.metricsService) {
      this.metricsService.recordOutboundMessage(IntegrationProvider.WHATSAPP, MessageStatus.SENT);
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
        // Get first admin user for organization (to use as note creator)
        const membership = await this.prisma.membership.findFirst({
          where: {
            organizationId,
            role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (membership) {
          await this.prisma.note.create({
            data: {
              organizationId,
              leadId,
              userId: membership.userId,
              content: `Outbound WhatsApp message sent: ${text}`,
              isPrivate: false,
            },
          });
        }
      }
    }

    this.logger.log(`Sent WhatsApp message to ${toPhone} (job ${job.id})`);
  }

  /**
   * Process SEND_MESSAGE_TEMPLATE job: send template message via WhatsApp API
   */
  private async processSendTemplateJob(job: any): Promise<void> {
    const { messageLogId, templateId, toPhone, variables, leadId, organizationId } = job.payloadJson;

    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WhatsApp access token or phone number ID not configured');
    }

    // Get template
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
        status: 'APPROVED',
        deletedAt: null,
      },
    });

    if (!template) {
      throw new Error(`Template ${templateId} not found or not approved`);
    }

    // Build template message payload
    // WhatsApp template format: https://developers.facebook.com/docs/whatsapp/cloud-api/guides/send-message-templates
    const templatePayload: any = {
      messaging_product: 'whatsapp',
      to: toPhone.replace(/^\+/, ''), // Remove + prefix
      type: 'template',
      template: {
        name: template.name,
        language: {
          code: template.language,
        },
      },
    };

    // Add components (parameters) if variables provided
    const components: any[] = [];
    const templateComponents = template.componentsJson as any;

    // Process body parameters
    if (templateComponents.body && templateComponents.body.length > 0) {
      const bodyComponent = templateComponents.body[0];
      if (bodyComponent.type === 'text' && bodyComponent.text) {
        // Extract placeholders from text (e.g., {{1}}, {{2}})
        const placeholders = bodyComponent.text.match(/\{\{(\d+)\}\}/g) || [];
        if (placeholders.length > 0) {
          components.push({
            type: 'body',
            parameters: placeholders.map((placeholder: string) => {
              const index = parseInt(placeholder.replace(/\{\{|\}\}/g, ''), 10);
              const varKey = Object.keys(variables)[index - 1] || `var${index}`;
              return {
                type: 'text',
                text: variables[varKey] || '',
              };
            }),
          });
        }
      }
    }

    // Process header parameters (if any)
    if (templateComponents.header && templateComponents.header.length > 0) {
      const headerComponent = templateComponents.header[0];
      if (headerComponent.type === 'text' && headerComponent.text) {
        const placeholders = headerComponent.text.match(/\{\{(\d+)\}\}/g) || [];
        if (placeholders.length > 0) {
          components.push({
            type: 'header',
            parameters: placeholders.map((placeholder: string) => {
              const index = parseInt(placeholder.replace(/\{\{|\}\}/g, ''), 10);
              const varKey = Object.keys(variables)[index - 1] || `var${index}`;
              return {
                type: 'text',
                text: variables[varKey] || '',
              };
            }),
          });
        }
      }
    }

    if (components.length > 0) {
      templatePayload.template.components = components;
    }

    // Call WhatsApp Cloud API
    const url = `${this.apiBaseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(templatePayload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`WhatsApp API error: ${response.status} ${errorText}`);
    }

    const result = (await response.json()) as any;
    const messageId = result.messages?.[0]?.id;

    // Update MessageLog with externalMessageId and status
    await this.prisma.messageLog.update({
      where: { id: messageLogId },
      data: {
        externalMessageId: messageId,
        status: MessageStatus.SENT,
        statusUpdatedAt: new Date(),
      },
    });

    // Record outbound message metric
    if (this.metricsService) {
      this.metricsService.recordOutboundMessage(IntegrationProvider.WHATSAPP, MessageStatus.SENT);
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
        // Get first admin user for organization (to use as note creator)
        const membership = await this.prisma.membership.findFirst({
          where: {
            organizationId,
            role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
          },
          orderBy: { createdAt: 'asc' },
        });

        if (membership) {
          await this.prisma.note.create({
            data: {
              organizationId,
              leadId,
              userId: membership.userId,
              content: `Template message sent: ${template.name}`,
              isPrivate: false,
            },
          });
        }
      }
    }

    this.logger.log(`Sent WhatsApp template ${template.name} to ${toPhone} (job ${job.id})`);
  }

  /**
   * Process AUTOMATION_ACTION job: execute automation rule action
   */
  private async processAutomationActionJob(job: any): Promise<void> {
    const { ruleId, action, payloadJson, phone, leadId, saleId, organizationId } = job.payloadJson;

    if (!this.accessToken || !this.phoneNumberId) {
      throw new Error('WhatsApp access token or phone number ID not configured');
    }

    if (action === 'SEND_TEMPLATE') {
      // Send template message
      const { templateId, variables } = payloadJson;

      // Get template
      const template = await this.prisma.whatsAppTemplate.findFirst({
        where: {
          id: templateId,
          organizationId,
          status: 'APPROVED',
          deletedAt: null,
        },
      });

      if (!template) {
        throw new Error(`Template ${templateId} not found or not approved`);
      }

      // Build template payload (same as processSendTemplateJob)
      const templatePayload: any = {
        messaging_product: 'whatsapp',
        to: phone.replace(/^\+/, ''),
        type: 'template',
        template: {
          name: template.name,
          language: {
            code: template.language,
          },
        },
      };

      // Add components if variables provided
      const components: any[] = [];
      const templateComponents = template.componentsJson as any;

      if (templateComponents.body && templateComponents.body.length > 0) {
        const bodyComponent = templateComponents.body[0];
        if (bodyComponent.type === 'text' && bodyComponent.text) {
          const placeholders = bodyComponent.text.match(/\{\{(\d+)\}\}/g) || [];
          if (placeholders.length > 0) {
            components.push({
              type: 'body',
              parameters: placeholders.map((placeholder: string) => {
                const index = parseInt(placeholder.replace(/\{\{|\}\}/g, ''), 10);
                const varKey = Object.keys(variables)[index - 1] || `var${index}`;
                return {
                  type: 'text',
                  text: variables[varKey] || '',
                };
              }),
            });
          }
        }
      }

      if (components.length > 0) {
        templatePayload.template.components = components;
      }

      // Call WhatsApp API (use mock client if available)
      const url = `${this.apiBaseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`;
      const httpClient = this.externalHttpClient?.isMockMode() ? this.externalHttpClient : { fetch: global.fetch };
      const response = await httpClient.fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(templatePayload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WhatsApp API error: ${response.status} ${errorText}`);
      }

      const result = (await response.json()) as any;
      const messageId = result.messages?.[0]?.id;

      // Save MessageLog
      await this.prisma.messageLog.create({
        data: {
          provider: IntegrationProvider.WHATSAPP,
          direction: MessageDirection.OUTBOUND,
          to: phone,
          from: this.phoneNumberId,
          text: `Template: ${template.name}`,
          externalMessageId: messageId,
          status: MessageStatus.SENT,
          statusUpdatedAt: new Date(),
          metaJson: {
            automationRuleId: ruleId,
            templateId,
            variables,
            leadId,
            saleId,
          },
        },
      });

      // Create Note on Lead if provided
      if (leadId) {
        const lead = await this.prisma.lead.findFirst({
          where: {
            id: leadId,
            organizationId,
            deletedAt: null,
          },
        });

        if (lead) {
          const membership = await this.prisma.membership.findFirst({
            where: {
              organizationId,
              role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
            },
            orderBy: { createdAt: 'asc' },
          });

          if (membership) {
            await this.prisma.note.create({
              data: {
                organizationId,
                leadId,
                userId: membership.userId,
                content: `Automation: Template ${template.name} sent`,
                isPrivate: false,
              },
            });
          }
        }
      }
    } else if (action === 'SEND_TEXT') {
      // Send plain text message
      const { text } = payloadJson;

      const url = `${this.apiBaseUrl}/${this.apiVersion}/${this.phoneNumberId}/messages`;
      const httpClient = this.externalHttpClient?.isMockMode() ? this.externalHttpClient : { fetch: global.fetch };
      const response = await httpClient.fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: phone.replace(/^\+/, ''),
          type: 'text',
          text: {
            body: text,
          },
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`WhatsApp API error: ${response.status} ${errorText}`);
      }

      const result = (await response.json()) as any;
      const messageId = result.messages?.[0]?.id;

      // Save MessageLog
      await this.prisma.messageLog.create({
        data: {
          provider: IntegrationProvider.WHATSAPP,
          direction: MessageDirection.OUTBOUND,
          to: phone,
          from: this.phoneNumberId,
          text,
          externalMessageId: messageId,
          status: MessageStatus.SENT,
          statusUpdatedAt: new Date(),
          metaJson: {
            automationRuleId: ruleId,
            leadId,
            saleId,
          },
        },
      });

      // Create Note on Lead if provided
      if (leadId) {
        const lead = await this.prisma.lead.findFirst({
          where: {
            id: leadId,
            organizationId,
            deletedAt: null,
          },
        });

        if (lead) {
          const membership = await this.prisma.membership.findFirst({
            where: {
              organizationId,
              role: { in: ['OWNER', 'ADMIN', 'MANAGER'] },
            },
            orderBy: { createdAt: 'asc' },
          });

          if (membership) {
            await this.prisma.note.create({
              data: {
                organizationId,
                leadId,
                userId: membership.userId,
                content: `Automation: Text message sent: ${text.substring(0, 50)}...`,
                isPrivate: false,
              },
            });
          }
        }
      }
    }

    this.logger.log(`Executed automation action ${action} for rule ${ruleId} (job ${job.id})`);
  }
}
