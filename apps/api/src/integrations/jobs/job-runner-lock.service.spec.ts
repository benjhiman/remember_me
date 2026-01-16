import { Test, TestingModule } from '@nestjs/testing';
import { JobRunnerLockService } from './job-runner-lock.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('JobRunnerLockService', () => {
  let service: JobRunnerLockService;
  let prisma: PrismaService;

  const mockPrismaService = {
    $queryRaw: jest.fn(),
    jobRunnerLock: {
      upsert: jest.fn(),
      deleteMany: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobRunnerLockService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<JobRunnerLockService>(JobRunnerLockService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('acquireLock', () => {
    it('should acquire lock when available', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([{ pg_try_advisory_lock: true }]);
      mockPrismaService.jobRunnerLock.upsert.mockResolvedValueOnce({});

      const result = await service.acquireLock(60000);

      expect(result).toBe(true);
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(mockPrismaService.jobRunnerLock.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: expect.objectContaining({
          id: 'singleton',
          lockedBy: expect.any(String),
          expiresAt: expect.any(Date),
        }),
        update: expect.objectContaining({
          lockedBy: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should return false when lock is already held', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([{ pg_try_advisory_lock: false }]);

      const result = await service.acquireLock(60000);

      expect(result).toBe(false);
      expect(mockPrismaService.jobRunnerLock.upsert).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
      mockPrismaService.$queryRaw.mockRejectedValueOnce(new Error('DB error'));

      const result = await service.acquireLock(60000);

      expect(result).toBe(false);
    });
  });

  describe('releaseLock', () => {
    it('should release lock and delete record', async () => {
      mockPrismaService.$queryRaw.mockResolvedValueOnce([{}]);
      mockPrismaService.jobRunnerLock.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.releaseLock();

      expect(mockPrismaService.$queryRaw).toHaveBeenCalled();
      expect(mockPrismaService.jobRunnerLock.deleteMany).toHaveBeenCalledWith({
        where: {
          id: 'singleton',
          lockedBy: expect.any(String),
        },
      });
    });
  });

  describe('cleanupExpiredLock', () => {
    it('should release expired lock', async () => {
      const expiredLock = {
        id: 'singleton',
        lockedBy: 'other-instance',
        lockedAt: new Date(Date.now() - 200000),
        expiresAt: new Date(Date.now() - 100000), // Expired
      };

      mockPrismaService.jobRunnerLock.findUnique.mockResolvedValueOnce(expiredLock);
      mockPrismaService.$queryRaw.mockResolvedValueOnce([{}]);
      mockPrismaService.jobRunnerLock.deleteMany.mockResolvedValueOnce({ count: 1 });

      await service.cleanupExpiredLock();

      expect(mockPrismaService.jobRunnerLock.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.$queryRaw).toHaveBeenCalled(); // releaseLock called
    });

    it('should not release non-expired lock', async () => {
      const validLock = {
        id: 'singleton',
        lockedBy: 'other-instance',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000), // Not expired
      };

      mockPrismaService.jobRunnerLock.findUnique.mockResolvedValueOnce(validLock);

      await service.cleanupExpiredLock();

      expect(mockPrismaService.jobRunnerLock.findUnique).toHaveBeenCalled();
      expect(mockPrismaService.$queryRaw).not.toHaveBeenCalled();
    });
  });

  describe('getLockInfo', () => {
    it('should return lock info when lock exists', async () => {
      const lock = {
        id: 'singleton',
        lockedBy: 'instance-123',
        lockedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
      };

      mockPrismaService.jobRunnerLock.findUnique.mockResolvedValueOnce(lock);

      const result = await service.getLockInfo();

      expect(result).toEqual({
        lockedBy: 'instance-123',
        lockedAt: lock.lockedAt,
        expiresAt: lock.expiresAt,
      });
    });

    it('should return null when no lock exists', async () => {
      mockPrismaService.jobRunnerLock.findUnique.mockResolvedValueOnce(null);

      const result = await service.getLockInfo();

      expect(result).toBeNull();
    });
  });
});
