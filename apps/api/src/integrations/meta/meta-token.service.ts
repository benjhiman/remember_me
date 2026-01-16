import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, ConnectedAccountStatus } from '@remember-me/prisma';

@Injectable()
export class MetaTokenService {
  private readonly logger = new Logger(MetaTokenService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v21.0';

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokenCrypto: TokenCryptoService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Ensure token is valid for organization
   * Returns decrypted token, refreshes if needed
   */
  async ensureValidToken(organizationId: string, provider: IntegrationProvider = IntegrationProvider.INSTAGRAM): Promise<string> {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: { in: [IntegrationProvider.INSTAGRAM, IntegrationProvider.FACEBOOK] },
        status: ConnectedAccountStatus.CONNECTED,
      },
      include: {
        oauthTokens: {
          where: {
            expiresAt: {
              gt: new Date(), // Not expired
            },
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    if (!account || account.oauthTokens.length === 0) {
      // Fallback to env var only in development
      if (process.env.NODE_ENV === 'development') {
        const envToken = this.configService.get<string>('META_PAGE_ACCESS_TOKEN');
        if (envToken) {
          this.logger.warn(`Using META_PAGE_ACCESS_TOKEN from env for org ${organizationId} (dev mode)`);
          return envToken;
        }
      }

      throw new BadRequestException(
        `No valid access token found for organization ${organizationId}. Please connect a Meta account via OAuth.`,
      );
    }

    const tokenRecord = account.oauthTokens[0];
    const expiresAt = tokenRecord.expiresAt;

    if (!expiresAt) {
      // No expiration, assume valid
      return this.tokenCrypto.decrypt(tokenRecord.accessTokenEncrypted);
    }

    // Check if token expires in less than 7 days
    const sevenDaysFromNow = new Date();
    sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);

    if (expiresAt < sevenDaysFromNow) {
      this.logger.log(`Token for account ${account.id} expires soon, attempting to extend...`);
      try {
        await this.extendToken(account.id, tokenRecord.id);
        // Fetch updated token
        const updatedToken = await this.prisma.oAuthToken.findUnique({
          where: { id: tokenRecord.id },
        });
        if (updatedToken) {
          return this.tokenCrypto.decrypt(updatedToken.accessTokenEncrypted);
        }
      } catch (error) {
        this.logger.error(
          `Failed to extend token for account ${account.id}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        // Return current token anyway (might still work)
      }
    }

    return this.tokenCrypto.decrypt(tokenRecord.accessTokenEncrypted);
  }

  /**
   * Extend long-lived token (refresh before expiration)
   */
  async extendToken(connectedAccountId: string, tokenId: string): Promise<void> {
    const tokenRecord = await this.prisma.oAuthToken.findUnique({
      where: { id: tokenId },
      include: {
        connectedAccount: true,
      },
    });

    if (!tokenRecord || tokenRecord.connectedAccountId !== connectedAccountId) {
      throw new BadRequestException('Token not found');
    }

    const currentToken = this.tokenCrypto.decrypt(tokenRecord.accessTokenEncrypted);
    const appId = this.configService.get<string>('META_APP_ID');
    const appSecret = this.configService.get<string>('META_APP_SECRET');

    if (!appId || !appSecret) {
      throw new BadRequestException('META_APP_ID and META_APP_SECRET required for token extension');
    }

    // Exchange for new long-lived token
    const url = `${this.baseUrl}/oauth/access_token`;
    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: currentToken,
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new BadRequestException(`Failed to extend token: ${errorText}`);
    }

    const data = (await response.json()) as { access_token: string };
    const newToken = data.access_token;

    // Calculate new expiration (60 days from now)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 60);

    // Encrypt and update
    const encryptedToken = this.tokenCrypto.encrypt(newToken);

    await this.prisma.oAuthToken.update({
      where: { id: tokenId },
      data: {
        accessTokenEncrypted: encryptedToken,
        expiresAt,
      },
    });

    this.logger.log(`Extended token for account ${connectedAccountId}`);
  }

  /**
   * Get ad account ID for organization
   * Uses first ad account from metadata or env var fallback
   */
  async getAdAccountId(organizationId: string, adAccountId?: string): Promise<string> {
    // If specific ad account requested, use it
    if (adAccountId) {
      return adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
    }

    // Try to get from ConnectedAccount metadata
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: { in: [IntegrationProvider.INSTAGRAM, IntegrationProvider.FACEBOOK] },
        status: ConnectedAccountStatus.CONNECTED,
      },
    });

    if (account?.metadataJson) {
      const metadata = account.metadataJson as any;
      if (metadata.adAccounts && metadata.adAccounts.length > 0) {
        const firstAccount = metadata.adAccounts[0];
        return firstAccount.id.startsWith('act_') ? firstAccount.id : `act_${firstAccount.id}`;
      }
    }

    // Fallback to env var (dev only)
    if (process.env.NODE_ENV === 'development') {
      const envAccountId = this.configService.get<string>('META_AD_ACCOUNT_ID');
      if (envAccountId) {
        this.logger.warn(`Using META_AD_ACCOUNT_ID from env for org ${organizationId} (dev mode)`);
        return envAccountId.startsWith('act_') ? envAccountId : `act_${envAccountId}`;
      }
    }

    throw new BadRequestException(
      `No ad account ID found for organization ${organizationId}. Connect a Meta account via OAuth or set META_AD_ACCOUNT_ID (dev only).`,
    );
  }

  /**
   * List available ad accounts for organization
   */
  async listAdAccounts(organizationId: string): Promise<Array<{ id: string; name: string }>> {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        organizationId,
        provider: { in: [IntegrationProvider.INSTAGRAM, IntegrationProvider.FACEBOOK] },
        status: ConnectedAccountStatus.CONNECTED,
      },
    });

    if (!account?.metadataJson) {
      return [];
    }

    const metadata = account.metadataJson as any;
    return metadata.adAccounts || [];
  }
}
