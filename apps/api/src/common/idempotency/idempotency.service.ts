import { Injectable, ConflictException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@remember-me/prisma';
import { createHash } from 'crypto';

export interface IdempotencyBeginResult {
  hit: boolean;
  cachedResponse?: {
    statusCode: number;
    body: any;
  };
}

export interface IdempotencyBeginParams {
  organizationId: string;
  userId: string;
  method: string;
  path: string;
  key: string;
  requestHash: string;
}

export interface IdempotencyCompleteParams {
  organizationId: string;
  userId: string;
  method: string;
  path: string;
  key: string;
  statusCode: number;
  responseBody: any;
}

export interface IdempotencyFailParams {
  organizationId: string;
  userId: string;
  method: string;
  path: string;
  key: string;
}

@Injectable()
export class IdempotencyService {
  private readonly logger = new Logger(IdempotencyService.name);
  private readonly TTL_HOURS = 24;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Begin idempotency check. Returns cached response if key exists and matches, or creates pending record.
   */
  async begin(params: IdempotencyBeginParams): Promise<IdempotencyBeginResult> {
    const { organizationId, userId, method, path, key, requestHash } = params;

    try {
      // Check if key exists and not expired
      const existing = await this.prisma.idempotencyKey.findUnique({
        where: {
          organizationId_userId_method_path_key: {
            organizationId,
            userId,
            method,
            path,
            key,
          },
        },
      });

      if (existing) {
        // Check if expired
        if (existing.expiresAt < new Date()) {
          // Expired, delete and allow new request
          await this.prisma.idempotencyKey.delete({
            where: { id: existing.id },
          });
          // Fall through to create new record
        } else {
          // Not expired, check request hash
          if (existing.requestHash !== requestHash) {
            throw new ConflictException({
              statusCode: 409,
              message: 'Idempotency key reused with different payload',
              errorCode: 'IDEMPOTENCY_KEY_REUSE_DIFFERENT_PAYLOAD',
              error: 'Conflict',
            });
          }

          // Same request hash, return cached response if available
          if (existing.statusCode !== null && existing.responseBody !== null) {
            return {
              hit: true,
              cachedResponse: {
                statusCode: existing.statusCode,
                body: existing.responseBody,
              },
            };
          }

          // Record exists but no cached response (pending), return miss to allow processing
          return { hit: false };
        }
      }

      // Create pending record (statusCode null)
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + this.TTL_HOURS);

      try {
        await this.prisma.idempotencyKey.create({
          data: {
            organizationId,
            userId,
            method,
            path,
            key,
            requestHash,
            statusCode: null,
            responseBody: Prisma.JsonNull,
            expiresAt,
          },
        });

        return { hit: false };
      } catch (error: any) {
        // Unique constraint violation (race condition)
        if (error.code === 'P2002') {
          // Re-read the record
          const raceRecord = await this.prisma.idempotencyKey.findUnique({
            where: {
              organizationId_userId_method_path_key: {
                organizationId,
                userId,
                method,
                path,
                key,
              },
            },
          });

          if (raceRecord && raceRecord.expiresAt >= new Date()) {
            // Check request hash
            if (raceRecord.requestHash !== requestHash) {
              throw new ConflictException({
                statusCode: 409,
                message: 'Idempotency key reused with different payload',
                errorCode: 'IDEMPOTENCY_KEY_REUSE_DIFFERENT_PAYLOAD',
                error: 'Conflict',
              });
            }

            // Return cached if available
            if (raceRecord.statusCode !== null && raceRecord.responseBody !== null) {
              return {
                hit: true,
                cachedResponse: {
                  statusCode: raceRecord.statusCode,
                  body: raceRecord.responseBody,
                },
              };
            }

            // Pending, return miss
            return { hit: false };
          }
        }

        throw error;
      }
    } catch (error: any) {
      if (error instanceof ConflictException) {
        throw error;
      }

      this.logger.error(`Failed to begin idempotency check: ${error.message}`, error.stack);
      // On error, allow request to proceed (fail open)
      return { hit: false };
    }
  }

  /**
   * Complete idempotency by storing response
   */
  async complete(params: IdempotencyCompleteParams): Promise<void> {
    const { organizationId, userId, method, path, key, statusCode, responseBody } = params;

    try {
      await this.prisma.idempotencyKey.updateMany({
        where: {
          organizationId,
          userId,
          method,
          path,
          key,
        },
        data: {
          statusCode,
          responseBody: responseBody as any,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to complete idempotency: ${error.message}`, error.stack);
      // Don't throw, idempotency is best-effort
    }
  }

  /**
   * Fail idempotency (optional cleanup)
   */
  async fail(params: IdempotencyFailParams): Promise<void> {
    const { organizationId, userId, method, path, key } = params;

    try {
      await this.prisma.idempotencyKey.deleteMany({
        where: {
          organizationId,
          userId,
          method,
          path,
          key,
        },
      });
    } catch (error: any) {
      this.logger.error(`Failed to fail idempotency: ${error.message}`, error.stack);
      // Don't throw
    }
  }

  /**
   * Cleanup expired keys
   */
  async cleanupExpired(): Promise<number> {
    try {
      const result = await this.prisma.idempotencyKey.deleteMany({
        where: {
          expiresAt: {
            lt: new Date(),
          },
        },
      });

      this.logger.log(`Cleaned up ${result.count} expired idempotency keys`);
      return result.count;
    } catch (error: any) {
      this.logger.error(`Failed to cleanup expired idempotency keys: ${error.message}`, error.stack);
      return 0;
    }
  }

  /**
   * Calculate request hash from body
   */
  static calculateRequestHash(body: any): string {
    if (!body || Object.keys(body).length === 0) {
      return createHash('sha256').update('{}').digest('hex');
    }

    // Sort keys for consistent hashing
    const sorted = JSON.stringify(body, Object.keys(body).sort());
    return createHash('sha256').update(sorted).digest('hex');
  }
}
