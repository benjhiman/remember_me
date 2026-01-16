import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, ConnectedAccountStatus } from '@remember-me/prisma';
import * as crypto from 'crypto';

interface OAuthState {
  organizationId: string;
  userId: string;
  nonce: string;
  timestamp: number;
}

@Injectable()
export class MetaOAuthService {
  private readonly logger = new Logger(MetaOAuthService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v21.0';
  private readonly oauthBaseUrl = 'https://www.facebook.com/v21.0/dialog/oauth';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Get OAuth configuration from env vars
   */
  private getOAuthConfig() {
    const appId = this.configService.get<string>('META_APP_ID');
    const appSecret = this.configService.get<string>('META_APP_SECRET');
    const redirectUri = this.configService.get<string>('META_OAUTH_REDIRECT_URI');

    if (!appId || !appSecret) {
      throw new BadRequestException(
        'META_APP_ID and META_APP_SECRET environment variables are required for OAuth',
      );
    }

    return {
      appId,
      appSecret,
      redirectUri: redirectUri || `${this.configService.get<string>('FRONTEND_URL') || 'http://localhost:3000'}/api/integrations/meta/oauth/callback`,
    };
  }

  /**
   * Generate signed state for OAuth flow (CSRF protection)
   */
  generateOAuthState(organizationId: string, userId: string): string {
    const nonce = crypto.randomBytes(16).toString('hex');
    const timestamp = Date.now();

    const state: OAuthState = {
      organizationId,
      userId,
      nonce,
      timestamp,
    };

    // Sign state with app secret
    const appSecret = this.configService.get<string>('META_APP_SECRET');
    if (!appSecret) {
      throw new BadRequestException('META_APP_SECRET is required for OAuth state signing');
    }

    const stateJson = JSON.stringify(state);
    const signature = crypto
      .createHmac('sha256', appSecret)
      .update(stateJson)
      .digest('hex');

    // Combine state + signature
    const signedState = Buffer.from(JSON.stringify({ state, signature })).toString('base64url');

    return signedState;
  }

  /**
   * Verify and parse OAuth state
   */
  verifyOAuthState(signedState: string): OAuthState {
    try {
      const decoded = JSON.parse(Buffer.from(signedState, 'base64url').toString('utf8'));
      const { state, signature } = decoded;

      // Verify signature
      const appSecret = this.configService.get<string>('META_APP_SECRET');
      if (!appSecret) {
        throw new BadRequestException('META_APP_SECRET is required for OAuth state verification');
      }

      const stateJson = JSON.stringify(state);
      const expectedSignature = crypto
        .createHmac('sha256', appSecret)
        .update(stateJson)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new UnauthorizedException('Invalid OAuth state signature');
      }

      // Check timestamp (state expires after 10 minutes)
      const maxAge = 10 * 60 * 1000; // 10 minutes
      if (Date.now() - state.timestamp > maxAge) {
        throw new UnauthorizedException('OAuth state expired');
      }

      return state as OAuthState;
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid OAuth state format');
    }
  }

  /**
   * Generate OAuth authorization URL
   */
  getAuthorizationUrl(organizationId: string, userId: string): { url: string; state: string } {
    const config = this.getOAuthConfig();
    const state = this.generateOAuthState(organizationId, userId);

    // Required scopes for Instagram + Marketing API
    const scopes = [
      'instagram_basic',
      'instagram_manage_messages',
      'pages_read_engagement',
      'pages_manage_metadata',
      'ads_read',
      'ads_management',
      'business_management',
    ].join(',');

    const params = new URLSearchParams({
      client_id: config.appId,
      redirect_uri: config.redirectUri,
      state,
      scope: scopes,
      response_type: 'code',
    });

    const url = `${this.oauthBaseUrl}?${params.toString()}`;

    return { url, state };
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(
    code: string,
    state: string,
  ): Promise<{ connectedAccountId: string; accessToken: string; expiresIn: number }> {
    const verifiedState = this.verifyOAuthState(state);
    const config = this.getOAuthConfig();

    // Exchange code for short-lived token
    const tokenUrl = `${this.baseUrl}/oauth/access_token`;
    const tokenParams = new URLSearchParams({
      client_id: config.appId,
      client_secret: config.appSecret,
      redirect_uri: config.redirectUri,
      code,
    });

    const tokenResponse = await fetch(`${tokenUrl}?${tokenParams.toString()}`, {
      method: 'GET',
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new BadRequestException(`Failed to exchange code for token: ${errorText}`);
    }

    const tokenData = (await tokenResponse.json()) as {
      access_token: string;
      expires_in?: number;
      scopes?: string[];
    };
    const shortLivedToken = tokenData.access_token;
    const expiresIn = tokenData.expires_in || 3600; // Default 1 hour

    // Exchange for long-lived token (60 days)
    const longLivedToken = await this.exchangeForLongLivedToken(shortLivedToken, config.appId, config.appSecret);

    // Get user info and pages
    const userInfo = await this.getUserInfo(longLivedToken);
    const pages = await this.getPages(longLivedToken);
    const adAccounts = await this.getAdAccounts(longLivedToken);

    // Find or create ConnectedAccount
    const externalAccountId = userInfo.id || pages[0]?.id || 'unknown';
    let connectedAccount = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId: verifiedState.organizationId,
        provider: IntegrationProvider.INSTAGRAM,
        externalAccountId,
      },
    });

