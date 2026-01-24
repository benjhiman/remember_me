import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from './ledger.service';
import { PrismaService } from '../prisma/prisma.service';
import { REQUEST } from '@nestjs/core';

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: PrismaService;

  const mockPrisma = {
    ledgerAccount: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: REQUEST,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createAccount', () => {
    it('should create account with org scoping', async () => {
      const orgId = 'org-123';
      const dto = {
        code: '1000',
        name: 'Cash',
        type: 'ASSET' as const,
        isActive: true,
      };

      mockPrisma.ledgerAccount.findFirst.mockResolvedValue(null);
      mockPrisma.ledgerAccount.create.mockResolvedValue({
        id: 'account-123',
        organizationId: orgId,
        ...dto,
      });

      const result = await service.createAccount(orgId, dto);

      expect(mockPrisma.ledgerAccount.findFirst).toHaveBeenCalledWith({
        where: { organizationId: orgId, code: dto.code },
      });
      expect(mockPrisma.ledgerAccount.create).toHaveBeenCalledWith({
        data: {
          organizationId: orgId,
          ...dto,
        },
      });
      expect(result.organizationId).toBe(orgId);
    });

    it('should throw ConflictException if code exists', async () => {
      const orgId = 'org-123';
      const dto = {
        code: '1000',
        name: 'Cash',
        type: 'ASSET' as const,
      };

      mockPrisma.ledgerAccount.findFirst.mockResolvedValue({
        id: 'existing-account',
        code: '1000',
      });

      await expect(service.createAccount(orgId, dto)).rejects.toThrow('already exists');
    });
  });

  describe('listAccounts', () => {
    it('should list accounts with org scoping', async () => {
      const orgId = 'org-123';
      const dto = { page: 1, limit: 20 };

      mockPrisma.ledgerAccount.findMany.mockResolvedValue([
        { id: 'account-1', organizationId: orgId, code: '1000', name: 'Cash' },
      ]);
      mockPrisma.ledgerAccount.count.mockResolvedValue(1);

      const result = await service.listAccounts(orgId, dto);

      expect(mockPrisma.ledgerAccount.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        skip: 0,
        take: 20,
        orderBy: { code: 'asc' },
      });
      expect(result.items).toHaveLength(1);
      expect(result.items[0].organizationId).toBe(orgId);
    });

    it('should filter by type and isActive', async () => {
      const orgId = 'org-123';
      const dto = { type: 'ASSET' as const, isActive: true };

      mockPrisma.ledgerAccount.findMany.mockResolvedValue([]);
      mockPrisma.ledgerAccount.count.mockResolvedValue(0);

      await service.listAccounts(orgId, dto);

      expect(mockPrisma.ledgerAccount.findMany).toHaveBeenCalledWith({
        where: {
          organizationId: orgId,
          type: 'ASSET',
          isActive: true,
        },
        skip: 0,
        take: 20,
        orderBy: { code: 'asc' },
      });
    });
  });

  describe('getAccount', () => {
    it('should return account with org scoping', async () => {
      const orgId = 'org-123';
      const accountId = 'account-123';

      mockPrisma.ledgerAccount.findFirst.mockResolvedValue({
        id: accountId,
        organizationId: orgId,
        code: '1000',
        name: 'Cash',
      });

      const result = await service.getAccount(orgId, accountId);

      expect(mockPrisma.ledgerAccount.findFirst).toHaveBeenCalledWith({
        where: { id: accountId, organizationId: orgId },
      });
      expect(result.organizationId).toBe(orgId);
    });

    it('should throw NotFoundException for cross-org access', async () => {
      const orgId = 'org-123';
      const accountId = 'account-456';

      mockPrisma.ledgerAccount.findFirst.mockResolvedValue(null);

      await expect(service.getAccount(orgId, accountId)).rejects.toThrow('not found');
    });
  });
});
