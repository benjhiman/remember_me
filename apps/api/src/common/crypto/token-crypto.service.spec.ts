import { Test, TestingModule } from '@nestjs/testing';
import { TokenCryptoService } from './token-crypto.service';
import { ConfigService } from '@nestjs/config';
import { BadRequestException } from '@nestjs/common';

describe('TokenCryptoService', () => {
  let service: TokenCryptoService;
  let configService: ConfigService;

  // Generate a valid 32-byte key (base64 encoded)
  const validKey = Buffer.from('a'.repeat(32)).toString('base64');

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TokenCryptoService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TokenCryptoService>(TokenCryptoService);
    configService = module.get<ConfigService>(ConfigService);

    jest.clearAllMocks();
  });

  describe('encrypt', () => {
    it('should encrypt a token successfully', () => {
      mockConfigService.get.mockReturnValue(validKey);

      const plainText = 'test-token-123';
      const encrypted = service.encrypt(plainText);

      expect(encrypted).toBeDefined();
      expect(encrypted).not.toBe(plainText);
      expect(encrypted.length).toBeGreaterThan(0);
    });

    it('should throw if encryption key is missing', () => {
      mockConfigService.get.mockReturnValue(null);

      expect(() => service.encrypt('test-token')).toThrow(BadRequestException);
    });

    it('should throw if encryption key is invalid length', () => {
      mockConfigService.get.mockReturnValue('invalid-key');

      expect(() => service.encrypt('test-token')).toThrow(BadRequestException);
    });

    it('should throw if plain text is empty', () => {
      mockConfigService.get.mockReturnValue(validKey);

      expect(() => service.encrypt('')).toThrow(BadRequestException);
    });

    it('should produce different ciphertext for same plaintext (IV is random)', () => {
      mockConfigService.get.mockReturnValue(validKey);

      const plainText = 'test-token';
      const encrypted1 = service.encrypt(plainText);
      const encrypted2 = service.encrypt(plainText);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
    });
  });

  describe('decrypt', () => {
    beforeEach(() => {
      mockConfigService.get.mockReturnValue(validKey);
    });

    it('should decrypt an encrypted token successfully', () => {
      const plainText = 'test-token-123';
      const encrypted = service.encrypt(plainText);
      const decrypted = service.decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should throw if encrypted text is empty', () => {
      expect(() => service.decrypt('')).toThrow(BadRequestException);
    });

    it('should throw if encrypted text is too short', () => {
      expect(() => service.decrypt('short')).toThrow(BadRequestException);
    });

    it('should throw if encryption key is wrong', () => {
      const plainText = 'test-token';
      const encrypted = service.encrypt(plainText);

      // Change key
      mockConfigService.get.mockReturnValue(Buffer.from('b'.repeat(32)).toString('base64'));

      expect(() => service.decrypt(encrypted)).toThrow(BadRequestException);
    });

    it('should throw if encrypted text is corrupted', () => {
      const plainText = 'test-token';
      const encrypted = service.encrypt(plainText);
      const corrupted = encrypted.slice(0, -10) + 'corrupted';

      expect(() => service.decrypt(corrupted)).toThrow(BadRequestException);
    });

    it('should decrypt multiple tokens correctly', () => {
      const tokens = ['token-1', 'token-2', 'token-3'];
      const encrypted = tokens.map((t) => service.encrypt(t));
      const decrypted = encrypted.map((e) => service.decrypt(e));

      expect(decrypted).toEqual(tokens);
    });
  });

  describe('isConfigured', () => {
    it('should return true if encryption key is configured', () => {
      mockConfigService.get.mockReturnValue(validKey);

      expect(service.isConfigured()).toBe(true);
    });

    it('should return false if encryption key is missing', () => {
      mockConfigService.get.mockReturnValue(null);

      expect(service.isConfigured()).toBe(false);
    });

    it('should return false if encryption key is invalid', () => {
      mockConfigService.get.mockImplementation(() => {
        throw new BadRequestException('Invalid key');
      });

      expect(service.isConfigured()).toBe(false);
    });
  });
});
