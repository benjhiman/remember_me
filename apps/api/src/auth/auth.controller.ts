import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { SelectOrganizationDto } from './dto/select-organization.dto';
import { Public } from '../common/guards/public.decorator';
import { TempTokenGuard } from '../common/guards/temp-token.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @UseGuards(ThrottlerGuard, RateLimitGuard)
  @Throttle({ default: { limit: 3, ttl: 60000 } }) // 3 requests per minute per IP
  @RateLimit({ action: 'auth.register', limit: 3, windowSec: 60, skipIfDisabled: true })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Public()
  @UseGuards(ThrottlerGuard, RateLimitGuard)
  @Throttle({ default: { limit: 5, ttl: 60000 } }) // 5 requests per minute per IP
  @RateLimit({ action: 'auth.login', limit: 10, windowSec: 60, skipIfDisabled: true })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @Public()
  @UseGuards(TempTokenGuard)
  @Post('select-organization')
  @HttpCode(HttpStatus.OK)
  async selectOrganization(
    @CurrentUser() user: any,
    @Body() dto: SelectOrganizationDto
  ) {
    // user comes from TempTokenGuard (contains userId from tempToken)
    return this.authService.selectOrganization(user.sub, dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Body('refreshToken') refreshToken: string) {
    await this.authService.logout(refreshToken);
    return { message: 'Logged out successfully' };
  }
}
