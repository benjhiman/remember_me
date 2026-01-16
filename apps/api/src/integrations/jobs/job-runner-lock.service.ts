import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JobRunnerLockService {
  private readonly logger = new Logger(JobRunnerLockService.name);
  private readonly instanceId: string;

  constructor(private readonly prisma: PrismaService) {
    // Generate unique instance ID: hostname + pid
    this.instanceId = `${require('os').hostname()}-${process.pid}`;
  }

  /**
   * Acquire distributed lock using PostgreSQL advisory lock
   * Returns true if lock acquired, false if already locked
   */
  async acquireLock(ttlMs: number): Promise<boolean> {
    try {
      // Use PostgreSQL advisory lock (key: 1 for job runner)
      // pg_try_advisory_lock returns true if lock acquired, false if already locked
      const result = await this.prisma.$queryRaw<Array<{ pg_try_advisory_lock: boolean }>>`
        SELECT pg_try_advisory_lock(1) as "pg_try_advisory_lock"
      `;

      if (!result[0]?.pg_try_advisory_lock) {
        // Lock already held by another instance
        this.logger.debug(`Lock acquisition failed: already held by another instance`);
        return false;
      }

      // Lock acquired, update lock record
      const expiresAt = new Date(Date.now() + ttlMs);
      await this.prisma.jobRunnerLock.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          lockedBy: this.instanceId,
          lockedAt: new Date(),
          expiresAt,
        },
        update: {
          lockedBy: this.instanceId,
          lockedAt: new Date(),
          expiresAt,
        },
      });

      this.logger.debug(`Lock acquired by instance ${this.instanceId}, expires at ${expiresAt.toISOString()}`);
      return true;
    } catch (error) {
      this.logger.error(`Error acquiring lock: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Release distributed lock
   */
  async releaseLock(): Promise<void> {
    try {
      // Release advisory lock
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(1)
      `;

      // Clear lock record
      await this.prisma.jobRunnerLock.deleteMany({
        where: {
          id: 'singleton',
          lockedBy: this.instanceId,
        },
      });

      this.logger.debug(`Lock released by instance ${this.instanceId}`);
    } catch (error) {
      this.logger.error(`Error releasing lock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if lock is expired and clean it up
   */
  async cleanupExpiredLock(): Promise<void> {
    try {
      const lock = await this.prisma.jobRunnerLock.findUnique({
        where: { id: 'singleton' },
      });

      if (lock && lock.expiresAt < new Date()) {
        // Lock expired, release it
        this.logger.warn(`Found expired lock held by ${lock.lockedBy}, releasing...`);
        await this.releaseLock();
      }
    } catch (error) {
      this.logger.error(`Error cleaning up expired lock: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current lock holder info
   */
  async getLockInfo(): Promise<{ lockedBy: string; lockedAt: Date; expiresAt: Date } | null> {
    try {
      const lock = await this.prisma.jobRunnerLock.findUnique({
        where: { id: 'singleton' },
      });

      if (!lock) {
        return null;
      }

      return {
        lockedBy: lock.lockedBy,
        lockedAt: lock.lockedAt,
        expiresAt: lock.expiresAt,
      };
    } catch (error) {
      this.logger.error(`Error getting lock info: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
}
