import { Injectable, OnModuleInit, Logger, Optional } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';
import { ItemsSeederService } from './items/items-seeder.service';

@Injectable()
export class AppService implements OnModuleInit {
  private readonly logger = new Logger(AppService.name);
  private readonly startTime = Date.now();

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly itemsSeeder?: ItemsSeederService,
  ) {}

  getHello(): string {
    return 'Hello World!';
  }

  async getExtendedHealth() {
    let dbStatus = 'ok';
    try {
      // Simple query to check DB connection
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error) {
      dbStatus = 'error';
    }

    const uptime = Math.floor((Date.now() - this.startTime) / 1000); // seconds

    // Get commit hash from env (set by CI/CD) or default
    const commit = process.env.GIT_COMMIT || process.env.VERCEL_GIT_COMMIT_SHA || 'unknown';

    // Get version safely - try multiple paths and methods
    let version = process.env.npm_package_version || 'unknown';
    if (version === 'unknown') {
      try {
        // Try relative path (works in dev: apps/api/src -> ../../package.json)
        const pkgPath = require.resolve('../../package.json');
        const pkg = require(pkgPath);
        version = pkg.version || 'unknown';
      } catch (e) {
        // Try absolute path from project root
        try {
          const path = require('path');
          const fs = require('fs');
          // In production: dist/apps/api/src -> ../../../../package.json
          // In dev: apps/api/src -> ../../../package.json
          const possiblePaths = [
            path.resolve(__dirname, '../../../../package.json'), // prod
            path.resolve(__dirname, '../../../package.json'), // dev
            path.resolve(__dirname, '../../package.json'), // fallback
          ];
          for (const pkgPath of possiblePaths) {
            if (fs.existsSync(pkgPath)) {
              const pkg = require(pkgPath);
              version = pkg.version || 'unknown';
              break;
            }
          }
        } catch (e2) {
          // Ignore - use 'unknown'
        }
      }
    }

    return {
      status: 'ok',
      db: dbStatus,
      uptime,
      version,
      commit: commit.substring(0, 7), // Short commit hash
      env: process.env.NODE_ENV || 'development',
    };
  }

  async onModuleInit() {
    // Reseed Apple catalog v4 for all organizations (one-time, idempotent)
    if (this.itemsSeeder) {
      this.logger.log('Starting reseed of Apple iPhone catalog v4 for all organizations...');
      try {
        const result = await this.itemsSeeder.reseedAllOrganizations();
        this.logger.log(`Reseed completed: ${result.reseeded} items reseeded across ${result.total} organizations`);
      } catch (error) {
        this.logger.error('Failed to reseed Apple catalog:', error);
      }
    }
  }
}
