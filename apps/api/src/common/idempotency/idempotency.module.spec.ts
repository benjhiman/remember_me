import { Test, TestingModule } from '@nestjs/testing';
import { IdempotencyModule } from './idempotency.module';
import { IdempotencyService } from './idempotency.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { PrismaService } from '../../prisma/prisma.service';

describe('IdempotencyModule', () => {
  const mockPrismaService = {
    idempotencyKey: {
      deleteMany: jest.fn().mockResolvedValue({ count: 5 }),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call cleanupExpired on module init', async () => {
    const testModule = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [
        IdempotencyService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    const service = testModule.get(IdempotencyService);
    const moduleInstance = new IdempotencyModule(service);
    await moduleInstance.onModuleInit();

    expect(mockPrismaService.idempotencyKey.deleteMany).toHaveBeenCalledTimes(1);
    await testModule.close();
  });

  it('should not delete non-expired keys', async () => {
    const mockPrisma = {
      idempotencyKey: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };

    const service = new IdempotencyService(mockPrisma as any);

    const count = await service.cleanupExpired();

    expect(count).toBe(0);
    expect(mockPrisma.idempotencyKey.deleteMany).toHaveBeenCalledWith({
      where: {
        expiresAt: {
          lt: expect.any(Date),
        },
      },
    });

    // Verify it only deletes expired (lt: now)
    const call = mockPrisma.idempotencyKey.deleteMany.mock.calls[0][0];
    const now = new Date();
    expect(call.where.expiresAt.lt.getTime()).toBeLessThanOrEqual(now.getTime());
  });
});
