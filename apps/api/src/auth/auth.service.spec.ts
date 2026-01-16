import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@remember-me/prisma';
import * as bcrypt from 'bcrypt';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwtService: JwtService;
  let configService: ConfigService;

  const mockPrismaService = {
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    membership: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    refreshToken: {
      create: jest.fn(),
      findUnique: jest.fn(),
      deleteMany: jest.fn(),
    },
    invitation: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
    verify: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        JWT_SECRET: 'test-secret',
        JWT_REFRESH_SECRET: 'test-refresh-secret',
        JWT_EXPIRES_IN: '15m',
        JWT_REFRESH_EXPIRES_IN: '7d',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwtService = module.get<JwtService>(JwtService);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return tokens and user when user has single organization', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        name: 'Test User',
        memberships: [
          {
            organizationId: 'org-1',
            role: Role.OWNER,
            organization: {
              id: 'org-1',
              name: 'Test Org',
            },
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-token');

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user?.organizationId).toBe('org-1');
      expect(result.requiresOrgSelection).toBeUndefined();
    });

    it('should return organizations list and tempToken when user has multiple organizations', async () => {
      const mockUser = {
        id: 'user-1',
        email: 'test@example.com',
        passwordHash: await bcrypt.hash('password123', 10),
        name: 'Test User',
        memberships: [
          {
            organizationId: 'org-1',
            role: Role.OWNER,
            organization: {
              id: 'org-1',
              name: 'Org 1',
              slug: 'org-1',
            },
          },
          {
            organizationId: 'org-2',
            role: Role.ADMIN,
            organization: {
              id: 'org-2',
              name: 'Org 2',
              slug: 'org-2',
            },
          },
        ],
      };

      mockPrismaService.user.findUnique.mockResolvedValue(mockUser);
      mockJwtService.sign.mockReturnValue('mock-temp-token');

      const result = await service.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.requiresOrgSelection).toBe(true);
      expect(result.organizations).toHaveLength(2);
      expect(result.tempToken).toBeDefined();
      expect(result.accessToken).toBeUndefined();
    });
  });

  describe('selectOrganization', () => {
    it('should return tokens when valid membership exists', async () => {
      const mockMembership = {
        id: 'membership-1',
        userId: 'user-1',
        organizationId: 'org-1',
        role: Role.OWNER,
        organization: {
          id: 'org-1',
          name: 'Test Org',
        },
        user: {
          id: 'user-1',
          email: 'test@example.com',
          name: 'Test User',
        },
      };

      mockPrismaService.membership.findFirst.mockResolvedValue(mockMembership);
      mockJwtService.sign.mockReturnValue('mock-token');
      mockPrismaService.refreshToken.create.mockResolvedValue({});

      const result = await service.selectOrganization('user-1', {
        organizationId: 'org-1',
      });

      expect(result).toHaveProperty('accessToken');
      expect(result).toHaveProperty('refreshToken');
      expect(result).toHaveProperty('user');
      expect(result.user.organizationId).toBe('org-1');
    });

    it('should throw ForbiddenException when user is not a member', async () => {
      mockPrismaService.membership.findFirst.mockResolvedValue(null);

      await expect(
        service.selectOrganization('user-1', {
          organizationId: 'org-1',
        })
      ).rejects.toThrow('User is not a member of this organization');
    });
  });
});
