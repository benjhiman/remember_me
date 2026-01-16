import { Test, TestingModule } from '@nestjs/testing';
import { JobRunnerLockService } from './job-runner-lock.service';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaModule } from '../../prisma/prisma.module';

/**
 * E2E test for distributed lock
 * Tests that two instances cannot acquire lock simultaneously
 * 
 * NOTE: These tests require a real database connection.
 * Run with: DATABASE_URL=postgresql://... pnpm test --testPathPattern="job-runner-lock.service.e2e"
 */
describe.skip('JobRunnerLockService E2E', () => {
  let service1: JobRunnerLockService;
  let service2: JobRunnerLockService;
  let prisma: PrismaService;
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [JobRunnerLockService],
    }).compile();

    prisma = module.get<PrismaService>(PrismaService);
    service1 = module.get<JobRunnerLockService>(JobRunnerLockService);
    
    // Create second instance (simulating different worker)
    const module2 = await Test.createTestingModule({
      imports: [PrismaModule],
      providers: [JobRunnerLockService],
    }).compile();
    service2 = module2.get<JobRunnerLockService>(JobRunnerLockService);
  });

  afterAll(async () => {
    // Cleanup: release any locks
    try {
      await service1.releaseLock();
      await service2.releaseLock();
    } catch (error) {
      // Ignore cleanup errors
    }
    await module.close();
  });

  beforeEach(async () => {
    // Clean up locks before each test
    await prisma.jobRunnerLock.deleteMany({});
    await prisma.$executeRaw`SELECT pg_advisory_unlock_all()`;
  });

  it('should prevent two instances from acquiring lock simultaneously', async () => {
    // Instance 1 acquires lock
    const lock1 = await service1.acquireLock(60000);
    expect(lock1).toBe(true);

    // Instance 2 tries to acquire lock (should fail)
    const lock2 = await service2.acquireLock(60000);
    expect(lock2).toBe(false);

    // Instance 1 releases lock
    await service1.releaseLock();

    // Now instance 2 can acquire
    const lock2After = await service2.acquireLock(60000);
    expect(lock2After).toBe(true);

    await service2.releaseLock();
  });

  it('should allow lock acquisition after expiration cleanup', async () => {
    // Acquire lock with short TTL
    const lock1 = await service1.acquireLock(1000); // 1 second
    expect(lock1).toBe(true);

    // Wait for expiration
    await new Promise((resolve) => setTimeout(resolve, 1100));

    // Cleanup expired lock
    await service2.cleanupExpiredLock();

    // Now instance 2 should be able to acquire
    const lock2 = await service2.acquireLock(60000);
    expect(lock2).toBe(true);

    await service2.releaseLock();
  });
});
