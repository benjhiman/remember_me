import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { AuthResponseDto } from './dto/auth-response.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { SelectOrganizationDto } from './dto/select-organization.dto';
import { Role, InviteStatus } from '@remember-me/prisma';
import { ORG_SETTINGS_DEFAULTS } from '../settings/org-settings.defaults';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponseDto> {
    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 10);

    // If invitation token is provided, accept invitation
    if (dto.invitationToken) {
      return this.registerWithInvitation(dto, passwordHash);
    }

    // Otherwise, create new organization (original flow)
    if (!dto.organizationName) {
      throw new BadRequestException('Organization name is required when not using an invitation');
    }

    // Generate organization slug if not provided
    let organizationSlug = dto.organizationSlug;
    if (!organizationSlug) {
      organizationSlug = dto.organizationName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
    }

    // Check if organization slug is already taken
    const existingOrg = await this.prisma.organization.findUnique({
      where: { slug: organizationSlug },
    });

    if (existingOrg) {
      throw new ConflictException('Organization slug is already taken');
    }

    // Create user, organization, and membership in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create organization
      const organization = await tx.organization.create({
        data: {
          name: dto.organizationName!,
          slug: organizationSlug!,
        },
      });

      // Create user
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          name: dto.name,
        },
      });

      // Create membership with OWNER role
      await tx.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.OWNER,
        },
      });

      return { user, organization };
    });

    // Generate tokens
    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.organization.id,
      Role.OWNER
    );

    return {
      ...tokens,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        organizationId: result.organization.id,
        organizationName: result.organization.name,
        role: Role.OWNER,
      },
    };
  }

  private async registerWithInvitation(dto: RegisterDto, passwordHash: string): Promise<AuthResponseDto> {
    // Find and validate invitation
    const invitation = await this.prisma.invitation.findUnique({
      where: { token: dto.invitationToken },
      include: {
        organization: true,
      },
    });

    if (!invitation) {
      throw new NotFoundException('Invalid invitation token');
    }

    if (invitation.status !== InviteStatus.PENDING) {
      throw new BadRequestException('Invitation has already been used or cancelled');
    }

    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException('Invitation has expired');
    }

    if (invitation.email !== dto.email) {
      throw new BadRequestException('Email does not match the invitation');
    }

    // Create or update user and accept invitation in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Check if user already exists (from "Alta vendedor")
      let user = await tx.user.findUnique({
        where: { email: dto.email },
      });

      if (user) {
        // User exists: update password and name if provided
        user = await tx.user.update({
          where: { id: user.id },
          data: {
            passwordHash,
            name: dto.name || user.name,
            emailVerified: true,
          },
        });

        // Check if membership already exists
        const existingMembership = await tx.membership.findFirst({
          where: {
            userId: user.id,
            organizationId: invitation.organizationId,
          },
        });

        if (!existingMembership) {
          // Create membership if it doesn't exist
          await tx.membership.create({
            data: {
              userId: user.id,
              organizationId: invitation.organizationId,
              role: invitation.role,
            },
          });
        }
      } else {
        // Create new user
        user = await tx.user.create({
          data: {
            email: dto.email,
            passwordHash,
            name: dto.name,
            emailVerified: true,
          },
        });

        // Create membership with the role from invitation
        await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: invitation.organizationId,
            role: invitation.role,
          },
        });
      }

      // Mark invitation as accepted
      await tx.invitation.update({
        where: { id: invitation.id },
        data: {
          status: InviteStatus.ACCEPTED,
          acceptedAt: new Date(),
        },
      });

      return { user, organization: invitation.organization };
    });

    // Generate tokens
    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.organization.id,
      invitation.role
    );

    return {
      ...tokens,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        organizationId: result.organization.id,
        organizationName: result.organization.name,
        role: invitation.role,
      },
    };
  }

  async login(dto: LoginDto): Promise<LoginResponseDto> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: {
        memberships: {
          include: {
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.memberships.length === 0) {
      throw new BadRequestException('User is not a member of any organization');
    }

    // If user has only one organization, login directly
    if (user.memberships.length === 1) {
      const membership = user.memberships[0];
      const tokens = await this.generateTokens(
        user.id,
        user.email,
        membership.organizationId,
        membership.role
      );

      return {
        ...tokens,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          organizationId: membership.organizationId,
          organizationName: membership.organization.name,
          role: membership.role,
        },
      };
    }

    // If user has multiple organizations, return list for selection with tempToken
    const tempToken = this.generateTempToken(user.id);

    return {
      organizations: user.memberships.map((m) => ({
        id: m.organization.id,
        name: m.organization.name,
        slug: m.organization.slug,
        role: m.role,
      })),
      requiresOrgSelection: true,
      tempToken,
    };
  }

  async selectOrganization(userId: string, dto: SelectOrganizationDto): Promise<AuthResponseDto> {
    // Verify user is member of the organization
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId,
        organizationId: dto.organizationId,
      },
      include: {
        organization: true,
        user: true,
      },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    // Generate tokens
    const tokens = await this.generateTokens(
      userId,
      membership.user.email,
      dto.organizationId,
      membership.role
    );

    return {
      ...tokens,
      user: {
        id: membership.user.id,
        email: membership.user.email,
        name: membership.user.name,
        organizationId: membership.organization.id,
        organizationName: membership.organization.name,
        role: membership.role,
      },
    };
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string }> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });

      // Verify token exists in database
      const tokenRecord = await this.prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: {
          user: {
            include: {
              memberships: {
                include: {
                  organization: true,
                },
              },
            },
          },
        },
      });

      if (!tokenRecord || tokenRecord.userId !== payload.sub) {
        throw new UnauthorizedException('Invalid refresh token');
      }

      // Check if token is expired (shouldn't happen due to verify, but double-check)
      if (tokenRecord.expiresAt < new Date()) {
        throw new UnauthorizedException('Refresh token expired');
      }

      // Get user's first membership
      const membership = tokenRecord.user.memberships[0];
      if (!membership) {
        throw new UnauthorizedException('User is not a member of any organization');
      }

      // Generate new access token
      const accessToken = this.jwtService.sign(
        {
          sub: tokenRecord.userId,
          email: tokenRecord.user.email,
          organizationId: membership.organizationId,
          role: membership.role,
        },
        {
          secret: this.configService.get('JWT_SECRET'),
          expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
        }
      );

      return { accessToken };
    } catch (error) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string): Promise<void> {
    await this.prisma.refreshToken.deleteMany({
      where: { token: refreshToken },
    });
  }

  /**
   * Dev Quick Login - Creates or logs in test user
   * Only works if DEV_QUICK_LOGIN_ENABLED === 'true'
   * Idempotent: creates user/org if they don't exist, otherwise logs in
   */
  async devLogin(): Promise<AuthResponseDto> {
    const testEmail = 'test@iphonealcosto.com';
    const testPassword = 'Test1234!!';
    const testName = 'Test User';
    const orgName = 'iPhone al costo';
    const orgSlug = 'iphone-al-costo';

    // Find or create user and organization
    const result = await this.prisma.$transaction(async (tx) => {
      // Find or create user
      let user = await tx.user.findUnique({
        where: { email: testEmail },
      });

      if (!user) {
        const passwordHash = await bcrypt.hash(testPassword, 10);
        user = await tx.user.create({
          data: {
            email: testEmail,
            passwordHash,
            name: testName,
          },
        });
      }

      // Find or create organization
      let organization = await tx.organization.findUnique({
        where: { slug: orgSlug },
      });

      if (!organization) {
        organization = await tx.organization.create({
          data: {
            name: orgName,
            slug: orgSlug,
            settings: {
              crm: {
                ...ORG_SETTINGS_DEFAULTS.crm,
                branding: {
                  ...(ORG_SETTINGS_DEFAULTS.crm as any).branding,
                  name: `${orgName} CRM`,
                },
              },
            } as any,
          },
        });
      }

      // Ensure membership exists
      let membership = await tx.membership.findFirst({
        where: {
          userId: user.id,
          organizationId: organization.id,
        },
      });

      if (!membership) {
        membership = await tx.membership.create({
          data: {
            userId: user.id,
            organizationId: organization.id,
            role: Role.OWNER,
          },
        });
      }

      return { user, organization, membership };
    });

    // Generate tokens
    const tokens = await this.generateTokens(
      result.user.id,
      result.user.email,
      result.organization.id,
      result.membership.role
    );

    return {
      ...tokens,
      user: {
        id: result.user.id,
        email: result.user.email,
        name: result.user.name,
        organizationId: result.organization.id,
        organizationName: result.organization.name,
        role: result.membership.role,
      },
    };
  }

  private generateTempToken(userId: string): string {
    // Generate temporary token for organization selection
    // TTL: 5 minutes
    return this.jwtService.sign(
      {
        sub: userId,
        type: 'org_selection',
        jti: crypto.randomBytes(16).toString('hex'), // JWT ID for potential revocation
      },
      {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: '5m',
      }
    );
  }

  private async generateTokens(
    userId: string,
    email: string,
    organizationId: string,
    role: Role
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = {
      sub: userId,
      email,
      organizationId,
      role,
    };

    const accessToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_SECRET'),
      expiresIn: this.configService.get('JWT_EXPIRES_IN') || '15m',
    });

    const refreshToken = this.jwtService.sign(payload, {
      secret: this.configService.get('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN') || '7d',
    });

    // Store refresh token in database
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    await this.prisma.refreshToken.create({
      data: {
        token: refreshToken,
        userId,
        organizationId,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
