import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';

export interface TempTokenPayload {
  sub: string; // userId
  type: 'org_selection';
  jti?: string; // Optional: JWT ID for revocation
}

@Injectable()
export class TempTokenStrategy extends PassportStrategy(Strategy, 'temp-token') {
  constructor(private configService: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get('JWT_SECRET'),
    });
  }

  async validate(payload: any): Promise<TempTokenPayload> {
    // Validate payload structure
    if (!payload.sub || payload.type !== 'org_selection') {
      throw new UnauthorizedException('Invalid temporary token payload');
    }

    return {
      sub: payload.sub,
      type: payload.type,
      jti: payload.jti,
    };
  }
}
