import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationProvider, WebhookEventStatus, LeadStatus } from '@remember-me/prisma';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class MetaLeadAdsService {
  private readonly logger = new Logger(MetaLeadAdsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

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
          provider: IntegrationProvider.INSTAGRAM, // Meta Lead Ads can come from Instagram or Facebook
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
          `Using fallback organization ${firstOrg.id} for Meta Lead Ads webhook (dev mode)`,
        );
        return firstOrg.id;
      }
    }

    return undefined;
  }

  /**
   * Process Meta Lead Ads webhook
   * Webhook format: https://developers.facebook.com/docs/marketing-api/guides/leadgen-retrieval
   */
  async processWebhook(payload: any, organizationId?: string): Promise<void> {
    // Validate payload structure
    if (!payload.entry || !Array.isArray(payload.entry) || payload.entry.length === 0) {
      throw new BadRequestException('Invalid webhook payload: entry array is required');
    }

    // Process each entry
    for (const entry of payload.entry) {
      const pageId = entry.id;

      // Resolve organizationId
      const resolvedOrgId = await this.resolveOrganizationId(pageId, organizationId);
      if (!resolvedOrgId) {
        this.logger.warn(
          `Could not resolve organizationId for Meta Lead Ads webhook with pageId: ${pageId}`,
        );
        continue;
      }

      // Process leadgen events
      if (entry.leadgen && Array.isArray(entry.leadgen)) {
        for (const leadgen of entry.leadgen) {
          await this.processLeadGenEvent(leadgen, resolvedOrgId, pageId);
        }
      }
    }
  }

  /**
   * Process a leadgen event (new lead from Meta Ads)
   */
  private async processLeadGenEvent(
    leadgen: any,
    organizationId: string,
    pageId: string,
  ): Promise<void> {
    const leadgenId = leadgen.id;
    const adId = leadgen.ad_id;
    const adsetId = leadgen.adset_id;
    const campaignId = leadgen.campaign_id;
    const formId = leadgen.form_id;
    const createdTime = leadgen.created_time;
    const fieldData = leadgen.field_data || [];

    if (!leadgenId) {
      this.logger.warn('Leadgen event missing id');
      return;
    }

    // Check for duplicate lead (idempotency)
    // Search for existing lead with same metaLeadgenId in customFields
    const allLeads = await this.prisma.lead.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      select: {
        id: true,
        customFields: true,
      },
    });

    const existingLead = allLeads.find((lead) => {
      const customFields = lead.customFields as any;
      return customFields?.metaLeadgenId === leadgenId;
    });

    if (existingLead) {
      this.logger.debug(`Duplicate Meta Lead Ads lead ${leadgenId}, skipping`);
      return;
    }

    // Save webhook event
    const webhookEvent = await this.prisma.webhookEvent.create({
      data: {
        provider: IntegrationProvider.INSTAGRAM, // Using INSTAGRAM as provider for Meta Lead Ads
        eventType: 'leadgen',
        payloadJson: {
          leadgenId,
          adId,
          adsetId,
          campaignId,
          formId,
          createdTime,
          fieldData,
        },
        status: WebhookEventStatus.PENDING,
      },
    });

    // Extract lead data from field_data
    const leadData = this.extractLeadData(fieldData);

    // Get default pipeline and stage for organization
    const pipeline = await this.prisma.pipeline.findFirst({
      where: {
        organizationId,
        isDefault: true,
        deletedAt: null,
      },
    });

    if (!pipeline) {
      this.logger.warn(`No default pipeline found for organization ${organizationId}, skipping lead creation`);
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

    // Prepare customFields with Meta Ads attribution
    const customFields: any = {
      metaLeadgenId: leadgenId,
      metaAdId: adId,
      metaAdsetId: adsetId,
      metaCampaignId: campaignId,
      metaFormId: formId,
      metaPageId: pageId,
      metaCreatedTime: createdTime,
    };

    // Add any additional fields from field_data that don't map to standard Lead fields
    for (const field of fieldData) {
      const fieldName = field.name;
      const fieldValue = field.values?.[0] || field.value;

      // Skip fields that are already mapped to standard Lead fields
      if (!['full_name', 'first_name', 'last_name', 'email', 'phone_number', 'city'].includes(fieldName)) {
        customFields[`meta_${fieldName}`] = fieldValue;
      }
    }

    // Create Lead
    const lead = await this.prisma.lead.create({
      data: {
        organizationId,
        pipelineId: pipeline.id,
        stageId: firstStage.id,
        createdById: membership.userId,
        name: leadData.name || 'Meta Ads Lead',
        email: leadData.email,
        phone: leadData.phone,
        city: leadData.city,
        source: 'meta_ads',
        tags: ['META_ADS'],
        customFields,
      },
    });

    // Try to link with existing conversation (WhatsApp or Instagram)
    if (leadData.phone) {
      await this.linkWithConversation(organizationId, lead.id, leadData.phone);
    }

    // Create Note on Lead
    await this.prisma.note.create({
      data: {
        organizationId,
        leadId: lead.id,
        userId: membership.userId,
        content: `Lead received from Meta Ads (Campaign: ${campaignId || 'N/A'}, Ad: ${adId || 'N/A'})`,
        isPrivate: false,
      },
    });

    // Mark webhook event as processed
    await this.prisma.webhookEvent.update({
      where: { id: webhookEvent.id },
      data: { status: WebhookEventStatus.PROCESSED, processedAt: new Date() },
    });

    this.logger.log(`Created Lead ${lead.id} from Meta Lead Ads webhook ${leadgenId}`);
  }

  /**
   * Extract lead data from Meta Lead Ads field_data array
   */
  private extractLeadData(fieldData: any[]): {
    name?: string;
    email?: string;
    phone?: string;
    city?: string;
  } {
    const result: {
      name?: string;
      email?: string;
      phone?: string;
      city?: string;
    } = {};

    for (const field of fieldData) {
      const fieldName = field.name;
      const fieldValue = field.values?.[0] || field.value;

      switch (fieldName) {
        case 'full_name':
          result.name = fieldValue;
          break;
        case 'first_name':
          if (!result.name) {
            result.name = fieldValue;
          }
          break;
        case 'last_name':
          if (result.name && !result.name.includes(' ')) {
            result.name = `${result.name} ${fieldValue}`;
          } else if (!result.name) {
            result.name = fieldValue;
          }
          break;
        case 'email':
          result.email = fieldValue;
          break;
        case 'phone_number':
        case 'phone':
          result.phone = fieldValue;
          break;
        case 'city':
          result.city = fieldValue;
          break;
      }
    }

    return result;
  }

  /**
   * Link Lead with existing conversation (WhatsApp or Instagram) if phone matches
   */
  private async linkWithConversation(
    organizationId: string,
    leadId: string,
    phone: string,
  ): Promise<void> {
    // Normalize phone number (remove spaces, dashes, parentheses, keep + and digits)
    const normalizedPhone = phone.replace(/[\s\-\(\)]/g, '');

    // Try to find conversation by exact phone match
    let conversation = await this.prisma.conversation.findFirst({
      where: {
        organizationId,
        phone: normalizedPhone,
        deletedAt: null,
      },
    });

    // If not found, try with phone containing the normalized number (for different formats)
    if (!conversation) {
      conversation = await this.prisma.conversation.findFirst({
        where: {
          organizationId,
          phone: {
            contains: normalizedPhone.replace(/^\+/, ''), // Remove + for contains search
          },
          deletedAt: null,
        },
      });
    }

    if (conversation && !conversation.leadId) {
      // Link conversation to lead
      await this.prisma.conversation.update({
        where: { id: conversation.id },
        data: { leadId },
      });

      this.logger.log(`Linked conversation ${conversation.id} to Lead ${leadId}`);
    }
  }
}
