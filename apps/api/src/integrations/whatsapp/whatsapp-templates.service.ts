import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  WhatsAppTemplateCategory,
  WhatsAppTemplateStatus,
  IntegrationProvider,
  IntegrationJobType,
  MessageDirection,
  MessageStatus,
} from '@remember-me/prisma';
import { CreateWhatsAppTemplateDto } from './dto/create-whatsapp-template.dto';
import { UpdateWhatsAppTemplateDto } from './dto/update-whatsapp-template.dto';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';

@Injectable()
export class WhatsAppTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationQueueService: IntegrationQueueService,
  ) {}

  /**
   * List templates for organization
   */
  async listTemplates(
    organizationId: string,
    filters?: {
      status?: WhatsAppTemplateStatus;
      category?: WhatsAppTemplateCategory;
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
      deletedAt: null,
    };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.category) {
      where.category = filters.category;
    }

    const [data, total] = await Promise.all([
      this.prisma.whatsAppTemplate.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.whatsAppTemplate.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Get template by ID
   */
  async getTemplate(organizationId: string, templateId: string) {
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found');
    }

    return template;
  }

  /**
   * Create template
   */
  async createTemplate(organizationId: string, dto: CreateWhatsAppTemplateDto) {
    // Check for duplicate (name + language)
    const existing = await this.prisma.whatsAppTemplate.findUnique({
      where: {
        organizationId_name_language: {
          organizationId,
          name: dto.name,
          language: dto.language || 'es_AR',
        },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new BadRequestException('Template with this name and language already exists');
    }

    return this.prisma.whatsAppTemplate.create({
      data: {
        organizationId,
        name: dto.name,
        language: dto.language || 'es_AR',
        category: dto.category,
        componentsJson: dto.componentsJson,
        status: WhatsAppTemplateStatus.PENDING, // New templates start as PENDING
      },
    });
  }

  /**
   * Update template
   */
  async updateTemplate(organizationId: string, templateId: string, dto: UpdateWhatsAppTemplateDto) {
    const template = await this.getTemplate(organizationId, templateId);

    // If updating name/language, check for duplicates
    if (dto.name || dto.language) {
      const newName = dto.name || template.name;
      const newLanguage = dto.language || template.language;

      if (newName !== template.name || newLanguage !== template.language) {
        const existing = await this.prisma.whatsAppTemplate.findUnique({
          where: {
            organizationId_name_language: {
              organizationId,
              name: newName,
              language: newLanguage,
            },
          },
        });

        if (existing && existing.id !== templateId && !existing.deletedAt) {
          throw new BadRequestException('Template with this name and language already exists');
        }
      }
    }

    return this.prisma.whatsAppTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.language && { language: dto.language }),
        ...(dto.category && { category: dto.category }),
        ...(dto.componentsJson && { componentsJson: dto.componentsJson }),
        ...(dto.status && { status: dto.status }),
      },
    });
  }

  /**
   * Delete template (soft delete)
   */
  async deleteTemplate(organizationId: string, templateId: string) {
    const template = await this.getTemplate(organizationId, templateId);

    return this.prisma.whatsAppTemplate.update({
      where: { id: templateId },
      data: {
        deletedAt: new Date(),
        status: WhatsAppTemplateStatus.DISABLED,
      },
    });
  }

  /**
   * Send template message
   */
  async sendTemplate(
    organizationId: string,
    toPhone: string,
    templateId: string,
    variables: Record<string, string>,
    leadId?: string,
  ) {
    // Get template and validate it's APPROVED
    const template = await this.getTemplate(organizationId, templateId);

    if (template.status !== WhatsAppTemplateStatus.APPROVED) {
      throw new BadRequestException(
        `Template is not approved. Current status: ${template.status}`,
      );
    }

    // Create MessageLog (OUTBOUND) with QUEUED status
    const messageLog = await this.prisma.messageLog.create({
      data: {
        provider: IntegrationProvider.WHATSAPP,
        direction: MessageDirection.OUTBOUND,
        to: toPhone,
        from: process.env.WHATSAPP_PHONE_NUMBER_ID || 'unknown',
        text: `Template: ${template.name}`, // Placeholder text
        status: MessageStatus.QUEUED,
        metaJson: {
          templateId,
          templateName: template.name,
          variables,
          leadId,
        },
      },
    });

    // Enqueue SEND_MESSAGE_TEMPLATE job
    const job = await this.integrationQueueService.enqueue({
      jobType: IntegrationJobType.SEND_MESSAGE_TEMPLATE,
      provider: IntegrationProvider.WHATSAPP,
      payload: {
        messageLogId: messageLog.id,
        templateId,
        toPhone,
        variables,
        leadId,
        organizationId,
      },
      organizationId,
    });

    return {
      jobId: job.id,
      messageLogId: messageLog.id,
      status: 'QUEUED',
      message: 'Template message queued for sending',
    };
  }
}
