import { Test, TestingModule } from '@nestjs/testing';
import { WorkerModule } from './worker.module';
import { JobRunnerService } from './integrations/jobs/job-runner.service';

describe('Worker Bootstrap', () => {
  it('should bootstrap worker module and get JobRunnerService', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();

    const jobRunner = module.get(JobRunnerService);
    expect(jobRunner).toBeDefined();
    expect(jobRunner).toBeInstanceOf(JobRunnerService);
  });

  it('should have JobRunnerService with onModuleDestroy method', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();

    const jobRunner = module.get(JobRunnerService);
    expect(typeof jobRunner.onModuleDestroy).toBe('function');
  });

  it('should have JobRunnerService with triggerProcessing method', async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [WorkerModule],
    }).compile();

    const jobRunner = module.get(JobRunnerService);
    expect(typeof jobRunner.triggerProcessing).toBe('function');
  });
});
