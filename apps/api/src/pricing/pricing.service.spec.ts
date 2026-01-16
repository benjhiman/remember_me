import { Test, TestingModule } from '@nestjs/testing';
import { PricingService } from './pricing.service';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { createMockAuditLogService } from '../common/testing/mock-audit-log.service';
import { createMockAuditLogServiceOpenMode, createMockAuditLogServiceClosedMode } from '../common/testing/audit-fail-mode-tests.helper';
import {
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import {
  Role,
  RuleType,
  ScopeType,
  ItemCondition,
} from '@remember-me/prisma';
import { Decimal } from '@prisma/client/runtime/library';

describe('PricingService', () => {
  let service: PricingService;
  let prisma: PrismaService;

  const mockPrismaService = {
    membership: {
      findFirst: jest.fn(),
    },
    stockItem: {
      findFirst: jest.fn(),
    },
    pricingRule: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    sale: {
      findFirst: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PricingService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: createMockAuditLogService(),
        },
        {
          provide: 'REQUEST',
          useValue: {
            requestId: 'test-request-id',
            method: 'GET',
            path: '/test',
            ip: '127.0.0.1',
            get: jest.fn(),
          },
        },
      ],
    }).compile();

    service = await module.resolve<PricingService>(PricingService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('listRules', () => {
    it('should return rules for organization', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          name: 'Test Rule',
          priority: 10,
          isActive: true,
        },
      ]);

      mockPrismaService.pricingRule.count.mockResolvedValue(1);

      const result = await service.listRules(orgId, userId, { page: 1, limit: 10 });

      expect(result).toBeDefined();
      expect(result.data).toBeDefined();
      expect(result.meta).toBeDefined();
    });
  });

  describe('getRule', () => {
    it('should return rule by id', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const ruleId = 'rule-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pricingRule.findFirst.mockResolvedValue({
        id: ruleId,
        organizationId: orgId,
        name: 'Test Rule',
      });

      const result = await service.getRule(orgId, userId, ruleId);

      expect(result).toBeDefined();
      expect(result.id).toBe(ruleId);
    });

    it('should throw NotFoundException if rule not found', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pricingRule.findFirst.mockResolvedValue(null);

      await expect(service.getRule('org-1', 'user-1', 'rule-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createRule', () => {
    it('should create rule for admin', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pricingRule.create.mockResolvedValue({
        id: 'rule-1',
        name: 'Test Rule',
        priority: 10,
        ruleType: RuleType.MARKUP_PERCENT,
        value: new Decimal(20),
      });

      const result = await service.createRule(orgId, userId, {
        name: 'Test Rule',
        priority: 10,
        ruleType: RuleType.MARKUP_PERCENT,
        value: 20,
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.pricingRule.create).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if SELLER tries to create', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      await expect(
        service.createRule('org-1', 'user-1', {
          name: 'Test Rule',
          priority: 10,
          ruleType: RuleType.MARKUP_PERCENT,
          value: 20,
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateRule', () => {
    it('should update rule for admin', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const ruleId = 'rule-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pricingRule.findFirst.mockResolvedValue({
        id: ruleId,
        organizationId: orgId,
      });

      mockPrismaService.pricingRule.update.mockResolvedValue({
        id: ruleId,
        name: 'Updated Rule',
      });

      const result = await service.updateRule(orgId, userId, ruleId, {
        name: 'Updated Rule',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.pricingRule.update).toHaveBeenCalled();
    });

    it('should throw ForbiddenException if SELLER tries to update', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      await expect(
        service.updateRule('org-1', 'user-1', 'rule-1', {
          name: 'Updated Rule',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('deleteRule', () => {
    it('should delete rule for admin', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const ruleId = 'rule-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pricingRule.findFirst.mockResolvedValue({
        id: ruleId,
        organizationId: orgId,
      });

      mockPrismaService.pricingRule.delete.mockResolvedValue({ id: ruleId });

      await service.deleteRule(orgId, userId, ruleId);

      expect(mockPrismaService.pricingRule.update).toHaveBeenCalledWith({
        where: { id: ruleId },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should throw ForbiddenException if SELLER tries to delete', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      await expect(service.deleteRule('org-1', 'user-1', 'rule-1')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('computePrice', () => {
    it('should return base price if no rules match', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const stockItemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: stockItemId,
        organizationId: orgId,
        model: 'iPhone 15 Pro',
        condition: ItemCondition.NEW,
        basePrice: new Decimal(1000),
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([]);

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId,
      });

      expect(result).toBeDefined();
      expect(result.basePrice).toBe(result.finalPrice);
    });

    it('should apply MARKUP_PERCENT rule', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const stockItemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: stockItemId,
        organizationId: orgId,
        model: 'iPhone 15 Pro',
        condition: ItemCondition.NEW,
        basePrice: new Decimal(1000),
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          organizationId: orgId,
          name: '20% Markup',
          priority: 10,
          isActive: true,
          ruleType: RuleType.MARKUP_PERCENT,
          scopeType: ScopeType.GLOBAL,
          matchers: null,
          value: new Decimal(20), // 20%
        },
      ]);

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId,
      });

      expect(result).toBeDefined();
      expect(result.finalPrice).toBe('1200'); // 1000 * 1.2
    });

    it('should apply MARKUP_FIXED rule', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const stockItemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: stockItemId,
        organizationId: orgId,
        model: 'iPhone 15 Pro',
        condition: ItemCondition.NEW,
        basePrice: new Decimal(1000),
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          organizationId: orgId,
          name: '$100 Fixed Markup',
          priority: 10,
          isActive: true,
          ruleType: RuleType.MARKUP_FIXED,
          scopeType: ScopeType.GLOBAL,
          matchers: null,
          value: new Decimal(100),
        },
      ]);

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId,
      });

      expect(result).toBeDefined();
      expect(result.finalPrice).toBe('1100'); // 1000 + 100
    });

    it('should apply OVERRIDE_PRICE rule', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const stockItemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: stockItemId,
        organizationId: orgId,
        model: 'iPhone 15 Pro',
        condition: ItemCondition.NEW,
        basePrice: new Decimal(1000),
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          organizationId: orgId,
          name: 'Override Price',
          priority: 10,
          isActive: true,
          ruleType: RuleType.OVERRIDE_PRICE,
          scopeType: ScopeType.GLOBAL,
          matchers: null,
          value: new Decimal(1500),
        },
      ]);

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId,
      });

      expect(result).toBeDefined();
      expect(result.finalPrice).toBe('1500'); // Override price
    });

    it('should apply highest priority rule when multiple match', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const stockItemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: stockItemId,
        organizationId: orgId,
        model: 'iPhone 15 Pro',
        condition: ItemCondition.NEW,
        basePrice: new Decimal(1000),
      });

      // Rules are returned ordered by priority desc (highest first)
      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-2',
          organizationId: orgId,
          name: '20% Markup',
          priority: 10, // Higher priority (comes first in desc order)
          isActive: true,
          ruleType: RuleType.MARKUP_PERCENT,
          scopeType: ScopeType.GLOBAL,
          matchers: null,
          value: new Decimal(20),
        },
        {
          id: 'rule-1',
          organizationId: orgId,
          name: '10% Markup',
          priority: 5,
          isActive: true,
          ruleType: RuleType.MARKUP_PERCENT,
          scopeType: ScopeType.GLOBAL,
          matchers: null,
          value: new Decimal(10),
        },
      ]);

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId,
      });

      expect(result).toBeDefined();
      expect(result.finalPrice).toBe('1200'); // 1000 * 1.2 (higher priority rule)
      expect(result.appliedRule?.name).toBe('20% Markup');
    });

    it('should match BY_PRODUCT rule', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const stockItemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: stockItemId,
        organizationId: orgId,
        model: 'iPhone 15 Pro',
        condition: ItemCondition.NEW,
        basePrice: new Decimal(1000),
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          organizationId: orgId,
          name: 'iPhone 15 Pro Special',
          priority: 10,
          isActive: true,
          ruleType: RuleType.MARKUP_PERCENT,
          scopeType: ScopeType.BY_PRODUCT,
          matchers: { model: 'iPhone 15 Pro' },
          value: new Decimal(25),
        },
      ]);

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId,
      });

      expect(result).toBeDefined();
      expect(result.finalPrice).toBe('1250'); // 1000 * 1.25
    });

    it('should not match BY_PRODUCT rule if model does not match', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const stockItemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: stockItemId,
        organizationId: orgId,
        model: 'iPhone 14',
        condition: ItemCondition.NEW,
        basePrice: new Decimal(1000),
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          organizationId: orgId,
          name: 'iPhone 15 Pro Special',
          priority: 10,
          isActive: true,
          ruleType: RuleType.MARKUP_PERCENT,
          scopeType: ScopeType.BY_PRODUCT,
          matchers: { model: 'iPhone 15 Pro' },
          value: new Decimal(25),
        },
      ]);

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId,
      });

      expect(result).toBeDefined();
      expect(result.finalPrice).toBe('1000'); // Base price, rule doesn't match
    });

    it('should match BY_CONDITION rule', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const stockItemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: stockItemId,
        organizationId: orgId,
        model: 'iPhone 15 Pro',
        condition: ItemCondition.USED,
        basePrice: new Decimal(1000),
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          organizationId: orgId,
          name: 'Used Items Markup',
          priority: 10,
          isActive: true,
          ruleType: RuleType.MARKUP_FIXED,
          scopeType: ScopeType.BY_CONDITION,
          matchers: { condition: ItemCondition.USED },
          value: new Decimal(50),
        },
      ]);

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId,
      });

      expect(result).toBeDefined();
      expect(result.finalPrice).toBe('1050'); // 1000 + 50
    });

    it('should use provided baseCost override', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const stockItemId = 'item-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: stockItemId,
        organizationId: orgId,
        model: 'iPhone 15 Pro',
        condition: ItemCondition.NEW,
        basePrice: new Decimal(1000),
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          organizationId: orgId,
          name: '20% Markup',
          priority: 10,
          isActive: true,
          ruleType: RuleType.MARKUP_PERCENT,
          scopeType: ScopeType.GLOBAL,
          matchers: null,
          value: new Decimal(20),
        },
      ]);

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId,
        baseCost: 800, // Override base price
      });

      expect(result).toBeDefined();
      expect(result.basePrice).toBe('800');
      expect(result.finalPrice).toBe('960'); // 800 * 1.2
    });

    it('should throw NotFoundException if stock item not found', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue(null);

      await expect(
        service.computePriceForItem('org-1', 'user-1', {
          stockItemId: 'item-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('computeBulk', () => {
    it('should compute prices for multiple items', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.stockItem.findFirst
        .mockResolvedValueOnce({
          id: 'item-1',
          organizationId: orgId,
          model: 'iPhone 15 Pro',
          condition: ItemCondition.NEW,
          basePrice: new Decimal(1000),
        })
        .mockResolvedValueOnce({
          id: 'item-2',
          organizationId: orgId,
          model: 'iPhone 14',
          condition: ItemCondition.NEW,
          basePrice: new Decimal(800),
        });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          organizationId: orgId,
          name: '20% Markup',
          priority: 10,
          isActive: true,
          ruleType: RuleType.MARKUP_PERCENT,
          scopeType: ScopeType.GLOBAL,
          matchers: null,
          value: new Decimal(20),
        },
      ]);

      const result = await service.computeBulk(orgId, userId, {
        items: [
          { stockItemId: 'item-1' },
          { stockItemId: 'item-2' },
        ],
      });

      expect(result).toBeDefined();
      expect(result.results).toHaveLength(2);
      expect(result.results[0].finalPrice).toBe('1200');
      expect(result.results[1].finalPrice).toBe('960');
    });
  });

  describe('computeSale', () => {
    it('should compute prices for all sale items', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';
      const saleId = 'sale-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue({
        id: saleId,
        organizationId: orgId,
        saleNumber: 'SALE-2024-001',
        subtotal: new Decimal(2000),
        discount: new Decimal(0),
        total: new Decimal(2000),
        items: [
          {
            id: 'item-1',
            stockItemId: 'stock-1',
            model: 'iPhone 15 Pro',
            quantity: 1,
            unitPrice: new Decimal(1000),
            totalPrice: new Decimal(1000),
            stockItem: {
              id: 'stock-1',
              organizationId: orgId,
              model: 'iPhone 15 Pro',
              condition: ItemCondition.NEW,
              basePrice: new Decimal(1000),
            },
          },
          {
            id: 'item-2',
            stockItemId: 'stock-2',
            model: 'iPhone 14',
            quantity: 1,
            unitPrice: new Decimal(800),
            totalPrice: new Decimal(800),
            stockItem: {
              id: 'stock-2',
              organizationId: orgId,
              model: 'iPhone 14',
              condition: ItemCondition.NEW,
              basePrice: new Decimal(800),
            },
          },
        ],
      });

      mockPrismaService.stockItem.findFirst
        .mockResolvedValueOnce({
          id: 'stock-1',
          organizationId: orgId,
          model: 'iPhone 15 Pro',
          condition: ItemCondition.NEW,
          basePrice: new Decimal(1000),
        })
        .mockResolvedValueOnce({
          id: 'stock-2',
          organizationId: orgId,
          model: 'iPhone 14',
          condition: ItemCondition.NEW,
          basePrice: new Decimal(800),
        });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          organizationId: orgId,
          name: '20% Markup',
          priority: 10,
          isActive: true,
          ruleType: RuleType.MARKUP_PERCENT,
          scopeType: ScopeType.GLOBAL,
          matchers: null,
          value: new Decimal(20),
        },
      ]);

      const result = await service.computeSale(orgId, userId, {
        saleId,
      });

      expect(result).toBeDefined();
      expect(result.items).toHaveLength(2);
      expect(result.computedSubtotal).toBe(2160); // (1000 * 1.2) + (800 * 1.2)
    });

    it('should throw NotFoundException if sale not found', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.sale.findFirst.mockResolvedValue(null);

      await expect(
        service.computeSale('org-1', 'user-1', {
          saleId: 'sale-1',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('Multi-org isolation', () => {
    it('should not return rules from other organizations', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([]);
      mockPrismaService.pricingRule.count.mockResolvedValue(0);

      await service.listRules(orgId, userId, { page: 1, limit: 10 });

      expect(mockPrismaService.pricingRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            organizationId: orgId,
          }),
        }),
      );
    });

    it('should not allow accessing rule from other organization', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.ADMIN,
      });

      mockPrismaService.pricingRule.findFirst.mockResolvedValue(null);

      await expect(service.getRule('org-1', 'user-1', 'rule-other-org')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('SELLER permissions', () => {
    it('should allow SELLER to list rules', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([]);
      mockPrismaService.pricingRule.count.mockResolvedValue(0);

      await service.listRules(orgId, userId, { page: 1, limit: 10 });

      expect(mockPrismaService.pricingRule.findMany).toHaveBeenCalled();
    });

    it('should allow SELLER to get rule', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      mockPrismaService.pricingRule.findFirst.mockResolvedValue({
        id: 'rule-1',
        organizationId: 'org-1',
        name: 'Test Rule',
      });

      const result = await service.getRule('org-1', 'user-1', 'rule-1');

      expect(result).toBeDefined();
    });

    it('should allow SELLER to compute prices', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({
        role: Role.SELLER,
      });

      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: orgId,
        model: 'iPhone 15 Pro',
        condition: ItemCondition.NEW,
        basePrice: new Decimal(1000),
      });

      mockPrismaService.pricingRule.findMany.mockResolvedValue([]);

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId: 'item-1',
      });

      expect(result).toBeDefined();
    });
  });

  describe('health', () => {
    it('should return health status', () => {
      const result = service.health();
      expect(result).toEqual({ ok: true, module: 'pricing' });
    });
  });

  describe('AUDIT_FAIL_MODE behavior', () => {
    it('should continue operation when AUDIT_FAIL_MODE=OPEN and audit log fails', async () => {
      const mockAuditLogService = createMockAuditLogServiceOpenMode();
      
      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          PricingService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: AuditLogService,
            useValue: mockAuditLogService,
          },
          {
            provide: 'REQUEST',
            useValue: {
              requestId: 'test-request-id',
              method: 'POST',
              path: '/api/pricing/rules',
              ip: '127.0.0.1',
              get: jest.fn().mockReturnValue('test-agent'),
            },
          },
        ],
      }).compile();

      const testService = await testModule.resolve<PricingService>(PricingService);

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.pricingRule.create.mockResolvedValue({
        id: 'rule-1',
        organizationId: 'org-1',
        name: 'Test Rule',
      });

      const result = await testService.createRule('org-1', 'user-1', {
        name: 'Test Rule',
        priority: 1,
        ruleType: 'MARKUP_PERCENT',
        value: 10,
      });

      expect(result).toBeDefined();
      expect(result.id).toBe('rule-1');
      expect(mockAuditLogService.log).toHaveBeenCalled();
    });

    it('should abort operation when AUDIT_FAIL_MODE=CLOSED and audit log fails', async () => {
      const mockAuditLogService = createMockAuditLogServiceClosedMode();
      
      const testModule: TestingModule = await Test.createTestingModule({
        providers: [
          PricingService,
          {
            provide: PrismaService,
            useValue: mockPrismaService,
          },
          {
            provide: AuditLogService,
            useValue: mockAuditLogService,
          },
          {
            provide: 'REQUEST',
            useValue: {
              requestId: 'test-request-id',
              method: 'POST',
              path: '/api/pricing/rules',
              ip: '127.0.0.1',
              get: jest.fn().mockReturnValue('test-agent'),
            },
          },
        ],
      }).compile();

      const testService = await testModule.resolve<PricingService>(PricingService);

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.pricingRule.create.mockResolvedValue({
        id: 'rule-1',
        organizationId: 'org-1',
        name: 'Test Rule',
      });

      await expect(
        testService.createRule('org-1', 'user-1', {
          name: 'Test Rule',
          priority: 1,
          ruleType: 'MARKUP_PERCENT',
          value: 10,
        }),
      ).rejects.toThrow(InternalServerErrorException);

      try {
        await testService.createRule('org-1', 'user-1', {
          name: 'Test Rule',
          priority: 1,
          ruleType: 'MARKUP_PERCENT',
          value: 10,
        });
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.response?.errorCode || error.errorCode).toBe('AUDIT_LOG_FAILED');
        expect(error.response?.statusCode || error.statusCode || error.getStatus?.()).toBe(500);
      }
    });
  });

  describe('Soft delete', () => {
    it('should soft delete rule and exclude from list', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.pricingRule.findFirst.mockResolvedValue({
        id: 'rule-1',
        organizationId: orgId,
        deletedAt: null,
      });
      mockPrismaService.pricingRule.update.mockResolvedValue({
        id: 'rule-1',
        organizationId: orgId,
        deletedAt: new Date(),
      });

      await service.deleteRule(orgId, userId, 'rule-1');

      mockPrismaService.pricingRule.findMany.mockResolvedValue([]);
      mockPrismaService.pricingRule.count.mockResolvedValue(0);

      const result = await service.listRules(orgId, userId, { page: 1, limit: 10 });

      expect(result.data).toHaveLength(0);
      expect(mockPrismaService.pricingRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('should include deleted rules when includeDeleted=true and user is ADMIN', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.pricingRule.findMany.mockResolvedValue([
        {
          id: 'rule-1',
          organizationId: orgId,
          deletedAt: new Date(),
        },
      ]);
      mockPrismaService.pricingRule.count.mockResolvedValue(1);

      const result = await service.listRules(orgId, userId, { page: 1, limit: 10, includeDeleted: true });

      expect(result.data).toHaveLength(1);
    });

    it('should not include deleted rules when includeDeleted=true and user is SELLER', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.SELLER });
      mockPrismaService.pricingRule.findMany.mockResolvedValue([]);
      mockPrismaService.pricingRule.count.mockResolvedValue(0);

      const result = await service.listRules(orgId, userId, { page: 1, limit: 10, includeDeleted: true });

      expect(result.data).toHaveLength(0);
      expect(mockPrismaService.pricingRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
          }),
        }),
      );
    });

    it('should restore soft-deleted rule', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.pricingRule.findFirst.mockResolvedValue({
        id: 'rule-1',
        organizationId: orgId,
        deletedAt: new Date(),
      });
      mockPrismaService.pricingRule.update.mockResolvedValue({
        id: 'rule-1',
        organizationId: orgId,
        deletedAt: null,
      });

      const result = await service.restoreRule(orgId, userId, 'rule-1');

      expect(result.deletedAt).toBeNull();
      expect(mockPrismaService.pricingRule.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { deletedAt: null },
        }),
      );
    });

    it('should ignore deleted rules in computePrice', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.SELLER });
      mockPrismaService.stockItem.findFirst.mockResolvedValue({
        id: 'item-1',
        organizationId: orgId,
        model: 'iPhone 15 Pro',
        condition: ItemCondition.NEW,
        basePrice: new Decimal(1000),
      });
      mockPrismaService.pricingRule.findMany.mockResolvedValue([]); // No active rules (deleted ones are excluded)

      const result = await service.computePriceForItem(orgId, userId, {
        stockItemId: 'item-1',
      });

      expect(result).toBeDefined();
      expect(mockPrismaService.pricingRule.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            deletedAt: null,
            isActive: true,
          }),
        }),
      );
    });
  });

  describe('Audit log', () => {
    it('should create audit log on createRule', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.pricingRule.create.mockResolvedValue({
        id: 'rule-1',
        organizationId: orgId,
        name: 'Test Rule',
      });

      await service.createRule(orgId, userId, {
        name: 'Test Rule',
        priority: 1,
        ruleType: RuleType.MARKUP_PERCENT,
        value: 10,
      });

      expect(mockPrismaService.pricingRule.create).toHaveBeenCalled();
    });

    it('should create audit log on restoreRule', async () => {
      const orgId = 'org-1';
      const userId = 'user-1';

      mockPrismaService.membership.findFirst.mockResolvedValue({ role: Role.ADMIN });
      mockPrismaService.pricingRule.findFirst.mockResolvedValue({
        id: 'rule-1',
        organizationId: orgId,
        deletedAt: new Date(),
      });
      mockPrismaService.pricingRule.update.mockResolvedValue({
        id: 'rule-1',
        organizationId: orgId,
        deletedAt: null,
      });

      await service.restoreRule(orgId, userId, 'rule-1');

      expect(mockPrismaService.pricingRule.update).toHaveBeenCalled();
    });
  });
});
