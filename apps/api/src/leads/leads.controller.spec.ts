import { Test, TestingModule } from '@nestjs/testing';
import { LeadsController } from './leads.controller';
import { LeadsService } from './leads.service';
import { getPermissionsForRole } from '../auth/permissions';
import { Role } from '@remember-me/prisma';

describe('LeadsController', () => {
  let controller: LeadsController;
  const mockLeadsService = {
    health: jest.fn().mockResolvedValue({ ok: true, module: 'leads' }),
    listLeads: jest.fn(),
    createLead: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [LeadsController],
      providers: [
        {
          provide: LeadsService,
          useValue: mockLeadsService,
        },
      ],
    }).compile();

    controller = module.get<LeadsController>(LeadsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('health', () => {
    it('should return health status', async () => {
      const result = await controller.health();
      expect(result).toEqual({ ok: true, module: 'leads' });
    });
  });

  describe('Permissions', () => {
    it('SELLER should have leads.write permission', () => {
      const permissions = getPermissionsForRole(Role.SELLER);
      expect(permissions).toContain('leads.write');
    });

    it('SELLER should have leads.read permission', () => {
      const permissions = getPermissionsForRole(Role.SELLER);
      expect(permissions).toContain('leads.read');
    });

    it('MANAGER should have leads.write permission', () => {
      const permissions = getPermissionsForRole(Role.MANAGER);
      expect(permissions).toContain('leads.write');
    });
  });
});
