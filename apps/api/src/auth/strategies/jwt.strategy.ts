import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string;
  email: string;
  organizationId: string;
  role: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
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
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: payload.sub,
        organizationId: payload.organizationId,
      },
    });

    if (!membership) {
      throw new UnauthorizedException('User is not a member of this organization');
    }

    // Verify role matches (in case it changed)
    if (membership.role !== payload.role) {
      throw new UnauthorizedException('Role mismatch - please login again');
    }

    return {
      userId: user.id,
      email: user.email,
      organizationId: payload.organizationId,
      role: payload.role,
    };
  }
}
