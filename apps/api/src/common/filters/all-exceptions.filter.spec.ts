import { HttpException, HttpStatus } from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const buildHost = (req: any, res: any) =>
    ({
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    }) as any;

  const buildResponse = () => ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  });

  it('should include requestId in error logs (dev includes stack)', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'test';

    const filter = new AllExceptionsFilter();
    const errorSpy = jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined as any);

    const request = { method: 'GET', url: '/api/test', requestId: 'req-123' };
    const response = buildResponse();

    filter.catch(new Error('boom'), buildHost(request, response));

    expect(errorSpy).toHaveBeenCalled();
    const [message, stackOrMeta, requestId] = errorSpy.mock.calls[0];
    expect(String(message)).toContain('GET /api/test');
    expect(typeof stackOrMeta).toBe('string'); // stack in dev/test
    expect(requestId).toBe('req-123'); // requestId always present

    errorSpy.mockRestore();
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  });

  it('should log safely in production (no stack) and include requestId', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const filter = new AllExceptionsFilter();
    const errorSpy = jest.spyOn((filter as any).logger, 'error').mockImplementation(() => undefined as any);

    const request = {
      method: 'POST',
      url: '/api/test',
      requestId: 'req-prod-1',
      user: { userId: 'user-1' },
      organizationId: 'org-1',
    };
    const response = buildResponse();

    filter.catch(new Error('boom'), buildHost(request, response));

    expect(errorSpy).toHaveBeenCalled();
    const [message, meta] = errorSpy.mock.calls[0];
    expect(String(message)).toContain('POST /api/test');
    expect(typeof meta).toBe('object');
    expect(meta).toEqual(expect.objectContaining({ requestId: 'req-prod-1' }));
    // no stack string in prod branch
    expect(meta).not.toEqual(expect.objectContaining({ trace: expect.any(String) }));

    errorSpy.mockRestore();
    if (originalEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalEnv;
  });

  it('should handle HttpException correctly', () => {
    const filter = new AllExceptionsFilter();
    const request = { url: '/api/test', method: 'GET', requestId: 'test-request-id' };
    const response = buildResponse();
    const exception = new HttpException('Test error', HttpStatus.BAD_REQUEST);

    filter.catch(exception, buildHost(request, response));

    expect(response.status).toHaveBeenCalledWith(400);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 400,
        message: 'Test error',
        error: 'HttpException',
        requestId: 'test-request-id',
        timestamp: expect.any(String),
        path: '/api/test',
      }),
    );
  });

  it('should handle Prisma unique constraint violation (P2002)', () => {
    const filter = new AllExceptionsFilter();
    const request = { url: '/api/test', method: 'GET', requestId: 'test-request-id' };
    const response = buildResponse();
    const exception = { code: 'P2002', message: 'Unique constraint failed' };

    filter.catch(exception, buildHost(request, response));

    expect(response.status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 409,
        message: 'A record with this value already exists',
        error: 'UniqueConstraintViolation',
        requestId: 'test-request-id',
      }),
    );
  });

  it('should include timestamp in response', () => {
    const filter = new AllExceptionsFilter();
    const request = { url: '/api/test', method: 'GET', requestId: 'test-request-id' };
    const response = buildResponse();
    const exception = new HttpException('Test', HttpStatus.BAD_REQUEST);

    filter.catch(exception, buildHost(request, response));

    const callArgs = (response.json as jest.Mock).mock.calls[0][0];
    expect(callArgs.timestamp).toBeDefined();
    expect(new Date(callArgs.timestamp).toISOString()).toBe(callArgs.timestamp);
  });
});
