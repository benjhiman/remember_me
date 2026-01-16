import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class TempTokenGuard extends AuthGuard('temp-token') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Invalid or expired temporary token');
    }

    // Verify token type
    if (user.type !== 'org_selection') {
      throw new UnauthorizedException('Invalid token type for organization selection');
    }

    return user;
  }
}
