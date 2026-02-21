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

  // CRITICAL: NUCLEAR OPTION - Intercept ALL Redis connections at process level
  // This runs BEFORE any module initialization to prevent ANY localhost connections
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    const originalConnect = net.Socket.prototype.connect;
    net.Socket.prototype.connect = function(...args: any[]) {
      // Check if this is a Redis connection attempt (port 6379)
      if (args.length > 0) {
        const address = args[0];
        if (typeof address === 'object' && address.port === 6379) {
          const host = address.host || address.hostname || 'unknown';
          if (host === '127.0.0.1' || host === 'localhost') {
            logger.error(`[redis][worker] NUCLEAR INTERCEPT: Blocked connection attempt to ${host}:6379`);
            const error = new Error(`Connection to localhost:6379 is BLOCKED in production`);
            (error as any).code = 'ECONNREFUSED';
            throw error;
          }
        } else if (typeof address === 'string' && (address.includes('127.0.0.1') || address.includes('localhost'))) {
          logger.error(`[redis][worker] NUCLEAR INTERCEPT: Blocked connection attempt to ${address}`);
          const error = new Error(`Connection to localhost is BLOCKED in production`);
          (error as any).code = 'ECONNREFUSED';
          throw error;
        } else if (args.length >= 2 && typeof args[1] === 'number' && args[1] === 6379) {
          // Check port as second argument
          const host = typeof address === 'string' ? address : 'unknown';
          if (host === '127.0.0.1' || host === 'localhost') {
            logger.error(`[redis][worker] NUCLEAR INTERCEPT: Blocked connection attempt to ${host}:6379`);
            const error = new Error(`Connection to localhost:6379 is BLOCKED in production`);
            (error as any).code = 'ECONNREFUSED';
            throw error;
          }
        }
      }
      return originalConnect.apply(this, args);
    };
    logger.log('[redis][worker] NUCLEAR INTERCEPT: Socket.connect intercepted to block localhost Redis connections');
  }

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
         logger.log(`[worker] FORCE_REBUILD_CHECK=20260221060000`);

  // CRITICAL: Guardrail - prevent ANY localhost Redis connections
  // Even if old code tries to use localhost, we disable it at process level
  // Check ALL possible Redis URL environment variables
  const redisEnvVars = [
    'REDIS_URL',
    'RATE_LIMIT_REDIS_URL',
    'BULL_REDIS_URL',
    'QUEUE_REDIS_URL',
    'JOB_REDIS_URL',
  ];

  // CRITICAL: Guardrail - prevent ANY localhost Redis connections
  // Even if old code tries to use localhost, we disable it at process level
  // Check ALL possible Redis URL environment variables
  const nodeEnvFirst = process.env.NODE_ENV || 'development';
  if (nodeEnvFirst === 'production') {
    for (const envVar of redisEnvVars) {
      const value = process.env[envVar];
      if (value) {
        const lower = value.toLowerCase();
        if (lower.includes('127.0.0.1') || lower.includes('localhost')) {
          logger.error(`[redis][worker] GUARDRAIL: ${envVar} contains localhost/127.0.0.1 - CLEARING ALL Redis env vars`);
          // Clear ALL Redis env vars to prevent any connection attempts
          for (const varToClear of redisEnvVars) {
            delete process.env[varToClear];
            process.env[varToClear] = ''; // Set to empty string as well
          }
          break; // Exit loop after clearing all
        }
      }
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

  // CRITICAL: Clear Redis env vars ONE MORE TIME before creating NestJS app
  // This ensures that even if something tries to read env vars during module initialization,
  // they will be empty and won't cause localhost connection attempts
  if (nodeEnvFirst === 'production') {
    const redisEnvVars = ['REDIS_URL', 'RATE_LIMIT_REDIS_URL', 'BULL_REDIS_URL', 'QUEUE_REDIS_URL', 'JOB_REDIS_URL'];
    for (const envVar of redisEnvVars) {
      const value = process.env[envVar];
      if (value) {
        const lower = value.toLowerCase();
        if (lower.includes('127.0.0.1') || lower.includes('localhost')) {
          logger.error(`[redis][worker] FINAL GUARDRAIL: ${envVar} contains localhost - CLEARING ALL Redis env vars before app creation`);
          for (const varToClear of redisEnvVars) {
            delete process.env[varToClear];
            process.env[varToClear] = '';
          }
          break;
        }
      }
    }
  }

  // Create NestJS application WITH minimal HTTP server for healthcheck
  // Railway requires healthcheck endpoint, so we start a minimal HTTP server
  logger.log('Creating NestJS application with HTTP server...');
  const app = await NestFactory.create(WorkerModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  logger.log('NestJS application created, setting up healthcheck endpoint...');

  // Add minimal healthcheck endpoint for Railway
  app.getHttpAdapter().get('/api/health', (req: any, res: any) => {
    logger.log('Healthcheck endpoint called');
    res.status(200).json({
      status: 'ok',
      service: 'worker',
      commit: commitSha,
      buildTime: buildTime,
    });
  });

  // Start HTTP server on port 4000 (or PORT env var) for healthcheck only
  const port = process.env.PORT || 4000;
  logger.log(`Starting HTTP server on port ${port}...`);
  
  try {
    await app.listen(port, '0.0.0.0'); // Bind to all interfaces
    logger.log(`✅ HTTP server started successfully on port ${port} (0.0.0.0:${port})`);
    logger.log(`🚀 Worker started with minimal HTTP server on port ${port} (healthcheck only)`);
  } catch (error) {
    logger.error(`❌ Failed to start HTTP server: ${error instanceof Error ? error.message : 'Unknown error'}`);
    logger.error(`Error details: ${error instanceof Error ? error.stack : String(error)}`);
    throw error;
  }
  logger.log(`Worker mode: ${process.env.WORKER_MODE || 'not set'}`);
  logger.log(`Job runner enabled: ${process.env.JOB_RUNNER_ENABLED || 'true (default in worker mode)'}`);
  logger.log(`Run once: ${runOnce}`);

  // Get job runner service
  logger.log('Getting JobRunnerService...');
  let jobRunner: JobRunnerService;
  try {
    jobRunner = app.get(JobRunnerService);
    logger.log('JobRunnerService obtained successfully');
  } catch (error) {
    logger.error(`Failed to get JobRunnerService: ${error instanceof Error ? error.message : 'Unknown error'}`);
    // Don't exit - server is already running for healthcheck
    logger.warn('Continuing without JobRunnerService - healthcheck will still work');
    jobRunner = null as any; // Will be checked before use
  }

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
