import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Inject,
  Scope,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AuditAction, AuditEntityType } from '@remember-me/prisma';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import { ListPricingRulesDto } from './dto/list-pricing-rules.dto';
import { ComputePriceDto } from './dto/compute-price.dto';
import { ComputeBulkDto } from './dto/compute-bulk.dto';
import { ComputeSaleDto } from './dto/compute-sale.dto';
import { Role, RuleType, ScopeType, ItemCondition } from '@remember-me/prisma';
import { Decimal } from '@prisma/client/runtime/library';

interface PricingContext {
  customerContext?: Record<string, any>;
}

interface PricingResult {
  basePrice: Decimal;
  finalPrice: Decimal;
  ruleId?: string;
  ruleName?: string;
  appliedRule?: any;
}

@Injectable({ scope: Scope.REQUEST })
export class PricingService {
  constructor(
    private prisma: PrismaService,
    private auditLogService: AuditLogService,
    @Inject(REQUEST) private request: Request,
  ) {}

  // Helper: Get request metadata for audit log
  private getRequestMetadata(): { requestId: string | null; method: string; path: string; ip: string; userAgent: string } {
    const requestId = (this.request as any).requestId || null;
    const method = this.request.method || 'UNKNOWN';
    const path = this.request.path || this.request.url || 'UNKNOWN';
    const ip = this.request.ip || (this.request.socket?.remoteAddress) || 'UNKNOWN';
    const userAgent = this.request.get('user-agent') || '';
    return { requestId, method, path, ip, userAgent };
  }

