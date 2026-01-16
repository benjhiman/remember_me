import { Test, TestingModule } from '@nestjs/testing';
import { MetaOAuthService } from './meta-oauth.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TokenCryptoService } from '../../common/crypto/token-crypto.service';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, ConnectedAccountStatus } from '@remember-me/prisma';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';

describe('MetaOAuthService', () => {
  let service: MetaOAuthService;
  let prisma: PrismaService;

  const mockPrismaService = {
    connectedAccount: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    oAuthToken: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      deleteMany: jest.fn(),
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
        META_OAUTH_REDIRECT_URI: 'http://localhost:3000/callback',
        FRONTEND_URL: 'http://localhost:3000',
      };
      return config[key];
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaOAuthService,
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

    service = module.get<MetaOAuthService>(MetaOAuthService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
    jest.spyOn(global, 'fetch').mockClear();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('generateOAuthState', () => {
    it('should generate signed state with organizationId and userId', () => {
      const state = service['generateOAuthState']('org-1', 'user-1');

      expect(state).toBeDefined();
      expect(state.length).toBeGreaterThan(0);
    });

    it('should generate different states for different inputs', () => {
      const state1 = service['generateOAuthState']('org-1', 'user-1');
      const state2 = service['generateOAuthState']('org-2', 'user-2');

      expect(state1).not.toBe(state2);
    });
  });

  describe('verifyOAuthState', () => {
    it('should verify valid state', () => {
      const state = service['generateOAuthState']('org-1', 'user-1');
      const verified = service['verifyOAuthState'](state);

      expect(verified.organizationId).toBe('org-1');
      expect(verified.userId).toBe('user-1');
      expect(verified.nonce).toBeDefined();
    });

    it('should throw if state signature is invalid', () => {
      const state = service['generateOAuthState']('org-1', 'user-1');
      const tampered = state.slice(0, -10) + 'tampered';

      expect(() => service['verifyOAuthState'](tampered)).toThrow(UnauthorizedException);
    });

    it('should throw if state is expired', () => {
      // Create expired state manually (11 minutes ago)
      const expiredState = {
        organizationId: 'org-1',
        userId: 'user-1',
        nonce: 'test-nonce',
        timestamp: Date.now() - 11 * 60 * 1000, // 11 minutes ago
      };
      const appSecret = mockConfigService.get('META_APP_SECRET');
      const crypto = require('crypto');
      const stateJson = JSON.stringify(expiredState);
      const signature = crypto.createHmac('sha256', appSecret).update(stateJson).digest('hex');
      const signedState = Buffer.from(JSON.stringify({ state: expiredState, signature })).toString('base64url');

      expect(() => service['verifyOAuthState'](signedState)).toThrow(UnauthorizedException);
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate authorization URL with correct scopes', () => {
      const result = service.getAuthorizationUrl('org-1', 'user-1');

      expect(result.url).toContain('facebook.com');
      expect(result.url).toContain('client_id=app-123');
      expect(result.url).toContain('redirect_uri');
      expect(result.url).toContain('instagram_basic');
      expect(result.url).toContain('ads_read');
      expect(result.state).toBeDefined();
    });
  });

  describe('exchangeCodeForToken', () => {
    beforeEach(() => {
      // Mock token exchange
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'short-lived-token',
          expires_in: 3600,
          scopes: ['instagram_basic', 'ads_read'],
        }),
      } as Response);

      // Mock long-lived token exchange
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'long-lived-token',
        }),
      } as Response);

      // Mock user info
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'user-123',
          name: 'Test User',
        }),
      } as Response);

      // Mock pages
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              id: 'page-123',
              name: 'Test Page',
              instagram_business_account: {
                id: 'ig-123',
              },
            },
          ],
        }),
      } as Response);

      // Mock ad accounts
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          data: [
            {
              account_id: 'act_123',
              name: 'Ad Account 1',
            },
          ],
        }),
      } as Response);

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.connectedAccount.create.mockResolvedValue({
        id: 'account-1',
        organizationId: 'org-1',
        provider: IntegrationProvider.INSTAGRAM,
        externalAccountId: 'user-123',
      });

      mockPrismaService.oAuthToken.findFirst.mockResolvedValue(null);
      mockPrismaService.oAuthToken.create.mockResolvedValue({
        id: 'token-1',
        connectedAccountId: 'account-1',
      });
    });

    it('should exchange code for token and create ConnectedAccount', async () => {
      const state = service['generateOAuthState']('org-1', 'user-1');

      const result = await service.exchangeCodeForToken('auth-code', state);

      expect(result.connectedAccountId).toBe('account-1');
      expect(result.accessToken).toBe('long-lived-token');
      expect(mockPrismaService.connectedAccount.create).toHaveBeenCalled();
      expect(mockTokenCrypto.encrypt).toHaveBeenCalledWith('long-lived-token');
    });

    it('should update existing ConnectedAccount if found', async () => {
      mockPrismaService.connectedAccount.findFirst.mockResolvedValue({
        id: 'existing-account',
        organizationId: 'org-1',
        provider: IntegrationProvider.INSTAGRAM,
        externalAccountId: 'user-123',
      });
      mockPrismaService.connectedAccount.update.mockResolvedValue({
        id: 'existing-account',
        organizationId: 'org-1',
        provider: IntegrationProvider.INSTAGRAM,
        externalAccountId: 'user-123',
        displayName: 'Test Page',
        status: ConnectedAccountStatus.CONNECTED,
      });

      const state = service['generateOAuthState']('org-1', 'user-1');
      await service.exchangeCodeForToken('auth-code', state);

      expect(mockPrismaService.connectedAccount.update).toHaveBeenCalled();
      expect(mockPrismaService.connectedAccount.create).not.toHaveBeenCalled();
    });

    it('should throw if state is invalid', async () => {
      await expect(service.exchangeCodeForToken('auth-code', 'invalid-state')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw if token exchange fails', async () => {
      // Restore all mocks to clear beforeEach setup
      jest.restoreAllMocks();
      jest.clearAllMocks();

      // Mock failed token exchange (only one call, should fail immediately)
      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => 'Invalid code',
      } as Response);

      const state = service['generateOAuthState']('org-1', 'user-1');

      await expect(service.exchangeCodeForToken('invalid-code', state)).rejects.toThrow(
        BadRequestException,
      );

      // Verify fetch was called only once (for token exchange, should fail)
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('disconnectAccount', () => {
    it('should disconnect account and delete tokens', async () => {
      mockPrismaService.connectedAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        organizationId: 'org-1',
        oauthTokens: [
          {
            id: 'token-1',
            accessTokenEncrypted: 'encrypted-token',
          },
        ],
      });

      jest.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
      } as Response);

      await service.disconnectAccount('org-1', 'account-1');

      expect(mockPrismaService.connectedAccount.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'account-1' },
          data: { status: ConnectedAccountStatus.DISCONNECTED },
        }),
      );
      expect(mockPrismaService.oAuthToken.deleteMany).toHaveBeenCalled();
    });

    it('should throw if account not found', async () => {
      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);

      await expect(service.disconnectAccount('org-1', 'account-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
