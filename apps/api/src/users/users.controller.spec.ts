import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockUsersService = {
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    getUsersInOrganization: jest.fn(),
    getCurrentOrganizationUsers: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /users', () => {
    it('should return users in current organization', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          role: 'ADMIN',
          isActive: true,
          createdAt: new Date(),
        },
      ];

      mockUsersService.getCurrentOrganizationUsers.mockResolvedValue(mockUsers);

      const result = await controller.getCurrentOrganizationUsers('org-1', {
        userId: 'user-1',
        organizationId: 'org-1',
      });

      expect(result).toEqual(mockUsers);
      expect(service.getCurrentOrganizationUsers).toHaveBeenCalledWith('org-1', 'user-1');
    });
  });
});
