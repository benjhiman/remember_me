import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getRedisUrlOrNull, getRedisHost } from '../redis/redis-url';

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
  private _isEnabled: boolean = false;
  private hasLoggedWarning: boolean = false;

  constructor(private configService: ConfigService) {}

  /**
   * Public getter to check if rate limiting is enabled and Redis is available
   */
  get isEnabled(): boolean {
    return this._isEnabled && this.redis !== null;
  }

  async onModuleInit() {
    // Check if rate limiting is explicitly disabled
    const rateLimitEnabled = this.configService.get<string>('RATE_LIMIT_ENABLED') === 'true';
    if (!rateLimitEnabled) {
      this.logger.log('Rate limiting disabled (RATE_LIMIT_ENABLED=false)');
      this._isEnabled = false;
      return;
    }

    // CRITICAL: Use centralized Redis URL function (single source of truth)
    // Rate limiting can use RATE_LIMIT_REDIS_URL or fallback to REDIS_URL
    const rateLimitRedisUrl = getRedisUrlOrNull();
    
    if (!rateLimitRedisUrl) {
      this.logWarnOnce('[redis] Rate limiting disabled: no valid Redis URL');
      this._isEnabled = false;
      return;
    }

    // Validate URL format
    if (!rateLimitRedisUrl.match(/^rediss?:\/\//)) {
      this.logWarnOnce(`[redis] Rate limiting disabled: Invalid Redis URL format`);
      this._isEnabled = false;
      return;
    }

    // CRITICAL: Only use URLs with authentication (must contain @)
    // This prevents NOAUTH errors
    if (!rateLimitRedisUrl.includes('@')) {
      this.logWarnOnce('[redis] Rate limiting disabled: Redis URL must include password (format: redis://password@host:port)');
      this._isEnabled = false;
      return;
    }

    // Log Redis host for diagnostics
    const redisHost = getRedisHost(rateLimitRedisUrl);
    if (redisHost) {
      this.logger.log(`[redis] Rate limiting using Redis: ${redisHost}`);
    }

    // Attempt to initialize Redis connection
    try {
      this.redis = new Redis(rateLimitRedisUrl, {
        retryStrategy: () => null, // Disable automatic retries - fail fast
        maxRetriesPerRequest: 1, // Only 1 retry
        lazyConnect: true,
        enableOfflineQueue: false, // Don't queue commands if disconnected
        connectTimeout: 3000, // 3 second timeout
        commandTimeout: 2000, // 2 second command timeout
      });

      // Set up error handlers BEFORE connecting
      this.redis.on('error', (error) => {
        const errorMsg = error.message || String(error);
        
        // Handle NOAUTH and connection errors
        if (errorMsg.includes('NOAUTH') || 
            errorMsg.includes('ECONNREFUSED') || 
            errorMsg.includes('ENOTFOUND')) {
          this.logWarnOnce(`Rate limiting disabled: Redis connection failed (${errorMsg})`);
          this.disableRateLimit();
        }
      });

      this.redis.on('close', () => {
        if (this._isEnabled) {
          this.logWarnOnce('Rate limiting disabled: Redis connection closed');
          this.disableRateLimit();
        }
      });

      // Attempt connection with timeout
      await Promise.race([
        this.redis.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), 3000)
        ),
      ]);

      // Test connection with a simple command
      await this.redis.ping();
      
      this.logger.log(`Rate limiting enabled: Redis connected (${this.sanitizeUrl(rateLimitRedisUrl)})`);
      this._isEnabled = true;
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Handle specific errors
      if (errorMsg.includes('NOAUTH') || 
          errorMsg.includes('ECONNREFUSED') || 
          errorMsg.includes('ENOTFOUND') ||
          errorMsg.includes('timeout')) {
        this.logWarnOnce(`Rate limiting disabled: Redis unavailable (${errorMsg})`);
      } else {
        this.logWarnOnce(`Rate limiting disabled: Redis connection failed (${errorMsg})`);
      }
      
      this.disableRateLimit();
    }
  }

  onModuleDestroy() {
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch (error) {
        // Ignore errors on shutdown
      }
      this.redis = null;
    }
  }

  /**
   * Check rate limit using sliding window log algorithm
   * Key format: rate_limit:{orgId}:{action}:{windowStart}
   * Returns allow=true if rate limiting is disabled or Redis unavailable (fail-open)
   */
  async checkLimit(config: RateLimitConfig): Promise<RateLimitResult> {
    if (!this.isEnabled || !this.redis) {
      // Fail-open: allow all requests if rate limiting is disabled
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
        // Pipeline failed - fail-open
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      // Handle connection errors - disable rate limiting and fail-open
      if (errorMsg.includes('NOAUTH') || 
          errorMsg.includes('ECONNREFUSED') || 
          errorMsg.includes('ENOTFOUND') ||
          errorMsg.includes('Connection is closed')) {
        this.logWarnOnce(`Rate limiting disabled: Redis error during check (${errorMsg})`);
        this.disableRateLimit();
      }
      
      // Fail-open: allow request on any error
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
    if (!this.isEnabled || !this.redis) {
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
      const errorMsg = error instanceof Error ? error.message : String(error);
      
      if (errorMsg.includes('NOAUTH') || 
          errorMsg.includes('ECONNREFUSED') || 
          errorMsg.includes('ENOTFOUND') ||
          errorMsg.includes('Connection is closed')) {
        this.logWarnOnce(`Rate limiting disabled: Redis error during getLimitInfo (${errorMsg})`);
        this.disableRateLimit();
      }
      
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
    if (!this.isEnabled || !this.redis) {
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
      // Silently fail - don't log errors for admin operations
    }
  }

  /**
   * Disable rate limiting and close Redis connection
   */
  private disableRateLimit(): void {
    this._isEnabled = false;
    if (this.redis) {
      try {
        this.redis.disconnect();
      } catch (error) {
        // Ignore errors
      }
      this.redis = null;
    }
  }

  /**
   * Log warning only once to prevent log spam
   */
  private logWarnOnce(message: string): void {
    if (!this.hasLoggedWarning) {
      this.logger.warn(message);
      this.hasLoggedWarning = true;
    }
  }

  /**
   * Sanitize Redis URL for logging (hide password)
   */
  private sanitizeUrl(url: string): string {
    return url.replace(/:[^:@]+@/, ':****@');
  }
}
