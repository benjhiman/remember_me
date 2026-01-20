import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSec?: number;
}

export interface RateLimitConfig {
  action: string;
  limit: number;
  windowSec: number;
  organizationId?: string;
}

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RateLimitService.name);
  private redis: Redis | null = null;
  private readonly enabled: boolean;
  private readonly redisUrl: string;

  constructor(private configService: ConfigService) {
    this.enabled = this.configService.get<string>('RATE_LIMIT_ENABLED') === 'true';
    
    // If rate limiting is disabled, we don't need Redis URL
    if (!this.enabled) {
      this.redisUrl = '';
      return;
    }

    // Get Redis URL - use RATE_LIMIT_REDIS_URL or fallback to REDIS_URL
    // NEVER default to localhost in production
    const rateLimitRedisUrl = this.configService.get<string>('RATE_LIMIT_REDIS_URL');
    const redisUrl = this.configService.get<string>('REDIS_URL');
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    
    if (rateLimitRedisUrl) {
      this.redisUrl = rateLimitRedisUrl;
    } else if (redisUrl) {
      this.redisUrl = redisUrl;
    } else {
      if (nodeEnv === 'production') {
        throw new Error(
          'RATE_LIMIT_REDIS_URL or REDIS_URL is required for rate limiting in production. ' +
          'Set one of these environment variables, or disable rate limiting with RATE_LIMIT_ENABLED=false'
        );
      }
      // Only allow localhost in development
      this.redisUrl = 'redis://localhost:6379';
      this.logger.warn('No REDIS_URL found, using localhost:6379 for rate limiting (development only)');
    }

    // Validate Redis URL format (must be redis:// or rediss://)
    if (this.redisUrl && !this.redisUrl.match(/^rediss?:\/\//)) {
      throw new Error(
        `Invalid Redis URL format: ${this.redisUrl}. ` +
        'Expected format: redis://[password@]host:port or rediss://[password@]host:port'
      );
    }
  }

  async onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Rate limiting disabled (RATE_LIMIT_ENABLED=false)');
      return;
    }

    if (!this.redisUrl) {
      this.logger.warn('Rate limiting enabled but no Redis URL configured. Rate limiting will be disabled.');
      return;
    }

    try {
      this.redis = new Redis(this.redisUrl, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        enableOfflineQueue: false, // Don't queue commands if disconnected
        connectTimeout: 5000, // 5 second timeout
      });

      this.redis.on('connect', () => {
        this.logger.log(`Redis connected for rate limiting (${this.redisUrl?.replace(/:[^:@]+@/, ':****@') || 'unknown'})`);
      });

      this.redis.on('ready', () => {
        this.logger.log('Redis ready for rate limiting');
      });

      this.redis.on('error', (error) => {
        this.logger.error(`Redis error for rate limiting: ${error.message}`);
        // Don't set redis to null on error - let retry strategy handle reconnection
      });

      this.redis.on('close', () => {
        this.logger.warn('Redis connection closed for rate limiting');
      });

      // Attempt connection
      await this.redis.connect();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`Failed to connect to Redis for rate limiting: ${errorMessage}`);
      this.logger.error(`Redis URL: ${this.redisUrl?.replace(/:[^:@]+@/, ':****@') || 'not set'}`);
      
      // In production, this is critical - log but don't crash (fail open)
      const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
      if (nodeEnv === 'production') {
        this.logger.error(
          'Rate limiting Redis connection failed in production. ' +
          'Requests will be allowed (fail open). ' +
          'Please check REDIS_URL or RATE_LIMIT_REDIS_URL configuration.'
        );
      }
      
      this.redis = null;
    }
  }

  onModuleDestroy() {
    if (this.redis) {
      this.redis.disconnect();
      this.redis = null;
    }
  }

  /**
   * Check rate limit using sliding window log algorithm
   * Key format: rate_limit:{orgId}:{action}:{windowStart}
   */
  async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    if (!this.enabled || !this.redis) {
      // If disabled or Redis unavailable, allow all requests
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit,
        resetAt: new Date(Date.now() + config.windowSec * 1000),
      };
    }

    const { action, limit, windowSec, organizationId } = config;
    const orgId = organizationId || 'global';
    const now = Date.now();
    const windowStart = Math.floor(now / (windowSec * 1000)) * (windowSec * 1000);
    const windowEnd = windowStart + windowSec * 1000;
    const key = `rate_limit:${orgId}:${action}:${windowStart}`;

    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.redis.pipeline();
      
      // Increment counter
      pipeline.incr(key);
      
      // Set expiration (TTL = window size + 1 second buffer)
      pipeline.expire(key, windowSec + 1);
      
      // Get current count
      pipeline.get(key);

      const results = await pipeline.exec();
      
      if (!results || results.length < 3) {
        this.logger.warn('Redis pipeline failed, allowing request');
        return {
          allowed: true,
          limit,
          remaining: limit,
          resetAt: new Date(windowEnd),
        };
      }

      const currentCount = parseInt(results[2][1] as string, 10) || 0;
      const allowed = currentCount <= limit;
      const remaining = Math.max(0, limit - currentCount);
      const resetAt = new Date(windowEnd);
      const retryAfterSec = allowed ? undefined : Math.ceil((windowEnd - now) / 1000);

      return {
        allowed,
        limit,
        remaining,
        resetAt,
        retryAfterSec,
      };
    } catch (error) {
      this.logger.error(`Rate limit check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      // On error, allow the request (fail open)
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetAt: new Date(windowEnd),
      };
    }
  }

  /**
   * Get rate limit info without incrementing (for headers)
   */
  async getLimitInfo(config: RateLimitConfig): Promise<RateLimitResult> {
    if (!this.enabled || !this.redis) {
      return {
        allowed: true,
        limit: config.limit,
        remaining: config.limit,
        resetAt: new Date(Date.now() + config.windowSec * 1000),
      };
    }

    const { action, limit, windowSec, organizationId } = config;
    const orgId = organizationId || 'global';
    const now = Date.now();
    const windowStart = Math.floor(now / (windowSec * 1000)) * (windowSec * 1000);
    const windowEnd = windowStart + windowSec * 1000;
    const key = `rate_limit:${orgId}:${action}:${windowStart}`;

    try {
      const currentCount = await this.redis.get(key);
      const count = currentCount ? parseInt(currentCount, 10) : 0;
      const allowed = count < limit;
      const remaining = Math.max(0, limit - count);

      return {
        allowed,
        limit,
        remaining,
        resetAt: new Date(windowEnd),
      };
    } catch (error) {
      this.logger.error(`Get rate limit info failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return {
        allowed: true,
        limit,
        remaining: limit,
        resetAt: new Date(windowEnd),
      };
    }
  }

  /**
   * Reset rate limit for an organization and action (admin function)
   */
  async resetLimit(organizationId: string, action: string): Promise<void> {
    if (!this.enabled || !this.redis) {
      return;
    }

    try {
      const pattern = `rate_limit:${organizationId}:${action}:*`;
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(...keys);
        this.logger.log(`Reset rate limit for org ${organizationId}, action ${action}`);
      }
    } catch (error) {
      this.logger.error(`Reset rate limit failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
