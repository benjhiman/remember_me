import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundException, ForbiddenException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;

  const mockPrismaService = {
    membership: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCurrentOrganizationUsers', () => {
    const orgId = 'org-1';
    const userId = 'user-1';

    it('should return users in organization', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        id: 'membership-1',
        userId,
        organizationId: orgId,
        role: 'ADMIN',
      });

      mockPrismaService.membership.findMany.mockResolvedValue([
        {
          id: 'membership-1',
          role: 'ADMIN',
          createdAt: new Date(),
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            name: 'User 1',
            avatar: null,
            createdAt: new Date(),
          },
        },
        {
          id: 'membership-2',
          role: 'SELLER',
          createdAt: new Date(),
          user: {
            id: 'user-2',
            email: 'user2@example.com',
            name: 'User 2',
            avatar: null,
            createdAt: new Date(),
          },
        },
      ]);

      const result = await service.getCurrentOrganizationUsers(orgId, userId);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        id: 'user-1',
        email: 'user1@example.com',
        name: 'User 1',
        role: 'ADMIN',
        isActive: true,
      });
      expect(mockPrismaService.membership.findFirst).toHaveBeenCalledWith({
        where: { organizationId: orgId, userId },
      });
      expect(mockPrismaService.membership.findMany).toHaveBeenCalledWith({
        where: { organizationId: orgId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatar: true,
              createdAt: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should throw ForbiddenException if user is not member', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue(null);

      await expect(service.getCurrentOrganizationUsers(orgId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should enforce multi-org isolation', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        id: 'membership-1',
        userId,
        organizationId: 'org-2', // Different org
        role: 'ADMIN',
      });

      mockPrismaService.membership.findMany.mockResolvedValue([]);

      // Should only return users from org-1, not org-2
      await service.getCurrentOrganizationUsers('org-1', userId);

      expect(mockPrismaService.membership.findMany).toHaveBeenCalledWith({
        where: { organizationId: 'org-1' },
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should return correct shape', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue({
        id: 'membership-1',
        userId,
        organizationId: orgId,
        role: 'ADMIN',
      });

      mockPrismaService.membership.findMany.mockResolvedValue([
        {
          id: 'membership-1',
          role: 'ADMIN',
          createdAt: new Date('2024-01-01'),
          user: {
            id: 'user-1',
            email: 'user1@example.com',
            name: 'User 1',
            avatar: 'avatar.jpg',
            createdAt: new Date('2024-01-01'),
          },
        },
      ]);

      const result = await service.getCurrentOrganizationUsers(orgId, userId);

      expect(result[0]).toHaveProperty('id');
      expect(result[0]).toHaveProperty('email');
      expect(result[0]).toHaveProperty('name');
      expect(result[0]).toHaveProperty('avatar');
      expect(result[0]).toHaveProperty('role');
      expect(result[0]).toHaveProperty('isActive');
      expect(result[0]).toHaveProperty('createdAt');
    });
  });
});
