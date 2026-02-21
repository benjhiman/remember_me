import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { Role } from '@remember-me/prisma';

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  private readonly logger = new Logger(JwtStrategy.name);
  private autoPromoteLogged = false;

  constructor(
    private configService: ConfigService,
    private prisma: PrismaService
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // First try to extract from cookie (httpOnly)
        (request: any) => {
          if (request?.cookies?.accessToken) {
            return request.cookies.accessToken;
          }
          return null;
        },
        // Fallback to Authorization header (Bearer token)
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    // Verify user still exists
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Verify membership exists and matches the token
    let membership = await this.prisma.membership.findFirst({
      where: {
        userId: payload.sub,
        organizationId: payload.organizationId,
      },
    });

    if (!membership) {
      throw new UnauthorizedException('User is not a member of this organization');
    }

    // Auto-promote to OWNER if enabled and email matches
    const autoPromoteEnabled = this.configService.get('AUTO_PROMOTE_OWNER_ENABLED') === 'true';
    const autoPromoteEmail = this.configService.get('AUTO_PROMOTE_OWNER_EMAIL');
    let wasAutoPromoted = false;

    if (autoPromoteEnabled && autoPromoteEmail && user.email === autoPromoteEmail) {
      // Log once on first use
      if (!this.autoPromoteLogged) {
        this.logger.log(`Auto-promote OWNER enabled for ${autoPromoteEmail}`);
        this.autoPromoteLogged = true;
      }

      // Only update if not already OWNER (idempotent)
      if (membership.role !== Role.OWNER) {
        try {
          // Update all memberships for this user to OWNER
          const updateCount = await this.prisma.membership.updateMany({
            where: {
              userId: user.id,
              role: { not: Role.OWNER },
            },
            data: { role: Role.OWNER },
          });

          if (updateCount.count > 0) {
            this.logger.log(
              `Auto-promoted user ${user.email} to OWNER (${updateCount.count} membership(s) updated)`
            );

            // Re-fetch the membership for this organization to get updated role
            const updatedMembership = await this.prisma.membership.findFirst({
              where: {
                userId: payload.sub,
                organizationId: payload.organizationId,
              },
            });

            if (!updatedMembership) {
              throw new UnauthorizedException('Membership not found after auto-promotion');
            }

            membership = updatedMembership;
            wasAutoPromoted = true;
          }
        } catch (error) {
          // Log error but don't break the request
          this.logger.warn(
            `Failed to auto-promote user ${user.email} to OWNER: ${error instanceof Error ? error.message : 'Unknown error'}`
          );
        }
      }
    }

    // Use the actual role from DB (which may have been auto-promoted)
    const actualRole = membership.role;

    // Verify role matches (in case it changed), but allow mismatch if we just auto-promoted
    if (!wasAutoPromoted && actualRole !== payload.role) {
      throw new UnauthorizedException('Role mismatch - please login again');
    }

    return {
      userId: user.id,
      email: user.email,
      organizationId: payload.organizationId,
      role: actualRole, // Use actual role from DB (may be OWNER after auto-promotion)
    };
  }
}
