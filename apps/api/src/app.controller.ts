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

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  getRoot() {
    const commitSha = this.configService.get<string>('RAILWAY_GIT_COMMIT_SHA') || 
                      this.configService.get<string>('VERCEL_GIT_COMMIT_SHA') || 
                      this.configService.get<string>('GIT_COMMIT') || 
                      null;
    return {
      ok: true,
      service: 'api',
      commit: commitSha ? commitSha.substring(0, 7) : null,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Public()
  @Get('health/extended')
  async getExtendedHealth() {
    return this.appService.getExtendedHealth();
  }

  @Public()
  @Get('debug/config')
  getConfigDebug() {
    const jwtSecret = this.configService.get<string>('JWT_SECRET');
    const jwtRefreshSecret = this.configService.get<string>('JWT_REFRESH_SECRET');
    const nodeEnv = this.configService.get<string>('NODE_ENV') || 'development';
    
    return {
      ok: true,
      envLoaded: true,
      nodeEnv,
      hasJwtSecret: !!jwtSecret,
      hasJwtRefreshSecret: !!jwtRefreshSecret,
      jwtSecretLength: jwtSecret ? jwtSecret.length : 0,
      jwtRefreshSecretLength: jwtRefreshSecret ? jwtRefreshSecret.length : 0,
      timestamp: new Date().toISOString(),
    };
  }

  @Public()
  @Get('debug/cors')
  getCorsDebug(@Req() req: Request, @Res() res: Response) {
    const originReceived = (req.headers as any).origin || null;
    const requestId = (req as any).requestId || (req.headers as any)['x-request-id'] || null;
    
    // Normalize origin (same logic as CORS callback)
    function normalizeOrigin(origin: string): string {
      return origin.trim().replace(/\/+$/, '');
    }
    
    const originNormalized = originReceived ? normalizeOrigin(originReceived) : null;
    
    // Determine CORS decision (same logic as callback)
    let corsDecision: { allowed: boolean; reason: string } | null = null;
    if (originReceived) {
      if (originNormalized === 'https://app.iphonealcosto.com') {
        corsDecision = { allowed: true, reason: 'exact_match_app_iphonealcosto' };
      } else if (originNormalized === 'https://iphonealcosto.com' || originNormalized === 'https://www.iphonealcosto.com') {
        corsDecision = { allowed: true, reason: 'exact_match_main_domains' };
      } else if (originNormalized?.endsWith('.vercel.app')) {
        corsDecision = { allowed: true, reason: 'vercel_preview' };
      } else if (originNormalized?.endsWith('.iphonealcosto.com')) {
        corsDecision = { allowed: true, reason: 'iphonealcosto_subdomain' };
      } else if (originNormalized?.startsWith('http://localhost:') || originNormalized?.startsWith('http://127.0.0.1:')) {
        corsDecision = { allowed: true, reason: 'localhost_dev' };
      } else {
        corsDecision = { allowed: false, reason: 'not_allowed' };
      }
    }
    
    // Read actual response headers set by CORS middleware
    // Note: getHeader returns string | string[] | number | undefined
    // Use type assertion since Express Response has getHeader but TypeScript types may not reflect it
    const getHeaderString = (name: string): string | null => {
      const value = (res as any).getHeader(name);
      if (value === undefined) return null;
      if (Array.isArray(value)) return value[0] || null;
      return String(value);
    };
    
    const responseHeaders = {
      'access-control-allow-origin': getHeaderString('access-control-allow-origin'),
      'access-control-allow-credentials': getHeaderString('access-control-allow-credentials'),
      'access-control-allow-headers': getHeaderString('access-control-allow-headers'),
      'access-control-allow-methods': getHeaderString('access-control-allow-methods'),
    };
    
    const appCommit = getHeaderString('x-app-commit');
    
    return {
      originReceived,
      originNormalized,
      corsDecision,
      responseHeaders,
      requestId,
      appCommit,
      note: 'cors debug - responseHeaders show actual CORS headers sent to browser',
      timestamp: new Date().toISOString(),
    };
  }

  @Get('test-org')
  @UseGuards(JwtAuthGuard)
  testOrganization(@CurrentOrganization() organizationId: string) {
    return {
      message: 'Current organization endpoint test',
      organizationId,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * TEST-ONLY endpoint to bootstrap test organization and user
   * Only available when NODE_ENV=test or STAGING_TEST_MODE=true
   * Completely disabled in production
   */
  @Post('test/bootstrap')
  async bootstrapTestOrg(@Body() body: { email?: string; password?: string; orgName?: string }) {
    const nodeEnv = this.configService.get<string>('NODE_ENV');
    const testMode = this.configService.get<string>('STAGING_TEST_MODE') === 'true';

    // Only allow in test or staging test mode
    if (nodeEnv !== 'test' && !testMode) {
      throw new Error('Bootstrap endpoint is only available in test mode');
    }

    const email = body.email || 'test@example.com';
    const password = body.password || 'TestPassword123!';
    const orgName = body.orgName || 'Test Organization';

    // Check if user already exists
    let user = await this.prisma.user.findUnique({
      where: { email },
      include: { memberships: { include: { organization: true } } },
    });

    let org;
    if (user && user.memberships.length > 0) {
      org = user.memberships[0].organization;
    } else {
      // Create org if doesn't exist (generate slug from name)
      const slug = orgName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
      org = await this.prisma.organization.findUnique({
        where: { slug },
      });

      if (!org) {
        org = await this.prisma.organization.create({
          data: {
            name: orgName,
            slug: `${slug}-${Date.now()}`, // Make unique
          },
        });
      }

      // Create user if doesn't exist
      if (!user) {
        const hashedPassword = await bcrypt.hash(password, 10);
        user = await this.prisma.user.create({
          data: {
            email,
            passwordHash: hashedPassword,
            name: 'Test User',
          },
          include: { memberships: { include: { organization: true } } },
        });
      }

      // Create membership if doesn't exist
      const existingMembership = await this.prisma.membership.findUnique({
        where: {
          userId_organizationId: {
            userId: user.id,
            organizationId: org.id,
          },
        },
      });

      if (!existingMembership) {
        await this.prisma.membership.create({
          data: {
            userId: user.id,
            organizationId: org.id,
            role: 'OWNER',
          },
        });
      }
    }

    if (!user || !org) {
      throw new Error('Failed to create or retrieve test user and organization');
    }

    // Generate JWT token (simplified, in real app use AuthService)
    // For smoke tests, we'll use the actual auth/login endpoint instead
    return {
      organizationId: org.id,
      userId: user.id,
      email: user.email,
      message: 'Test organization and user created/retrieved. Use /api/auth/login to get token.',
    };
  }
}