  // Helper: Verify user membership and get role
  private async verifyMembership(
    organizationId: string,
    userId: string,
  ): Promise<{ role: Role }> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        organizationId,
        userId,
      },
    });

    if (!membership) {
      throw new NotFoundException('Organization not found or you are not a member');
    }

    return { role: membership.role };
  }

  // Helper: Check if user has admin/manager access
  private hasAdminManagerAccess(role: Role): boolean {
    return role === Role.ADMIN || role === Role.MANAGER || role === Role.OWNER;
  }

  // Helper: Check if rule matches stock item
  private ruleMatchesItem(
    rule: {
      scopeType: ScopeType;
      matchers?: Record<string, any> | null;
    },
    item: {
      model: string;
      condition?: ItemCondition | string;
      storage?: string | null;
      color?: string | null;
    },
    context?: PricingContext,
  ): boolean {
    // GLOBAL scope matches everything
    if (rule.scopeType === ScopeType.GLOBAL) {
      return true;
    }

    // If no matchers, scope-based matching
    if (!rule.matchers || Object.keys(rule.matchers).length === 0) {
      // BY_PRODUCT would need model match, but without matchers it's ambiguous
      // For now, if no matchers and scope is not GLOBAL, return false
      return false;
    }

    const matchers = rule.matchers as Record<string, any>;

    // BY_PRODUCT: match by model
    if (rule.scopeType === ScopeType.BY_PRODUCT) {
      if (matchers.model && item.model !== matchers.model) {
        return false;
      }
    }

    // BY_CONDITION: match by condition
    if (rule.scopeType === ScopeType.BY_CONDITION) {
      if (matchers.condition && item.condition !== matchers.condition) {
        return false;
      }
    }

    // BY_CATEGORY: match by category (if we add category field)
    if (rule.scopeType === ScopeType.BY_CATEGORY) {
      if (matchers.category) {
        // For now, category matching is not implemented in StockItem
        return false;
      }
    }

    // Check all matcher fields
    if (matchers.model && item.model !== matchers.model) {
      return false;
    }
    if (matchers.condition && item.condition !== matchers.condition) {
      return false;
    }
    if (matchers.storage && item.storage !== matchers.storage) {
      return false;
    }
    if (matchers.color && item.color !== matchers.color) {
      return false;
    }

    return true;
  }

  // Core pricing engine
  async computePrice(
    organizationId: string,
    stockItemId: string,
    baseCost?: number,
    context?: PricingContext,
    allowStacking: boolean = false,
  ): Promise<PricingResult> {
    // Get stock item
    const stockItem = await this.prisma.stockItem.findFirst({
      where: {
        id: stockItemId,
        organizationId,
      },
    });

    if (!stockItem) {
      throw new NotFoundException('Stock item not found');
    }

    // Use provided baseCost or stockItem.basePrice
    const basePrice = baseCost !== undefined 
      ? new Decimal(baseCost)
      : stockItem.basePrice;

    // Get active rules for organization, ordered by priority (desc)
    // Ignore soft-deleted rules
    const rules = await this.prisma.pricingRule.findMany({
      where: {
        organizationId,
        isActive: true,
        deletedAt: null, // Ignore soft-deleted rules
      },
      orderBy: {
        priority: 'desc',
      },
    });

    // Filter rules that match the item
    const matchingRules = rules.filter((rule) =>
      this.ruleMatchesItem(
        {
          scopeType: rule.scopeType,
          matchers: rule.matchers as Record<string, any> | null,
        },
        {
          model: stockItem.model,
          condition: stockItem.condition,
          storage: stockItem.storage,
          color: stockItem.color,
        },
        context,
      ),
    );

    if (matchingRules.length === 0) {
      // No matching rules, return base price
      return {
        basePrice,
        finalPrice: basePrice,
      };
    }

    // Apply rules (by default, only highest priority rule)
    if (!allowStacking) {
      const rule = matchingRules[0]; // Highest priority
      return this.applyRule(basePrice, rule);
    }

    // Stacking: apply all matching rules in priority order
    let currentPrice = basePrice;
    let appliedRule = matchingRules[0];

    for (const rule of matchingRules) {
      const result = this.applyRule(currentPrice, rule);
      currentPrice = result.finalPrice;
      // Override stops further processing
      if (rule.ruleType === RuleType.OVERRIDE_PRICE) {
        appliedRule = rule;
        break;
      }
    }

    return {
      basePrice,
      finalPrice: currentPrice,
      ruleId: appliedRule.id,
      ruleName: appliedRule.name,
      appliedRule: appliedRule,
    };
  }

  // Apply a single rule to a price
  private applyRule(basePrice: Decimal, rule: any): PricingResult {
    const ruleValue = parseFloat(rule.value.toString());

    switch (rule.ruleType) {
      case RuleType.OVERRIDE_PRICE:
        // Override: return the value directly
        return {
          basePrice,
          finalPrice: new Decimal(ruleValue),
          ruleId: rule.id,
          ruleName: rule.name,
          appliedRule: rule,
        };

      case RuleType.MARKUP_PERCENT:
        // Markup percentage: basePrice * (1 + value / 100)
        const percentMultiplier = new Decimal(1).plus(new Decimal(ruleValue).div(100));
        return {
          basePrice,
          finalPrice: basePrice.mul(percentMultiplier),
          ruleId: rule.id,
          ruleName: rule.name,
          appliedRule: rule,
        };

      case RuleType.MARKUP_FIXED:
        // Markup fixed: basePrice + value
        return {
          basePrice,
          finalPrice: basePrice.plus(new Decimal(ruleValue)),
          ruleId: rule.id,
          ruleName: rule.name,
          appliedRule: rule,
        };

      default:
        // Unknown rule type, return base price
        return {
          basePrice,
          finalPrice: basePrice,
        };
    }
  }

  async createRule(organizationId: string, userId: string, dto: CreatePricingRuleDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can create pricing rules');
    }

    const rule = await this.prisma.pricingRule.create({
      data: {
        organizationId,
        name: dto.name,
        priority: dto.priority,
        isActive: dto.isActive ?? true,
        ruleType: dto.ruleType,
        scopeType: dto.scopeType ?? ScopeType.GLOBAL,
        matchers: dto.matchers || {},
        value: new Decimal(dto.value),
        currency: dto.currency || 'USD',
      },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.CREATE,
      entityType: AuditEntityType.PricingRule,
      entityId: rule.id,
      before: null,
      after: {
        id: rule.id,
        name: rule.name,
        ruleType: rule.ruleType,
        scopeType: rule.scopeType,
        isActive: rule.isActive,
        priority: rule.priority,
      },
      metadata,
    });

    return rule;
  }

  async listRules(organizationId: string, userId: string, dto: ListPricingRulesDto) {
    const { role } = await this.verifyMembership(organizationId, userId);

    const page = dto.page || 1;
    const limit = dto.limit || 10;
    const skip = (page - 1) * limit;

    const where: any = {
      organizationId,
      deletedAt: null, // Exclude soft-deleted rules by default
    };

    // Include deleted only for ADMIN/MANAGER/OWNER
    if (dto.includeDeleted && this.hasAdminManagerAccess(role)) {
      delete where.deletedAt;
    }

    if (dto.isActive !== undefined) {
      where.isActive = dto.isActive;
    }

    if (dto.scopeType) {
      where.scopeType = dto.scopeType;
    }

    if (dto.q) {
      where.name = {
        contains: dto.q,
        mode: 'insensitive',
      };
    }

    const orderBy: any = {};
    const sortField = dto.sort || 'priority';
    const sortOrder = dto.order || 'desc';
    orderBy[sortField] = sortOrder;

    const [rules, total] = await Promise.all([
      this.prisma.pricingRule.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.pricingRule.count({ where }),
    ]);

    return {
      data: rules,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getRule(organizationId: string, userId: string, ruleId: string) {
    await this.verifyMembership(organizationId, userId);

    const rule = await this.prisma.pricingRule.findFirst({
      where: {
        id: ruleId,
        organizationId,
        deletedAt: null, // Exclude soft-deleted rules
      },
    });

    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }

    return rule;
  }

  async updateRule(
    organizationId: string,
    userId: string,
    ruleId: string,
    dto: UpdatePricingRuleDto,
  ) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can update pricing rules');
    }

    const rule = await this.prisma.pricingRule.findFirst({
      where: {
        id: ruleId,
        organizationId,
        deletedAt: null, // Only update if not deleted
      },
    });

    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }

    if (rule.deletedAt) {
      throw new BadRequestException('Cannot update a deleted pricing rule');
    }

    const updateData: any = {};

    if (dto.name !== undefined) updateData.name = dto.name;
    if (dto.priority !== undefined) updateData.priority = dto.priority;
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.ruleType !== undefined) updateData.ruleType = dto.ruleType;
    if (dto.scopeType !== undefined) updateData.scopeType = dto.scopeType;
    if (dto.matchers !== undefined) updateData.matchers = dto.matchers;
    if (dto.value !== undefined) updateData.value = new Decimal(dto.value);
    if (dto.currency !== undefined) updateData.currency = dto.currency;

    const before = {
      id: rule.id,
      name: rule.name,
      ruleType: rule.ruleType,
      scopeType: rule.scopeType,
      isActive: rule.isActive,
      priority: rule.priority,
    };

    const updated = await this.prisma.pricingRule.update({
      where: { id: ruleId },
      data: updateData,
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.PricingRule,
      entityId: ruleId,
      before,
      after: {
        id: updated.id,
        name: updated.name,
        ruleType: updated.ruleType,
        scopeType: updated.scopeType,
        isActive: updated.isActive,
        priority: updated.priority,
      },
      metadata: {
        ...metadata,
        updatedFields: Object.keys(updateData),
      },
    });

    return updated;
  }

  async deleteRule(organizationId: string, userId: string, ruleId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can delete pricing rules');
    }

    const rule = await this.prisma.pricingRule.findFirst({
      where: {
        id: ruleId,
        organizationId,
        deletedAt: null, // Only delete if not already deleted
      },
    });

    if (!rule) {
      throw new NotFoundException('Pricing rule not found');
    }

    const before = {
      id: rule.id,
      name: rule.name,
      ruleType: rule.ruleType,
      isActive: rule.isActive,
      deletedAt: rule.deletedAt,
    };

    // Soft delete: set deletedAt instead of actual delete
    await this.prisma.pricingRule.update({
      where: { id: ruleId },
      data: { deletedAt: new Date() },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.DELETE,
      entityType: AuditEntityType.PricingRule,
      entityId: ruleId,
      before,
      after: { deletedAt: new Date().toISOString() },
      metadata,
    });

    return { message: 'Pricing rule deleted successfully' };
  }

  async restoreRule(organizationId: string, userId: string, ruleId: string) {
    const { role } = await this.verifyMembership(organizationId, userId);

    if (!this.hasAdminManagerAccess(role)) {
      throw new ForbiddenException('Only admins and managers can restore pricing rules');
    }

    const rule = await this.prisma.pricingRule.findFirst({
      where: {
        id: ruleId,
        organizationId,
        deletedAt: { not: null }, // Only restore if deleted
      },
    });

    if (!rule) {
      throw new NotFoundException('Deleted pricing rule not found');
    }

    const before = {
      id: rule.id,
      name: rule.name,
      ruleType: rule.ruleType,
      deletedAt: rule.deletedAt?.toISOString() || null,
    };

    const restored = await this.prisma.pricingRule.update({
      where: { id: ruleId },
      data: { deletedAt: null },
    });

    // Audit log
    const metadata = this.getRequestMetadata();
    await this.auditLogService.log({
      organizationId,
      actorUserId: userId,
      requestId: metadata.requestId,
      action: AuditAction.RESTORE,
      entityType: AuditEntityType.PricingRule,
      entityId: ruleId,
      before,
      after: {
        id: restored.id,
        deletedAt: null,
      },
      metadata,
    });

    return restored;
  }

  async computePriceForItem(
    organizationId: string,
    userId: string,
    dto: ComputePriceDto,
  ) {
    await this.verifyMembership(organizationId, userId);

    const result = await this.computePrice(
      organizationId,
      dto.stockItemId,
      dto.baseCost,
      dto.context,
      false, // allowStacking = false by default
    );

    return {
      stockItemId: dto.stockItemId,
      basePrice: result.basePrice.toString(),
      finalPrice: result.finalPrice.toString(),
      appliedRule: result.appliedRule
        ? {
            id: result.ruleId,
            name: result.ruleName,
          }
        : null,
    };
  }

  async computeBulk(
    organizationId: string,
    userId: string,
    dto: ComputeBulkDto,
  ) {
    await this.verifyMembership(organizationId, userId);

    const results = await Promise.all(
      dto.items.map((item) =>
        this.computePrice(
          organizationId,
          item.stockItemId,
          item.baseCost,
          { ...dto.context, ...item.context },
          false,
        ).then((result) => ({
          stockItemId: item.stockItemId,
          basePrice: result.basePrice.toString(),
          finalPrice: result.finalPrice.toString(),
          appliedRule: result.appliedRule
            ? {
                id: result.ruleId,
                name: result.ruleName,
              }
            : null,
        })),
      ),
    );

    return {
      results,
    };
  }

  async computeSale(organizationId: string, userId: string, dto: ComputeSaleDto) {
    await this.verifyMembership(organizationId, userId);

    const sale = await this.prisma.sale.findFirst({
      where: {
        id: dto.saleId,
        organizationId,
      },
      include: {
        items: {
          include: {
            stockItem: true,
          },
        },
      },
    });

    if (!sale) {
      throw new NotFoundException('Sale not found');
    }

    const itemResults = await Promise.all(
      sale.items.map(async (item) => {
        if (!item.stockItem) {
          return {
            saleItemId: item.id,
            stockItemId: item.stockItemId,
            model: item.model,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            totalPrice: item.totalPrice.toString(),
            computedPrice: null,
            computedTotal: null,
            appliedRule: null,
            error: 'Stock item not found',
          };
        }

        try {
          const result = await this.computePrice(
            organizationId,
            item.stockItemId!,
            undefined,
            {},
            false,
          );

          const computedUnitPrice = result.finalPrice;
          const computedTotal = computedUnitPrice.mul(item.quantity);

          return {
            saleItemId: item.id,
            stockItemId: item.stockItemId,
            model: item.model,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            totalPrice: item.totalPrice.toString(),
            computedPrice: computedUnitPrice.toString(),
            computedTotal: computedTotal.toString(),
            appliedRule: result.appliedRule
              ? {
                  id: result.ruleId,
                  name: result.ruleName,
                }
              : null,
          };
        } catch (error) {
          return {
            saleItemId: item.id,
            stockItemId: item.stockItemId,
            model: item.model,
            quantity: item.quantity,
            unitPrice: item.unitPrice.toString(),
            totalPrice: item.totalPrice.toString(),
            computedPrice: null,
            computedTotal: null,
            appliedRule: null,
            error: error instanceof Error ? error.message : 'Unknown error',
          };
        }
      }),
    );

    const subtotal = itemResults.reduce(
      (sum, item) => sum + parseFloat(item.computedTotal || item.totalPrice || '0'),
      0,
    );

    return {
      saleId: sale.id,
      saleNumber: sale.saleNumber,
      items: itemResults,
      currentSubtotal: parseFloat(sale.subtotal.toString()),
      computedSubtotal: subtotal,
      discount: parseFloat(sale.discount.toString()),
      currentTotal: parseFloat(sale.total.toString()),
      computedTotal: subtotal - parseFloat(sale.discount.toString()),
    };
  }

  health() {
    return { ok: true, module: 'pricing' };
  }
}
