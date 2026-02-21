import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';
import { Logger } from '@nestjs/common';
import { JobRunnerService } from './integrations/jobs/job-runner.service';
import { BUILD_INFO } from './build-info';
import { getRedisUrlOrNull, getRedisHost } from './common/redis/redis-url';
import * as fs from 'fs';
import * as path from 'path';

async function bootstrap() {
  const logger = new Logger('Worker');
  const runOnce = process.env.WORKER_RUN_ONCE === 'true' || process.env.WORKER_RUN_ONCE === '1';

  // CRITICAL: Deployment diagnostics - log commit, build time, cwd, and entry point
  // Try to read BUILD_COMMIT.txt from Dockerfile if available
  let buildCommitFromFile: string | null = null;
  let buildTimeFromFile: string | null = null;
  try {
    const buildCommitPath = path.join(process.cwd(), 'BUILD_COMMIT.txt');
    if (fs.existsSync(buildCommitPath)) {
      const content = fs.readFileSync(buildCommitPath, 'utf-8').trim();
      const commitMatch = content.match(/commit=([a-f0-9]+)/);
      if (commitMatch) {
        buildCommitFromFile = commitMatch[1].substring(0, 7);
      }
      const timeMatch = content.match(/buildTime=([^\n]+)/);
      if (timeMatch) {
        buildTimeFromFile = timeMatch[1];
      }
    }
  } catch (e) {
    // Ignore errors reading file
  }

  const commitSha = buildCommitFromFile || BUILD_INFO.commit;
  const buildTime = buildTimeFromFile || BUILD_INFO.buildTime;
  const cwd = process.cwd();
  const entryFile = __filename || 'unknown';
  
  logger.log(`[worker] Deployment diagnostics:`);
  logger.log(`[worker] commit=${commitSha}`);
  logger.log(`[worker] buildTime=${buildTime}`);
  logger.log(`[worker] cwd=${cwd}`);
  logger.log(`[worker] entry=${entryFile}`);

  // CRITICAL: Guardrail - prevent ANY localhost Redis connections
  // Even if old code tries to use localhost, we disable it at process level
  const originalRedisUrl = process.env.REDIS_URL;
  if (originalRedisUrl && process.env.NODE_ENV === 'production') {
    const lower = originalRedisUrl.toLowerCase();
    if (lower.includes('127.0.0.1') || lower.includes('localhost')) {
      logger.error(`[redis][worker] GUARDRAIL: REDIS_URL contains localhost/127.0.0.1 - DISABLING`);
      process.env.REDIS_URL = ''; // Clear it to prevent any connection attempts
      process.env.RATE_LIMIT_REDIS_URL = '';
      process.env.BULL_REDIS_URL = '';
      process.env.QUEUE_REDIS_URL = '';
      process.env.JOB_REDIS_URL = '';
    }
  }

  // Log Redis configuration for diagnostics using centralized function
  const redisUrl = getRedisUrlOrNull();
  const redisHost = getRedisHost(redisUrl);
  
  if (redisUrl && redisHost) {
    logger.log(`[redis][worker] mode=enabled urlPresent=true host=${redisHost}`);
  } else {
    logger.log(`[redis][worker] mode=disabled urlPresent=false host=null`);
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
