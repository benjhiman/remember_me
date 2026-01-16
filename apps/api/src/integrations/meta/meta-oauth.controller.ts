import {
  Controller,
  Get,
  Post,
  Query,
  Param,
  UseGuards,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { MetaOAuthService } from './meta-oauth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { Role } from '@remember-me/prisma';
import { Public } from '../../common/guards/public.decorator';

@Controller('integrations/meta/oauth')
export class MetaOAuthController {
  constructor(private readonly metaOAuthService: MetaOAuthService) {}

  /**
   * Start OAuth flow - generates authorization URL
   */
  @Get('start')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async startOAuth(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const { url } = this.metaOAuthService.getAuthorizationUrl(organizationId, user.userId);

    // Redirect directly to Meta OAuth URL
    return res.redirect(url);
  }

  /**
   * OAuth callback - exchanges code for token
   * This endpoint is public (called by Meta)
   */
  @Get('callback')
  @Public()
  async callback(
    @Query('code') code: string,
    @Query('state') state: string,
    @Query('error') error: string,
    @Query('error_reason') errorReason: string,
    @Res() res: Response,
  ) {
    if (error) {
      // User denied permission or error occurred
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(
        `${frontendUrl}/settings/integrations?error=${encodeURIComponent(error)}&reason=${encodeURIComponent(errorReason || '')}`
      );
    }

    if (!code || !state) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/settings/integrations?error=missing_params`);
    }

    try {
      const result = await this.metaOAuthService.exchangeCodeForToken(code, state);
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      return res.redirect(`${frontendUrl}/integrations/meta/oauth/success?accountId=${result.connectedAccountId}`);
    } catch (error) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return res.redirect(
        `${frontendUrl}/settings/integrations?error=${encodeURIComponent(errorMessage)}`
      );
    }
  }

  /**
   * Disconnect Meta account
   */
  @Post('disconnect/:accountId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  async disconnect(
    @CurrentOrganization() organizationId: string,
    @Param('accountId') accountId: string,
  ) {
    await this.metaOAuthService.disconnectAccount(organizationId, accountId);
    return { message: 'Account disconnected successfully' };
  }
}
