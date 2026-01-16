import { Test, TestingModule } from '@nestjs/testing';
import { MetaTokenService } from './meta-token.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, ConnectedAccountStatus } from '@remember-me/prisma';
import { BadRequestException } from '@nestjs/common';

describe('MetaTokenService', () => {
  let service: MetaTokenService;
  let prisma: PrismaService;

  const mockPrismaService = {
    connectedAccount: {
      findFirst: jest.fn(),
    },
    oAuthToken: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockTokenCrypto = {
    encrypt: jest.fn((text) => `encrypted-${text}`),
    decrypt: jest.fn((text) => text.replace('encrypted-', '')),
  };

  const mockConfigService = {
    get: jest.fn((key: string) => {
      const config: Record<string, string> = {
        META_APP_ID: 'app-123',
        META_APP_SECRET: 'secret-123',
        META_AD_ACCOUNT_ID: 'act_123',
        META_PAGE_ACCESS_TOKEN: 'env-token',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaTokenService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: TokenCryptoService,
          useValue: mockTokenCrypto,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MetaTokenService>(MetaTokenService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    jest.spyOn(global, 'fetch').mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('ensureValidToken', () => {
    it('should return decrypted token from ConnectedAccount', async () => {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        organizationId: 'org-1',
        provider: IntegrationProvider.INSTAGRAM,
        status: ConnectedAccountStatus.CONNECTED,
        oauthTokens: [
          {
            id: 'token-1',
            accessTokenEncrypted: 'encrypted-valid-token',
            expiresAt: futureDate,
          },
        ],
      });

      const token = await service.ensureValidToken('org-1');

      expect(token).toBe('valid-token');
      expect(mockTokenCrypto.decrypt).toHaveBeenCalledWith('encrypted-valid-token');
    });

    it('should extend token if expires in less than 7 days', async () => {
      const nearExpiry = new Date();
      nearExpiry.setDate(nearExpiry.getDate() + 5); // 5 days from now

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        organizationId: 'org-1',
        provider: IntegrationProvider.INSTAGRAM,
        status: ConnectedAccountStatus.CONNECTED,
        oauthTokens: [
          {
            id: 'token-1',
            accessTokenEncrypted: 'encrypted-old-token',
            expiresAt: nearExpiry,
          },
        ],
      });

      mockTokenCrypto.decrypt.mockReturnValue('old-token');
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'META_APP_ID') return 'app-123';
        if (key === 'META_APP_SECRET') return 'secret-123';
        return undefined as any;
      });

      mockPrismaService.oAuthToken.findUnique
        .mockResolvedValueOnce({
          id: 'token-1',
          accessTokenEncrypted: 'encrypted-old-token',
          expiresAt: nearExpiry,
          connectedAccountId: 'account-1',
          connectedAccount: {
            id: 'account-1',
          },
        })
        .mockResolvedValueOnce({
          id: 'token-1',
          accessTokenEncrypted: 'encrypted-new-token',
          expiresAt: new Date(),
        });

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-long-lived-token',
        }),
      } as Response);

      const token = await service.ensureValidToken('org-1');

      expect(mockPrismaService.oAuthToken.update).toHaveBeenCalled();
      expect(mockTokenCrypto.encrypt).toHaveBeenCalledWith('new-long-lived-token');
    });

    it('should fallback to env var in development mode', async () => {
      process.env.NODE_ENV = 'development';
      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue('env-token');

      const token = await service.ensureValidToken('org-1');

      expect(token).toBe('env-token');
    });

    it('should throw in production if no token found', async () => {
      process.env.NODE_ENV = 'production';
      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue(undefined as any);

      await expect(service.ensureValidToken('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('extendToken', () => {
    it('should extend token successfully', async () => {
      mockPrismaService.oAuthToken.findUnique.mockResolvedValue({
        id: 'token-1',
        connectedAccountId: 'account-1',
        accessTokenEncrypted: 'encrypted-old-token',
        connectedAccount: {
          id: 'account-1',
        },
      });

      mockTokenCrypto.decrypt.mockReturnValue('old-token');
      mockConfigService.get.mockImplementation((key: string) => {
        if (key === 'META_APP_ID') return 'app-123';
        if (key === 'META_APP_SECRET') return 'secret-123';
        return undefined as any;
      });

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'new-long-lived-token',
        }),
      } as Response);

      await service.extendToken('account-1', 'token-1');

      expect(mockTokenCrypto.decrypt).toHaveBeenCalledWith('encrypted-old-token');
      expect(mockTokenCrypto.encrypt).toHaveBeenCalledWith('new-long-lived-token');
      expect(mockPrismaService.oAuthToken.update).toHaveBeenCalled();
    });

    it('should throw if token not found', async () => {
      mockPrismaService.oAuthToken.findUnique.mockResolvedValue(null);

      await expect(service.extendToken('account-1', 'token-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if token extension fails', async () => {
      mockPrismaService.oAuthToken.findUnique.mockResolvedValue({
        id: 'token-1',
        connectedAccountId: 'account-1',
        accessTokenEncrypted: 'encrypted-old-token',
        connectedAccount: {
          id: 'account-1',
        },
      });

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid token',
      } as Response);

      await expect(service.extendToken('account-1', 'token-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getAdAccountId', () => {
    it('should return ad account from metadata', async () => {
      mockPrismaService.connectedAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        organizationId: 'org-1',
        metadataJson: {
          adAccounts: [
            {
              id: 'act_456',
              name: 'Ad Account 1',
            },
          ],
        },
      });

      const accountId = await service.getAdAccountId('org-1');

      expect(accountId).toBe('act_456');
    });

    it('should use specific ad account if provided', async () => {
      const accountId = await service.getAdAccountId('org-1', 'act_789');

      expect(accountId).toBe('act_789');
    });

    it('should add act_ prefix if missing', async () => {
      const accountId = await service.getAdAccountId('org-1', '789');

      expect(accountId).toBe('act_789');
    });

    it('should fallback to env var in development', async () => {
      process.env.NODE_ENV = 'development';
      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue('act_123');

      const accountId = await service.getAdAccountId('org-1');

      expect(accountId).toBe('act_123');
    });

    it('should throw if no ad account found in production', async () => {
      process.env.NODE_ENV = 'production';
      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockConfigService.get.mockReturnValue(undefined as any);

      await expect(service.getAdAccountId('org-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('listAdAccounts', () => {
    it('should return ad accounts from metadata', async () => {
      mockPrismaService.connectedAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        organizationId: 'org-1',
        metadataJson: {
          adAccounts: [
            {
              id: 'act_123',
              name: 'Account 1',
            },
            {
              id: 'act_456',
              name: 'Account 2',
            },
          ],
        },
      });

      const accounts = await service.listAdAccounts('org-1');

      expect(accounts).toHaveLength(2);
      expect(accounts[0].id).toBe('act_123');
    });

    it('should return empty array if no accounts found', async () => {
      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);

      const accounts = await service.listAdAccounts('org-1');

      expect(accounts).toEqual([]);
    });
  });
});
