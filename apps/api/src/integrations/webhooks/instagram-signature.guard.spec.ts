import { InstagramSignatureGuard } from './instagram-signature.guard';
import { ExecutionContext } from '@nestjs/common';
import * as crypto from 'crypto';

describe('InstagramSignatureGuard', () => {
  let guard: InstagramSignatureGuard;
  let mockRequest: any;

  beforeEach(() => {
    guard = new InstagramSignatureGuard();
    mockRequest = {
      method: 'POST',
      path: '/webhooks/instagram',
      headers: {},
      rawBody: null,
    };
  });

  afterEach(() => {
    delete process.env.META_APP_SECRET;
  });

  describe('when META_APP_SECRET is not set', () => {
    it('should allow request (dev mode)', () => {
      delete process.env.META_APP_SECRET;
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });
  });

  describe('when META_APP_SECRET is set', () => {
    beforeEach(() => {
      process.env.META_APP_SECRET = 'test_secret';
      // Recreate guard to pick up new env var
      guard = new InstagramSignatureGuard();
    });

    it('should reject request without signature header', () => {
      mockRequest.headers = {};
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow();
    });

    it('should reject request without raw body', () => {
      mockRequest.headers = { 'x-hub-signature-256': 'sha256=abc123' };
      mockRequest.rawBody = null;
      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow();
    });

    it('should accept request with valid signature', () => {
      const body = JSON.stringify({ test: 'data' });
      const signature = crypto.createHmac('sha256', 'test_secret').update(body).digest('hex');
      mockRequest.headers = { 'x-hub-signature-256': `sha256=${signature}` };
      mockRequest.rawBody = Buffer.from(body, 'utf8');

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      const result = guard.canActivate(context);
      expect(result).toBe(true);
    });

    it('should reject request with invalid signature', () => {
      const body = JSON.stringify({ test: 'data' });
      mockRequest.headers = { 'x-hub-signature-256': 'sha256=invalid_signature' };
      mockRequest.rawBody = Buffer.from(body, 'utf8');

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow();
    });

    it('should reject request with malformed signature', () => {
      const body = JSON.stringify({ test: 'data' });
      mockRequest.headers = { 'x-hub-signature-256': 'invalid_format' };
      mockRequest.rawBody = Buffer.from(body, 'utf8');

      const context = {
        switchToHttp: () => ({
          getRequest: () => mockRequest,
        }),
      } as ExecutionContext;

      expect(() => guard.canActivate(context)).toThrow();
    });
  });
});
