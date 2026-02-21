import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Res, Req } from '@nestjs/common';
import { Response, Request } from 'express';
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
import { DevLoginGuard } from '../common/guards/dev-login.guard';
import { ConfigService } from '@nestjs/config';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

  private setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    // TEMPORARY: Don't set domain to avoid cookie rejection issues
    // Host-only cookies work better across subdomains when using proxy
    const domain = undefined; // isProduction ? '.iphonealcosto.com' : undefined;
    
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax' as const,
      path: '/',
      domain,
      maxAge: 15 * 60 * 1000, // 15 minutes (matches JWT_EXPIRES_IN)
    };
    
    const refreshCookieOptions = {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days (matches JWT_REFRESH_EXPIRES_IN)
    };
    
    // Log cookie options for debugging (temporary)
    if (process.env.LOG_AUTH_COOKIES === 'true' || !isProduction) {
      console.log('[auth] Setting cookies with options:', JSON.stringify(cookieOptions, null, 2));
    }
    
    // Set access token cookie (httpOnly, secure in production)
    res.cookie('accessToken', accessToken, cookieOptions);

    // Set refresh token cookie (httpOnly, secure in production)
    res.cookie('refreshToken', refreshToken, refreshCookieOptions);
    
    // Log Set-Cookie headers after setting (temporary)
    if (process.env.LOG_AUTH_COOKIES === 'true' || !isProduction) {
      const setCookieHeader = res.getHeader('set-cookie');
      console.log('[auth] Set-Cookie header after setting:', setCookieHeader);
    }
  }

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
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);
    
    // If login returned tokens (single org), set cookies
    if ('accessToken' in result && 'refreshToken' in result) {
      this.setAuthCookies(res, result.accessToken, result.refreshToken);
    }
    
    return result;
  }

  @Public()
  @UseGuards(TempTokenGuard)
  @Post('select-organization')
  @HttpCode(HttpStatus.OK)
  async selectOrganization(
    @CurrentUser() user: any,
    @Body() dto: SelectOrganizationDto,
    @Res({ passthrough: true }) res: Response
  ) {
    // user comes from TempTokenGuard (contains userId from tempToken)
    const result = await this.authService.selectOrganization(user.sub, dto);
    
    // Set cookies after organization selection
    this.setAuthCookies(res, result.accessToken, result.refreshToken);
    
    return result;
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body('refreshToken') refreshTokenFromBody: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    // Try to get refresh token from cookie first, fallback to body
    const refreshToken = req.cookies?.refreshToken || refreshTokenFromBody;
    
    if (!refreshToken) {
      throw new Error('Refresh token not found in cookies or body');
    }
    
    const result = await this.authService.refreshToken(refreshToken);
    
    // Update access token cookie (refresh token cookie remains the same)
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const domain = isProduction ? '.iphonealcosto.com' : undefined;
    
    res.cookie('accessToken', result.accessToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      domain,
      maxAge: 15 * 60 * 1000, // 15 minutes
    });
    
    return result;
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Body('refreshToken') refreshTokenFromBody: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response
  ) {
    // Try to get refresh token from cookie first, fallback to body
    const refreshToken = req.cookies?.refreshToken || refreshTokenFromBody;
    
    if (refreshToken) {
      await this.authService.logout(refreshToken);
    }
    
    // Clear cookies
    const isProduction = this.configService.get('NODE_ENV') === 'production';
    const domain = isProduction ? '.iphonealcosto.com' : undefined;
    
    res.clearCookie('accessToken', { path: '/', domain });
    res.clearCookie('refreshToken', { path: '/', domain });
    
    return { message: 'Logged out successfully' };
  }

  @Public()
  @UseGuards(DevLoginGuard)
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  async devLogin() {
    return this.authService.devLogin();
  }
}
