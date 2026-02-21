import { Public } from './common/decorators/public.decorator';
import { Controller, Get, Post, Body, UseGuards, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { AppService } from './app.service';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { CurrentOrganization } from './common/decorators/current-organization.decorator';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { Role } from '@remember-me/prisma';
import * as bcrypt from 'bcrypt';
import { BUILD_INFO } from './build-info';
import * as fs from 'fs';
import * as path from 'path';

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  getHello() {
    // Try to read BUILD_COMMIT.txt from Dockerfile if available
    let buildCommitFromFile: string | null = null;
    try {
      const buildCommitPath = path.join(process.cwd(), 'BUILD_COMMIT.txt');
      if (fs.existsSync(buildCommitPath)) {
        const content = fs.readFileSync(buildCommitPath, 'utf-8').trim();
        const match = content.match(/commit=([a-f0-9]+)/);
        if (match) {
          buildCommitFromFile = match[1].substring(0, 7);
        }
      }
    } catch (e) {
      // Ignore errors reading file
    }

    const commit = buildCommitFromFile || BUILD_INFO.commit;
    return {
      ok: true,
      service: 'api',
      commit,
      buildTime: BUILD_INFO.buildTime,
    };
  }

  @Public()
  @Get('health')
  health() {
    return this.appService.getExtendedHealth();
  }

  @Public()
  @Get('_debug/cookies')
  debugCookies(@Req() req: Request) {
    // Completely disabled in production (return 404 without details)
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Not found' };
    }

    // Development only: return cookie debug info
    return {
      ok: true,
      host: req.headers.host || null,
      origin: req.headers.origin || null,
      path: req.path,
      cookieHeader: req.headers.cookie || null,
      cookieKeys: Object.keys(req.cookies || {}),
      cookies: req.cookies || {},
    };
  }

  @Public()
  @Get('_debug/headers')
  debugHeaders(@Req() req: Request) {
    // Completely disabled in production
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Not found' };
    }

    // Development only: return header debug info
    return {
      ok: true,
      headers: {
        host: req.headers.host,
        origin: req.headers.origin,
        'user-agent': req.headers['user-agent'],
        cookie: req.headers.cookie,
        authorization: req.headers.authorization ? '***' : null,
      },
    };
  }

  @Public()
  @Get('_debug/env')
  debugEnv() {
    // Completely disabled in production
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Not found' };
    }

    // Development only: return safe env vars (no secrets)
    return {
      ok: true,
      nodeEnv: process.env.NODE_ENV,
      hasRedisUrl: !!process.env.REDIS_URL,
      hasJwtSecret: !!process.env.JWT_SECRET,
      databaseUrl: process.env.DATABASE_URL ? '***' : null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  getMe(@CurrentOrganization() organizationId: string, @Req() req: any) {
    return {
      user: req.user,
      organizationId,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('test-auth')
  testAuth(@CurrentOrganization() organizationId: string, @Req() req: any) {
    return {
      ok: true,
      message: 'Auth works!',
      user: req.user,
      organizationId,
    };
  }

  @Public()
  @Post('test')
  async test(@Body() body: any) {
    return {
      ok: true,
      received: body,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Post('seed-owner')
  async seedOwner(@Body() body: { email: string; password: string; name: string; organizationName: string }) {
    // Only allow in development
    if (process.env.NODE_ENV === 'production') {
      return { error: 'Not allowed in production' };
    }

    const { email, password, name, organizationName } = body;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return { error: 'User already exists', email };
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Create organization
    const organization = await this.prisma.organization.create({
      data: {
        name: organizationName,
        slug: organizationName.toLowerCase().replace(/\s+/g, '-'),
      },
    });

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        role: Role.OWNER,
        organizationId: organization.id,
      },
    });

    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
      },
    };
  }
}
