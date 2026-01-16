import { Test, TestingModule } from '@nestjs/testing';
import { WhatsAppRawBodyMiddleware } from './whatsapp-raw-body.middleware';
import { Request, Response, NextFunction } from 'express';

describe('WhatsAppRawBodyMiddleware', () => {
  let middleware: WhatsAppRawBodyMiddleware;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhatsAppRawBodyMiddleware],
    }).compile();

    middleware = module.get<WhatsAppRawBodyMiddleware>(WhatsAppRawBodyMiddleware);
  });

  it('should store raw body for WhatsApp webhook POST requests', (done) => {
    const body = JSON.stringify({ test: 'data' });
    const req = {
      method: 'POST',
      path: '/api/webhooks/whatsapp',
      on: jest.fn((event: string, callback: Function) => {
        if (event === 'data') {
          callback(Buffer.from(body));
        } else if (event === 'end') {
          callback();
        }
      }),
    } as unknown as Request;

    const res = {} as Response;
    const next = jest.fn(() => {
      expect((req as any).rawBody).toBeDefined();
      expect((req as any).rawBody.toString()).toBe(body);
      done();
    }) as NextFunction;

    middleware.use(req, res, next);
  });

  it('should not process non-POST requests', (done) => {
    const req = {
      method: 'GET',
      path: '/api/webhooks/whatsapp',
      on: jest.fn(),
    } as unknown as Request;

    const res = {} as Response;
    const next = jest.fn(() => {
      expect((req as any).rawBody).toBeUndefined();
      expect(req.on).not.toHaveBeenCalled();
      done();
    }) as NextFunction;

    middleware.use(req, res, next);
  });

  it('should not process non-WhatsApp webhook paths', (done) => {
    const req = {
      method: 'POST',
      path: '/api/webhooks/instagram',
      on: jest.fn(),
    } as unknown as Request;

    const res = {} as Response;
    const next = jest.fn(() => {
      expect((req as any).rawBody).toBeUndefined();
      expect(req.on).not.toHaveBeenCalled();
      done();
    }) as NextFunction;

    middleware.use(req, res, next);
  });
});
