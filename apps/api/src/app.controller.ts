import { Public } from './common/decorators/public.decorator';
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
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

  @Get()
  getHello(): string {
    return this.appService.getHello();
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
  getCorsDebug(@Req() req: Request) {
    const originReceived = (req.headers as any).origin || null;
    const requestId = (req as any).requestId || (req.headers as any)['x-request-id'] || null;
    
    // Note: allowOriginHeader will be set by CORS middleware, we can't read it here
    // But we can check if origin was received and if it matches expected pattern
    const corsAllowed = originReceived 
      ? (originReceived === 'https://app.iphonealcosto.com' || 
         originReceived.includes('.iphonealcosto.com') ||
         originReceived.includes('.vercel.app'))
      : null;
    
    return {
      originReceived,
      corsAllowed,
      requestId,
      note: 'cors debug - check response headers for access-control-allow-origin',
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
