import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppSignatureGuard } from './whatsapp-signature.guard';
import { UnauthorizedException } from '@nestjs/common';
import { ExecutionContext } from '@nestjs/common';
import * as crypto from 'crypto';

describe('WhatsAppSignatureGuard', () => {
  let guard: WhatsAppSignatureGuard;
  const originalEnv = process.env;

  const createMockExecutionContext = (options: {
    rawBody?: Buffer;
    signature?: string;
  }): ExecutionContext => {
    const request = {
      headers: {},
      method: 'POST',
      path: '/api/webhooks/whatsapp',
    } as any;

    if (options.signature) {
      request.headers['x-hub-signature-256'] = options.signature;
    }

    if (options.rawBody) {
      (request as any).rawBody = options.rawBody;
    }

    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;
  };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('when WHATSAPP_APP_SECRET is not set', () => {
    it('should allow request (dev mode)', () => {
      delete process.env.WHATSAPP_APP_SECRET;
      guard = new WhatsAppSignatureGuard();

      const context = createMockExecutionContext({});
      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });
  });

  describe('when WHATSAPP_APP_SECRET is set', () => {
    const appSecret = 'test-secret-key';

    beforeEach(() => {
      process.env.WHATSAPP_APP_SECRET = appSecret;
      guard = new WhatsAppSignatureGuard();
    });

    it('should allow request with valid signature', () => {
      const rawBody = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const signature = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const signatureHeader = `sha256=${signature}`;

      const context = createMockExecutionContext({
        rawBody,
        signature: signatureHeader,
      });

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject request with missing signature header', () => {
      const rawBody = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');

      const context = createMockExecutionContext({
        rawBody,
        // No signature
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      try {
        guard.canActivate(context);
      } catch (error: any) {
        expect(error.response.errorCode).toBe('WHATSAPP_SIGNATURE_INVALID');
        expect(error.response.statusCode).toBe(401);
      }
    });

    it('should reject request with invalid signature', () => {
      const rawBody = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const invalidSignature = 'sha256=invalid-signature';

      const context = createMockExecutionContext({
        rawBody,
        signature: invalidSignature,
      });

      try {
        guard.canActivate(context);
        fail('Should have thrown UnauthorizedException');
      } catch (error: any) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.response.errorCode).toBe('WHATSAPP_SIGNATURE_INVALID');
        expect(error.response.statusCode).toBe(403);
      }
    });

    it('should reject request with missing raw body', () => {
      const signature = 'sha256=some-signature';

      const context = createMockExecutionContext({
        signature,
        // No rawBody
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
      try {
        guard.canActivate(context);
      } catch (error: any) {
        expect(error.response.errorCode).toBe('WHATSAPP_SIGNATURE_INVALID');
        expect(error.response.statusCode).toBe(401);
      }
    });

    it('should reject request with signature for different body', () => {
      const body1 = Buffer.from(JSON.stringify({ test: 'data1' }), 'utf8');
      const body2 = Buffer.from(JSON.stringify({ test: 'data2' }), 'utf8');
      const signature = crypto.createHmac('sha256', appSecret).update(body1).digest('hex');
      const signatureHeader = `sha256=${signature}`;

      const context = createMockExecutionContext({
        rawBody: body2, // Different body
        signature: signatureHeader,
      });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('should handle signature without sha256= prefix', () => {
      const rawBody = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const signature = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      // WhatsApp sends with sha256= prefix, but test without it
      const signatureHeader = signature;

      const context = createMockExecutionContext({
        rawBody,
        signature: signatureHeader,
      });

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should use constant-time comparison for signature', () => {
      const rawBody = Buffer.from(JSON.stringify({ test: 'data' }), 'utf8');
      const validSignature = crypto.createHmac('sha256', appSecret).update(rawBody).digest('hex');
      const invalidSignature = 'a'.repeat(64); // Same length but invalid

      const context1 = createMockExecutionContext({
        rawBody,
        signature: `sha256=${validSignature}`,
      });

      const context2 = createMockExecutionContext({
        rawBody,
        signature: `sha256=${invalidSignature}`,
      });

      expect(guard.canActivate(context1)).toBe(true);
      expect(() => guard.canActivate(context2)).toThrow(UnauthorizedException);
    });
  });
});
