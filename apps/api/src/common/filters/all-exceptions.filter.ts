import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

interface ErrorResponse {
  statusCode: number;
  message: string | string[];
  error: string;
  requestId?: string;
  timestamp: string;
  path: string;
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const requestId = (request as any).requestId || 'unknown';

    let status: number;
    let message: string | string[];
    let error: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
        error = exception.constructor.name;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const responseObj = exceptionResponse as any;
        message = responseObj.message || exception.message;
        error = responseObj.error || exception.constructor.name;
      } else {
        message = exception.message;
        error = exception.constructor.name;
      }
    } else {
      // Handle non-HTTP exceptions (e.g., Prisma errors, database errors)
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      
      // Check for Prisma errors
      if (exception && typeof exception === 'object' && 'code' in exception) {
        const prismaError = exception as any;
        
        switch (prismaError.code) {
          case 'P2002':
            status = HttpStatus.CONFLICT;
            message = 'A record with this value already exists';
            error = 'UniqueConstraintViolation';
            break;
          case 'P2025':
            status = HttpStatus.NOT_FOUND;
            message = 'Record not found';
            error = 'RecordNotFound';
            break;
          case 'P2003':
            status = HttpStatus.BAD_REQUEST;
            message = 'Foreign key constraint violation';
            error = 'ForeignKeyViolation';
            break;
          default:
            message = 'An unexpected error occurred';
            error = 'InternalServerError';
        }
      } else {
        message = exception instanceof Error ? exception.message : 'Internal server error';
        error = 'InternalServerError';
      }
    }

    const errorResponse: ErrorResponse = {
      statusCode: status,
      message,
      error,
      requestId,
      timestamp: new Date().toISOString(),
      path: request.url,
    };

    // Log error (detailed in development, minimal in production)
    const isDevelopment = process.env.NODE_ENV !== 'production';
    if (isDevelopment) {
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${error}`,
        exception instanceof Error ? exception.stack : JSON.stringify(exception),
        requestId,
      );
    } else {
      // In production, log minimal info and don't expose stack traces
      this.logger.error(
        `${request.method} ${request.url} - ${status} - ${error}`,
        { requestId, userId: (request as any).user?.userId, organizationId: (request as any).organizationId },
      );
    }

    response.status(status).json(errorResponse);
  }
}