    const metadata = {
      metaUserId: userInfo.id,
      pageId: pages[0]?.id,
      igUserId: pages[0]?.instagram_business_account?.id,
      adAccounts: adAccounts.map((acc) => ({
        id: acc.account_id,
        name: acc.name,
      })),
    };

    if (connectedAccount) {
      // Update existing
      connectedAccount = await this.prisma.connectedAccount.update({
        where: { id: connectedAccount.id },
        data: {
          displayName: pages[0]?.name || userInfo.name || 'Meta Account',
          status: ConnectedAccountStatus.CONNECTED,
          metadataJson: metadata,
        },
      });
    } else {
      // Create new
      connectedAccount = await this.prisma.connectedAccount.create({
        data: {
          organizationId: verifiedState.organizationId,
          provider: IntegrationProvider.INSTAGRAM,
          externalAccountId,
          displayName: pages[0]?.name || userInfo.name || 'Meta Account',
          status: ConnectedAccountStatus.CONNECTED,
          metadataJson: metadata,
        },
      });
    }

    // Calculate expiration (long-lived tokens last 60 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    // Encrypt and store token
    const encryptedToken = this.tokenCrypto.encrypt(longLivedToken);

    // Find or create OAuthToken
    const existingToken = await this.prisma.oAuthToken.findFirst({
      where: {
        connectedAccountId: connectedAccount.id,
      },
    });

    if (existingToken) {
      await this.prisma.oAuthToken.update({
        where: { id: existingToken.id },
        data: {
          accessTokenEncrypted: encryptedToken,
          expiresAt,
          scopes: (tokenData.scopes || []) as string[],
        },
      });
    } else {
      await this.prisma.oAuthToken.create({
        data: {
          connectedAccountId: connectedAccount.id,
          accessTokenEncrypted: encryptedToken,
          expiresAt,
          scopes: (tokenData.scopes || []) as string[],
        },
      });
    }

    this.logger.log(
      `OAuth flow completed for org ${verifiedState.organizationId}, account ${connectedAccount.id}`,
    );

    return {
      connectedAccountId: connectedAccount.id,
      accessToken: longLivedToken, // Return plain for immediate use (not stored)
      expiresIn: 60 * 24 * 60 * 60, // 60 days in seconds
    };
  }

  /**
   * Exchange short-lived token for long-lived token (60 days)
   */
  private async exchangeForLongLivedToken(
    shortLivedToken: string,
    appId: string,
    appSecret: string,
  ): Promise<string> {
    const url = `${this.baseUrl}/oauth/access_token`;
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(`Failed to exchange for long-lived token: ${errorText}`);
    }

    const data = (await response.json()) as { access_token: string };
    return data.access_token;
  }

  /**
   * Get user info from Meta API
   */
  private async getUserInfo(accessToken: string): Promise<any> {
    const url = `${this.baseUrl}/me?fields=id,name&access_token=${accessToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      this.logger.warn('Failed to get user info, continuing without it');
      return { id: null, name: null };
    }

    return response.json();
  }

  /**
   * Get pages managed by user
   */
  private async getPages(accessToken: string): Promise<any[]> {
    const url = `${this.baseUrl}/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      this.logger.warn('Failed to get pages, continuing without them');
      return [];
    }

    const data = (await response.json()) as { data?: any[] };
    return data.data || [];
  }

  /**
   * Get ad accounts
   */
  private async getAdAccounts(accessToken: string): Promise<any[]> {
    const url = `${this.baseUrl}/me/adaccounts?fields=account_id,name&access_token=${accessToken}`;
    const response = await fetch(url);

    if (!response.ok) {
      this.logger.warn('Failed to get ad accounts, continuing without them');
      return [];
    }

    const data = (await response.json()) as { data?: any[] };
    return data.data || [];
  }

  /**
   * Disconnect account (revoke token and mark as DISCONNECTED)
   */
  async disconnectAccount(organizationId: string, connectedAccountId: string): Promise<void> {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        id: connectedAccountId,
        organizationId,
      },
      include: {
        oauthTokens: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!account) {
      throw new BadRequestException('Connected account not found');
    }

    // Try to revoke token at Meta
    if (account.oauthTokens.length > 0) {
      try {
        const token = this.tokenCrypto.decrypt(account.oauthTokens[0].accessTokenEncrypted);
        await fetch(`${this.baseUrl}/me/permissions?access_token=${token}`, {
          method: 'DELETE',
        });
      } catch (error) {
        this.logger.warn(`Failed to revoke token at Meta: ${error instanceof Error ? error.message : 'Unknown error'}`);
        // Continue with disconnection even if revocation fails
      }
    }

    // Mark account as DISCONNECTED
    await this.prisma.connectedAccount.update({
      where: { id: connectedAccountId },
      data: { status: ConnectedAccountStatus.DISCONNECTED },
    });

    // Delete OAuth tokens
    await this.prisma.oAuthToken.deleteMany({
      where: { connectedAccountId },
    });

    this.logger.log(`Disconnected Meta account ${connectedAccountId} for org ${organizationId}`);
  }
}
