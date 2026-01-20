import { Injectable, Logger, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { MetaTokenService } from './meta-token.service';
import { ExternalHttpClientService } from '../../common/http/external-http-client.service';

interface MetaAdAccount {
  id: string;
  name: string;
  account_status: number;
  currency: string;
  timezone_name: string;
}

interface MetaAdAccountsResponse {
  data: MetaAdAccount[];
  paging?: {
    cursors?: {
      before?: string;
      after?: string;
    };
    next?: string;
  };
}

@Injectable()
export class MetaAdsService {
  private readonly logger = new Logger(MetaAdsService.name);
  private readonly baseUrl = 'https://graph.facebook.com/v21.0';

  constructor(
    private readonly metaTokenService: MetaTokenService,
    private readonly httpClient: ExternalHttpClientService,
  ) {}

  /**
   * List ad accounts accessible by the organization's Meta account
   */
  async listAdAccounts(organizationId: string): Promise<
    Array<{
      id: string;
      name: string;
      accountStatus: number;
      currency: string;
      timezone: string;
    }>
  > {
    try {
      // Get valid access token (will refresh if needed)
      const accessToken = await this.metaTokenService.ensureValidToken(
        organizationId,
      );

      // Call Meta Graph API to list ad accounts
      const url = `${this.baseUrl}/me/adaccounts`;
      const params = new URLSearchParams({
        fields: 'id,name,account_status,currency,timezone_name',
        access_token: accessToken,
      });

      this.logger.log(`Fetching ad accounts for org ${organizationId}`);

      const response = await this.httpClient.get<MetaAdAccountsResponse>(
        `${url}?${params.toString()}`,
        {
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      if (!response.data) {
        this.logger.warn(`No ad accounts data returned for org ${organizationId}`);
        return [];
      }

      // Transform Meta API response to our format
      return response.data.map((account) => ({
        id: account.id,
        name: account.name || 'Unnamed Account',
        accountStatus: account.account_status,
        currency: account.currency || 'USD',
        timezone: account.timezone_name || 'UTC',
      }));
    } catch (error) {
      // Handle specific error cases
      if (error instanceof BadRequestException) {
        // Token not found or invalid
        if (error.message.includes('No valid access token')) {
          throw new BadRequestException(
            'Meta no conectado. Por favor, conecta tu cuenta de Meta a través de OAuth.',
          );
        }
        throw error;
      }

      // Handle Meta API errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('invalid') && errorMessage.includes('token')) {
          this.logger.error(`Invalid token for org ${organizationId}: ${error.message}`);
          throw new UnauthorizedException(
            'Token de Meta inválido. Por favor, reconecta tu cuenta de Meta.',
          );
        }

        if (errorMessage.includes('permission') || errorMessage.includes('access')) {
          this.logger.error(`Permission denied for org ${organizationId}: ${error.message}`);
          throw new UnauthorizedException(
            'No tienes permisos para acceder a las cuentas de anuncios. Verifica los permisos de tu cuenta de Meta.',
          );
        }
      }

      // Log error without exposing tokens
      this.logger.error(
        `Failed to fetch ad accounts for org ${organizationId}: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );

      throw new BadRequestException(
        'Error al obtener las cuentas de anuncios de Meta. Por favor, intenta nuevamente.',
      );
    }
  }
}
