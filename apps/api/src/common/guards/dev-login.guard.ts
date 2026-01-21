import {
  Injectable,
  CanActivate,
  ExecutionContext,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Guard for dev quick login endpoint
 * Only allows access if DEV_QUICK_LOGIN_ENABLED === 'true' and key matches
 * Returns 404 (not 401/403) to avoid revealing endpoint existence
 */
@Injectable()
export class DevLoginGuard implements CanActivate {
  private readonly logger = new Logger(DevLoginGuard.name);

  constructor(private configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    // Check if dev login is enabled
    const enabled = this.configService.get<string>('DEV_QUICK_LOGIN_ENABLED') === 'true';
    if (!enabled) {
      throw new NotFoundException();
    }

    // Get key from header
    const request = context.switchToHttp().getRequest();
    const providedKey = request.headers['x-dev-login-key'];
    const expectedKey = this.configService.get<string>('DEV_QUICK_LOGIN_KEY');

    // Validate key
    if (!expectedKey || !providedKey || providedKey !== expectedKey) {
      // Return 404 to avoid revealing endpoint
      throw new NotFoundException();
    }

    return true;
  }
}
