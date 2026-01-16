import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class TokenCryptoService {
  private readonly logger = new Logger(TokenCryptoService.name);
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32; // 32 bytes = 256 bits
  private readonly ivLength = 16; // 16 bytes for GCM
  private readonly tagLength = 16; // 16 bytes for GCM auth tag
  private readonly saltLength = 32; // 32 bytes for salt

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get encryption key from env var
   * Format: base64 encoded 32-byte key
   */
  private getEncryptionKey(): Buffer {
    const keyBase64 = this.configService.get<string>('TOKEN_ENCRYPTION_KEY');
    if (!keyBase64) {
      throw new BadRequestException(
        'TOKEN_ENCRYPTION_KEY environment variable is required for token encryption',
      );
    }

    try {
      const key = Buffer.from(keyBase64, 'base64');
      if (key.length !== this.keyLength) {
        throw new BadRequestException(
          `TOKEN_ENCRYPTION_KEY must be ${this.keyLength} bytes (base64 encoded)`,
        );
      }
      return key;
    } catch (error) {
      throw new BadRequestException(
        `Invalid TOKEN_ENCRYPTION_KEY format: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    }
  }

  /**
   * Encrypt a plain text token
   * Returns: base64 encoded string containing IV + salt + tag + ciphertext
   */
  encrypt(plainText: string): string {
    if (!plainText) {
      throw new BadRequestException('Cannot encrypt empty token');
    }

    const key = this.getEncryptionKey();

    // Generate random IV and salt
    const iv = crypto.randomBytes(this.ivLength);
    const salt = crypto.randomBytes(this.saltLength);

    // Derive key from master key + salt (PBKDF2)
    const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, this.keyLength, 'sha256');

    // Create cipher
    const cipher = crypto.createCipheriv(this.algorithm, derivedKey, iv);

    // Encrypt
    let ciphertext = cipher.update(plainText, 'utf8');
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);

    // Get auth tag
    const tag = cipher.getAuthTag();

    // Combine: IV (16) + Salt (32) + Tag (16) + Ciphertext (variable)
    const combined = Buffer.concat([iv, salt, tag, ciphertext]);

    // Return base64 encoded
    return combined.toString('base64');
  }

  /**
   * Decrypt an encrypted token
   * Input: base64 encoded string containing IV + salt + tag + ciphertext
   */
  decrypt(encryptedText: string): string {
    if (!encryptedText) {
      throw new BadRequestException('Cannot decrypt empty token');
    }

    const key = this.getEncryptionKey();

    try {
      // Decode from base64
      const combined = Buffer.from(encryptedText, 'base64');

      // Minimum size check
      const minSize = this.ivLength + this.saltLength + this.tagLength;
      if (combined.length < minSize) {
        throw new BadRequestException('Invalid encrypted token format (too short)');
      }

      // Extract components
      let offset = 0;
      const iv = combined.slice(offset, offset + this.ivLength);
      offset += this.ivLength;

      const salt = combined.slice(offset, offset + this.saltLength);
      offset += this.saltLength;

      const tag = combined.slice(offset, offset + this.tagLength);
      offset += this.tagLength;

      const ciphertext = combined.slice(offset);

      // Derive key from master key + salt (same as encryption)
      const derivedKey = crypto.pbkdf2Sync(key, salt, 100000, this.keyLength, 'sha256');

      // Create decipher
      const decipher = crypto.createDecipheriv(this.algorithm, derivedKey, iv);
      decipher.setAuthTag(tag);

      // Decrypt
      let plaintext = decipher.update(ciphertext);
      plaintext = Buffer.concat([plaintext, decipher.final()]);

      return plaintext.toString('utf8');
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      // If decryption fails (wrong key, corrupted data, etc.)
      this.logger.error(`Token decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      throw new BadRequestException('Failed to decrypt token. Invalid key or corrupted data.');
    }
  }

  /**
   * Check if encryption is properly configured
   */
  isConfigured(): boolean {
    try {
      this.getEncryptionKey();
      return true;
    } catch {
      return false;
    }
  }
}
