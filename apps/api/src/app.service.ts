import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma/prisma.service';

@Injectable()
export class AppService {
  private readonly startTime = Date.now();

  constructor(private readonly prisma: PrismaService) {}

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

    return {
      status: 'ok',
      db: dbStatus,
      uptime,
      version: process.env.npm_package_version || require('../../package.json').version || 'unknown',
      env: process.env.NODE_ENV || 'development',
    };
  }
}
