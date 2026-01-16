import { Test, TestingModule } from '@nestjs/testing';
import { JobRunnerStateService } from './job-runner-state.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('JobRunnerStateService', () => {
  let service: JobRunnerStateService;
  let prisma: PrismaService;

  const mockPrismaService = {
    jobRunnerState: {
      upsert: jest.fn(),
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JobRunnerStateService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<JobRunnerStateService>(JobRunnerStateService);
    prisma = module.get<PrismaService>(PrismaService);
    jest.clearAllMocks();
  });

  describe('updateState', () => {
    it('should update state with all fields', async () => {
      const lastRunAt = new Date();
      const lastRunDurationMs = 1500;
      const lastRunJobCount = 5;
      const lastRunError = 'Some error';

      mockPrismaService.jobRunnerState.upsert.mockResolvedValueOnce({});

      await service.updateState(lastRunAt, lastRunDurationMs, lastRunJobCount, lastRunError);

      expect(mockPrismaService.jobRunnerState.upsert).toHaveBeenCalledWith({
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
    });

    it('should update state without error', async () => {
      const lastRunAt = new Date();
      const lastRunDurationMs = 1500;
      const lastRunJobCount = 5;

      mockPrismaService.jobRunnerState.upsert.mockResolvedValueOnce({});

      await service.updateState(lastRunAt, lastRunDurationMs, lastRunJobCount);

      expect(mockPrismaService.jobRunnerState.upsert).toHaveBeenCalledWith({
        where: { id: 'singleton' },
        create: expect.objectContaining({
          lastRunError: undefined,
        }),
        update: expect.objectContaining({
          lastRunError: undefined,
        }),
      });
    });
  });

  describe('getState', () => {
    it('should return state when exists', async () => {
      const state = {
        id: 'singleton',
        lastRunAt: new Date(),
        lastRunDurationMs: 1500,
        lastRunJobCount: 5,
        lastRunError: null,
      };

      mockPrismaService.jobRunnerState.findUnique.mockResolvedValueOnce(state);

      const result = await service.getState();

      expect(result).toEqual({
        lastRunAt: state.lastRunAt,
        lastRunDurationMs: state.lastRunDurationMs,
        lastRunJobCount: state.lastRunJobCount,
        lastRunError: null,
      });
    });

    it('should return null when state does not exist', async () => {
      mockPrismaService.jobRunnerState.findUnique.mockResolvedValueOnce(null);

      const result = await service.getState();

      expect(result).toBeNull();
    });

    it('should persist lastRunDurationMs correctly', async () => {
      const lastRunAt = new Date();
      const lastRunDurationMs = 2500; // 2.5 seconds
      const lastRunJobCount = 10;

      mockPrismaService.jobRunnerState.upsert.mockResolvedValueOnce({
        id: 'singleton',
        lastRunAt,
        lastRunDurationMs,
        lastRunJobCount,
        lastRunError: null,
      });

      await service.updateState(lastRunAt, lastRunDurationMs, lastRunJobCount);

      expect(mockPrismaService.jobRunnerState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          update: expect.objectContaining({
            lastRunDurationMs: 2500,
          }),
        }),
      );

      // Verify getState returns the duration
      mockPrismaService.jobRunnerState.findUnique.mockResolvedValueOnce({
        id: 'singleton',
        lastRunAt,
        lastRunDurationMs: 2500,
        lastRunJobCount: 10,
        lastRunError: null,
      });

      const state = await service.getState();
      expect(state?.lastRunDurationMs).toBe(2500);
    });
  });
});
