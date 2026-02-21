import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { Logger } from '@nestjs/common';
import { JobRunnerService } from './integrations/jobs/job-runner.service';

async function bootstrap() {
  const logger = new Logger('Worker');
  const runOnce = process.env.WORKER_RUN_ONCE === 'true' || process.env.WORKER_RUN_ONCE === '1';

  // CRITICAL: Deployment diagnostics - log commit, cwd, and entry point
  const commitSha = process.env.RAILWAY_GIT_COMMIT_SHA || 
                    process.env.VERCEL_GIT_COMMIT_SHA || 
                    process.env.GIT_COMMIT || 
                    'unknown';
  const cwd = process.cwd();
  const entryFile = __filename || 'unknown';
  
  logger.log(`[worker] Deployment diagnostics:`);
  logger.log(`[worker] commit=${commitSha.substring(0, 7)}`);
  logger.log(`[worker] cwd=${cwd}`);
  logger.log(`[worker] entry=${entryFile}`);

  // Log Redis configuration for diagnostics
  const redisUrl = process.env.REDIS_URL || 
                   process.env.RATE_LIMIT_REDIS_URL || 
                   process.env.BULL_REDIS_URL || 
                   process.env.QUEUE_REDIS_URL || 
                   process.env.JOB_REDIS_URL;
  
  if (redisUrl) {
    // CRITICAL: Validate Redis URL does NOT contain localhost/127.0.0.1 in production
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      if (redisUrl.includes('localhost') || 
          redisUrl.includes('127.0.0.1') || 
          redisUrl.includes('redis://redis:') ||
          redisUrl === 'redis://redis:6379') {
        logger.error(`[redis][worker] REDIS_URL contains localhost/127.0.0.1 - CANNOT USE IN PRODUCTION`);
        logger.error(`[redis][worker] Redis features will be DISABLED`);
        // Don't crash - continue without Redis
      } else {
        // Parse host from URL (without credentials)
        try {
          const url = new URL(redisUrl);
          const host = url.hostname;
          const port = url.port || '6379';
          logger.log(`[redis][worker] REDIS_URL present: true`);
          logger.log(`[redis][worker] Redis host: ${host}:${port}`);
        } catch (e) {
          logger.warn(`[redis][worker] REDIS_URL present but invalid format: ${redisUrl.substring(0, 20)}...`);
        }
      }
    } else {
      // Development: allow localhost but log it
      try {
        const url = new URL(redisUrl);
        const host = url.hostname;
        const port = url.port || '6379';
        logger.log(`[redis][worker] REDIS_URL present: true`);
        logger.log(`[redis][worker] Redis host: ${host}:${port} (dev mode)`);
      } catch (e) {
        logger.warn(`[redis][worker] REDIS_URL present but invalid format: ${redisUrl.substring(0, 20)}...`);
      }
    }
  } else {
    logger.warn(`[redis][worker] REDIS_URL present: false - Redis features will be disabled`);
  }

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
