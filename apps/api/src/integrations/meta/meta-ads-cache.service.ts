import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class MetaAdsCacheService {
  private readonly logger = new Logger(MetaAdsCacheService.name);
  private client: Redis | null = null;
  private enabled = false;
  private ttlSec: number;

  constructor(private readonly configService: ConfigService) {
    this.ttlSec = parseInt(this.configService.get<string>('META_CACHE_TTL_SEC') || '120', 10);
    const redisUrl = this.configService.get<string>('REDIS_URL');
    if (redisUrl) {
      // Fail-open: Redis issues must never break the API
      try {
        this.client = new Redis(redisUrl, {
          lazyConnect: true,
          maxRetriesPerRequest: 1,
          enableReadyCheck: true,
        });
        this.enabled = true;
      } catch (e) {
        this.enabled = false;
        this.client = null;
      }
    }
  }

  isEnabled() {
    return this.enabled && !!this.client;
  }

  getTtlSec() {
    return this.ttlSec;
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.isEnabled()) return null;
    try {
      await this.client!.connect().catch(() => undefined);
      const raw = await this.client!.get(key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (e) {
      this.logger.warn(`Cache get failed (key=${key})`);
      return null;
    }
  }

  async setJson(key: string, value: unknown, ttlSec?: number): Promise<void> {
    if (!this.isEnabled()) return;
    try {
      await this.client!.connect().catch(() => undefined);
      await this.client!.set(key, JSON.stringify(value), 'EX', ttlSec ?? this.ttlSec);
    } catch (e) {
      this.logger.warn(`Cache set failed (key=${key})`);
    }
  }
}

