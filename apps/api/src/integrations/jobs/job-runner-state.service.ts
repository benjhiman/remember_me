import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class JobRunnerStateService {
  private readonly logger = new Logger(JobRunnerStateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Update job runner state after a run
   */
  async updateState(
    lastRunAt: Date,
    lastRunDurationMs: number,
    lastRunJobCount: number,
    lastRunError?: string,
  ): Promise<void> {
    try {
      await this.prisma.jobRunnerState.upsert({
        where: { id: 'singleton' },
        create: {
          id: 'singleton',
          lastRunAt,
          lastRunDurationMs,
          lastRunJobCount,
          lastRunError,
        },
        update: {
          lastRunAt,
          lastRunDurationMs,
          lastRunJobCount,
          lastRunError,
        },
      });
    } catch (error) {
      this.logger.error(`Error updating job runner state: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get current job runner state
   */
  async getState(): Promise<{
    lastRunAt: Date | null;
    lastRunDurationMs: number | null;
    lastRunJobCount: number | null;
    lastRunError: string | null;
  } | null> {
    try {
      const state = await this.prisma.jobRunnerState.findUnique({
        where: { id: 'singleton' },
      });

      if (!state) {
        return null;
      }

      return {
        lastRunAt: state.lastRunAt,
        lastRunDurationMs: state.lastRunDurationMs,
        lastRunJobCount: state.lastRunJobCount,
        lastRunError: state.lastRunError,
      };
    } catch (error) {
      this.logger.error(`Error getting job runner state: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }
}
