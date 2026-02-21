/**
 * Centralized Redis URL configuration
 * 
 * This is the SINGLE SOURCE OF TRUTH for Redis URLs.
 * All Redis connections (BullMQ, ioredis, rate limiting) MUST use this function.
 * 
 * Rules:
 * - Returns null if no valid Redis URL is configured
 * - NEVER returns localhost/127.0.0.1 in production
 * - Logs warnings if invalid URLs are detected
 */

import { Logger } from '@nestjs/common';

const logger = new Logger('RedisConfig');

/**
 * Get Redis URL from environment variables
 * Returns null if no valid URL is found or if URL contains localhost in production
 * 
 * PRIORITY ORDER (CRITICAL):
 * 1. REDIS_URL (highest priority - ALWAYS use if present and valid)
 * 2. RATE_LIMIT_REDIS_URL
 * 3. BULL_REDIS_URL
 * 4. QUEUE_REDIS_URL
 * 5. JOB_REDIS_URL
 * 
 * NEVER falls back to REDIS_HOST/REDIS_PORT or localhost defaults
 * 
 * @returns Redis URL string or null
 */
export function getRedisUrlOrNull(): string | null {
  // CRITICAL: REDIS_URL has HIGHEST priority - use it if it exists and is valid
  const redisUrl = process.env.REDIS_URL;
  
  if (redisUrl) {
    // Validate REDIS_URL first
    const nodeEnv = process.env.NODE_ENV || 'development';
    if (nodeEnv === 'production') {
      const lower = redisUrl.toLowerCase();
      if (
        lower.includes('127.0.0.1') ||
        lower.includes('localhost') ||
        lower === 'redis://redis:6379' ||
        lower.startsWith('redis://redis:')
      ) {
        logger.error(
          `[redis] REDIS_URL contains localhost/127.0.0.1 - REJECTED in production. Redis features disabled.`,
        );
        return null;
      }
    }
    // REDIS_URL is valid - return it immediately (highest priority)
    return redisUrl;
  }

  // Fallback to other Redis URL env vars (only if REDIS_URL is not set)
  const fallbackUrl =
    process.env.RATE_LIMIT_REDIS_URL ||
    process.env.BULL_REDIS_URL ||
    process.env.QUEUE_REDIS_URL ||
    process.env.JOB_REDIS_URL ||
    null;

  if (!fallbackUrl) {
    return null;
  }

  // Validate fallback URL
  const nodeEnv = process.env.NODE_ENV || 'development';
  if (nodeEnv === 'production') {
    const lower = fallbackUrl.toLowerCase();
    if (
      lower.includes('127.0.0.1') ||
      lower.includes('localhost') ||
      lower === 'redis://redis:6379' ||
      lower.startsWith('redis://redis:')
    ) {
      logger.error(
        `[redis] Fallback Redis URL contains localhost/127.0.0.1 - REJECTED in production. Redis features disabled.`,
      );
      return null;
    }
  }

  return fallbackUrl;
}

/**
 * Get Redis host from URL (for logging, without credentials)
 * 
 * @param redisUrl Redis URL
 * @returns Host string (hostname:port) or null
 */
export function getRedisHost(redisUrl: string | null): string | null {
  if (!redisUrl) {
    return null;
  }

  try {
    const url = new URL(redisUrl);
    const host = url.hostname;
    const port = url.port || '6379';
    return `${host}:${port}`;
  } catch (e) {
    return null;
  }
}

/**
 * Check if Redis is enabled (has valid URL)
 * 
 * @returns true if Redis is enabled, false otherwise
 */
export function isRedisEnabled(): boolean {
  return getRedisUrlOrNull() !== null;
}
