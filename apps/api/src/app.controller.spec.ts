import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let controller: AppController;
  let service: AppService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    controller = module.get<AppController>(AppController);
    service = module.get<AppService>(AppService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(controller.getHello()).toBe('Hello World!');
    });
  });

  describe('getExtendedHealth', () => {
    it('should return health status with db ok', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.getExtendedHealth();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('db', 'ok');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('env');
      expect(typeof result.uptime).toBe('number');
    });

    it('should return db error if database query fails', async () => {
      mockPrismaService.$queryRaw.mockRejectedValue(new Error('Database connection failed'));

      const result = await controller.getExtendedHealth();

      expect(result).toHaveProperty('status', 'ok');
      expect(result).toHaveProperty('db', 'error');
      expect(result).toHaveProperty('uptime');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('env');
    });

    it('should not expose sensitive environment variables', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.getExtendedHealth();

      expect(result).toHaveProperty('env');
      expect(result.env).toBe(process.env.NODE_ENV || 'development');
      // Should not include DATABASE_URL, JWT_SECRET, etc.
      expect(Object.keys(result)).not.toContain('DATABASE_URL');
      expect(Object.keys(result)).not.toContain('JWT_SECRET');
      expect(Object.keys(result).length).toBe(5); // status, db, uptime, version, env only
    });

    it('should return valid uptime in seconds', async () => {
      mockPrismaService.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.getExtendedHealth();

      expect(result.uptime).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(result.uptime)).toBe(true);
    });
  });
});
