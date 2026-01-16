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
    this.redisUrl = this.configService.get<string>('RATE_LIMIT_REDIS_URL') || 'redis://localhost:6379';
  }

  onModuleInit() {
    if (this.enabled) {
      try {
        this.redis = new Redis(this.redisUrl, {
          retryStrategy: (times) => {
            const delay = Math.min(times * 50, 2000);
            return delay;
          },
          maxRetriesPerRequest: 3,
          lazyConnect: true,
        });

        this.redis.on('connect', () => {
          this.logger.log('Redis connected for rate limiting');
        });

        this.redis.on('error', (error) => {
          this.logger.error(`Redis error: ${error.message}`);
        });

        this.redis.connect().catch((error) => {
          this.logger.error(`Failed to connect to Redis: ${error.message}`);
          this.redis = null;
        });
      } catch (error) {
        this.logger.error(`Failed to initialize Redis: ${error instanceof Error ? error.message : 'Unknown error'}`);
        this.redis = null;
      }
    } else {
      this.logger.log('Rate limiting disabled (RATE_LIMIT_ENABLED=false)');
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
