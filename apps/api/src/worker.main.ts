import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { Logger } from '@nestjs/common';
import { JobRunnerService } from './integrations/jobs/job-runner.service';

async function bootstrap() {
  const logger = new Logger('Worker');
  const runOnce = process.env.WORKER_RUN_ONCE === 'true' || process.env.WORKER_RUN_ONCE === '1';

  // Create NestJS application without HTTP server
  const app = await NestFactory.createApplicationContext(WorkerModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  logger.log('🚀 Worker started (no HTTP server)');
  logger.log(`Worker mode: ${process.env.WORKER_MODE || 'not set'}`);
  logger.log(`Job runner enabled: ${process.env.JOB_RUNNER_ENABLED || 'true (default in worker mode)'}`);
  logger.log(`Run once: ${runOnce}`);

  const jobRunner = app.get(JobRunnerService);

  // Graceful shutdown handler
  const shutdown = async (signal: string) => {
    logger.log(`${signal} received, shutting down worker...`);
    try {
      await app.close();
      logger.log('Worker shut down gracefully');
      process.exit(0);
    } catch (error) {
      logger.error(`Error during shutdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  // Handle uncaught errors
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  });

  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error);
    shutdown('uncaughtException');
  });

  // If run once, execute one cycle and exit
  if (runOnce) {
    logger.log('Running single job cycle...');
    try {
      await jobRunner.triggerProcessing();
      logger.log('Job cycle completed successfully');
      await app.close();
      process.exit(0);
    } catch (error) {
      logger.error(`Error in job cycle: ${error instanceof Error ? error.message : 'Unknown error'}`);
      await app.close();
      process.exit(1);
    }
  } else {
    // Continuous mode: JobRunnerService will handle the loop via onModuleInit
    logger.log('Worker running in continuous mode. Job runner will process jobs automatically.');
  }
}

bootstrap().catch((error) => {
  console.error('Failed to start worker:', error);
  process.exit(1);
});
