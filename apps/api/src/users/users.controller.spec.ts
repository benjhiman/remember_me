import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { PrismaService } from '../prisma/prisma.service';
import { getPermissionsForRole } from '../auth/permissions';
import { Role } from '@remember-me/prisma';

describe('UsersController', () => {
  let controller: UsersController;
  let prisma: PrismaService;
  let usersService: UsersService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
    },
  };

  const mockUsersService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    getCurrentOrganizationUsers: jest.fn(),
    getUsersInOrganization: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        { provide: UsersService, useValue: mockUsersService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    prisma = module.get<PrismaService>(PrismaService);
    usersService = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users/me', () => {
    it('should return user profile with permissions', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        avatar: null,
      };

      const mockOrg = {
        id: 'org-123',
        name: 'Test Org',
        slug: 'test-org',
      };

      const mockMembership = {
        role: Role.SELLER,
      };

      mockUsersService.getProfile.mockResolvedValue(mockUser);
      mockPrisma.organization.findUnique.mockResolvedValue(mockOrg);
      mockPrisma.membership.findFirst.mockResolvedValue(mockMembership);

      const result = await controller.getProfile(
        { userId: 'user-123', role: Role.SELLER, organizationId: 'org-123' },
        'org-123',
      );

      expect(result).toEqual({
        user: mockUser,
        organization: mockOrg,
        role: Role.SELLER,
        permissions: getPermissionsForRole(Role.SELLER),
      });
    });
  });
});
