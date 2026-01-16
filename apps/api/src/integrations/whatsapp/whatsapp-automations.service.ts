import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';
import {
  WhatsAppAutomationTrigger,
  WhatsAppAutomationAction,
  IntegrationProvider,
  IntegrationJobType,
  LeadStatus,
  SaleStatus,
} from '@remember-me/prisma';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

@Injectable()
export class WhatsAppAutomationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationQueueService: IntegrationQueueService,
  ) {}

  /**
   * List automation rules for organization
   */
  async listRules(
    organizationId: string,
    filters?: {
      trigger?: WhatsAppAutomationTrigger;
      enabled?: boolean;
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

    if (filters?.trigger) {
      where.trigger = filters.trigger;
    }

    if (filters?.enabled !== undefined) {
      where.enabled = filters.enabled;
    }

    const [data, total] = await Promise.all([
      this.prisma.whatsAppAutomationRule.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.whatsAppAutomationRule.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Get rule by ID
   */
  async getRule(organizationId: string, ruleId: string) {
    const rule = await this.prisma.whatsAppAutomationRule.findFirst({
      where: {
        id: ruleId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!rule) {
      throw new NotFoundException('Automation rule not found');
    }

    return rule;
  }

  /**
   * Create automation rule
   */
  async createRule(organizationId: string, dto: CreateAutomationRuleDto) {
    return this.prisma.whatsAppAutomationRule.create({
      data: {
        organizationId,
        name: dto.name,
        trigger: dto.trigger,
        action: dto.action,
        payloadJson: dto.payloadJson,
        enabled: dto.enabled ?? true,
        cooldownHours: dto.cooldownHours ?? 24,
      },
    });
  }

  /**
   * Update automation rule
   */
  async updateRule(organizationId: string, ruleId: string, dto: UpdateAutomationRuleDto) {
    const rule = await this.getRule(organizationId, ruleId);

    return this.prisma.whatsAppAutomationRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.trigger && { trigger: dto.trigger }),
        ...(dto.action && { action: dto.action }),
        ...(dto.payloadJson && { payloadJson: dto.payloadJson }),
        ...(dto.enabled !== undefined && { enabled: dto.enabled }),
        ...(dto.cooldownHours !== undefined && { cooldownHours: dto.cooldownHours }),
      },
    });
  }

  /**
   * Delete automation rule (soft delete)
   */
  async deleteRule(organizationId: string, ruleId: string) {
    const rule = await this.getRule(organizationId, ruleId);

    return this.prisma.whatsAppAutomationRule.update({
      where: { id: ruleId },
      data: {
        deletedAt: new Date(),
        enabled: false,
      },
    });
  }

  /**
   * Check if message was sent recently (cooldown check)
   */
  private async checkCooldown(
    organizationId: string,
    phone: string,
    cooldownHours: number,
  ): Promise<boolean> {
    const cooldownDate = new Date();
    cooldownDate.setHours(cooldownDate.getHours() - cooldownHours);

    // MessageLog doesn't have organizationId, so we need to check via lead/sale association
    // For now, check by phone only (cooldown is per phone, not per org)
    const recentMessage = await this.prisma.messageLog.findFirst({
      where: {
        provider: IntegrationProvider.WHATSAPP,
        to: phone,
        direction: 'OUTBOUND',
        createdAt: {
          gte: cooldownDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return !!recentMessage; // Returns true if message found (cooldown active)
  }

  /**
   * Process trigger and create automation job
   */
  async processTrigger(
    organizationId: string,
    trigger: WhatsAppAutomationTrigger,
    context: {
      leadId?: string;
      saleId?: string;
      phone?: string;
      delayHours?: number; // Override default delay
    },
  ): Promise<void> {
    // Get enabled rules for this trigger
    const rules = await this.prisma.whatsAppAutomationRule.findMany({
      where: {
        organizationId,
        trigger,
        enabled: true,
        deletedAt: null,
      },
    });

    if (rules.length === 0) {
      return; // No rules for this trigger
    }

    // Get phone from context or from lead/sale
    let phone = context.phone;
    if (!phone && context.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: context.leadId,
          organizationId,
          deletedAt: null,
        },
      });
      phone = lead?.phone || undefined;
    }
    if (!phone && context.saleId) {
      const sale = await this.prisma.sale.findFirst({
        where: {
          id: context.saleId,
          organizationId,
          deletedAt: null,
        },
        include: {
          items: {
            include: {
              stockItem: true,
            },
          },
        },
      });
      // Try to get phone from sale customer or from associated lead
      phone = sale?.customerPhone || undefined;
    }

    if (!phone) {
      return; // No phone available, skip automation
    }

    // Process each rule
    for (const rule of rules) {
      // Check cooldown
      const inCooldown = await this.checkCooldown(organizationId, phone, rule.cooldownHours);
      if (inCooldown) {
        continue; // Skip this rule, cooldown active
      }

      // Calculate runAt based on trigger type (default delays)
      let delayHours = context.delayHours;
      if (delayHours === undefined) {
        switch (trigger) {
          case WhatsAppAutomationTrigger.LEAD_CREATED:
            delayHours = 2; // 2 hours
            break;
          case WhatsAppAutomationTrigger.SALE_RESERVED:
            delayHours = 0.5; // 30 minutes
            break;
          case WhatsAppAutomationTrigger.SALE_PAID:
            delayHours = 5 / 60; // 5 minutes
            break;
          case WhatsAppAutomationTrigger.NO_REPLY_24H:
            delayHours = 24; // 24 hours
            break;
          default:
            delayHours = rule.cooldownHours;
        }
      }

      const runAt = new Date();
      runAt.setHours(runAt.getHours() + delayHours);

      // Create automation job
      await this.integrationQueueService.enqueue({
        jobType: IntegrationJobType.AUTOMATION_ACTION,
        provider: IntegrationProvider.WHATSAPP,
        payload: {
          ruleId: rule.id,
          trigger,
          action: rule.action,
          payloadJson: rule.payloadJson,
          phone,
          leadId: context.leadId,
          saleId: context.saleId,
          organizationId,
        },
        runAt, // Schedule for future
        organizationId,
        dedupeKey: `${rule.id}:${phone}:${trigger}`, // Dedupe key for automation jobs
      });
    }
  }

  /**
   * Run automation manually (for testing/admin)
   */
  async runNow(
    organizationId: string,
    ruleId: string,
    context: {
      phone: string;
      leadId?: string;
      saleId?: string;
    },
  ) {
    const rule = await this.getRule(organizationId, ruleId);

    if (!rule.enabled) {
      throw new BadRequestException('Rule is disabled');
    }

    // Check cooldown
    const inCooldown = await this.checkCooldown(organizationId, context.phone, rule.cooldownHours);
    if (inCooldown) {
      throw new BadRequestException(
        `Cooldown active. Last message sent within ${rule.cooldownHours} hours.`,
      );
    }

    // Create job to run immediately
    const job = await this.integrationQueueService.enqueue({
      jobType: IntegrationJobType.AUTOMATION_ACTION,
      provider: IntegrationProvider.WHATSAPP,
      payload: {
        ruleId: rule.id,
        trigger: rule.trigger,
        action: rule.action,
        payloadJson: rule.payloadJson,
        phone: context.phone,
        leadId: context.leadId,
        saleId: context.saleId,
        organizationId,
      },
      runAt: new Date(), // Run now
      organizationId,
      dedupeKey: `${rule.id}:${context.phone}:${rule.trigger}`, // Dedupe key for automation jobs
    });

    return {
      jobId: job.id,
      message: 'Automation job created and will run immediately',
    };
  }
}
