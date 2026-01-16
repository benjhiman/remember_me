import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

@Injectable()
export class WhatsAppSignatureGuard implements CanActivate {
  private readonly appSecret = process.env.WHATSAPP_APP_SECRET;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-hub-signature-256'] as string;

    // If app secret is not configured, skip validation (dev mode)
    if (!this.appSecret) {
      return true;
    }

    // If signature header is missing, reject
    if (!signature) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Missing X-Hub-Signature-256 header',
        errorCode: 'WHATSAPP_SIGNATURE_INVALID',
      });
    }

    // Get raw body from request (should be set by middleware)
    const rawBody = (request as any).rawBody;
    if (!rawBody) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Raw body not available for signature verification',
        errorCode: 'WHATSAPP_SIGNATURE_INVALID',
      });
    }

    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', this.appSecret)
      .update(rawBody)
      .digest('hex');

    // WhatsApp sends signature as "sha256=<hex>"
    const receivedSignature = signature.replace('sha256=', '');

    // Validate signature length (SHA256 hex is 64 characters)
    if (receivedSignature.length !== 64) {
      throw new UnauthorizedException({
        statusCode: 403,
        message: 'Invalid webhook signature format',
        errorCode: 'WHATSAPP_SIGNATURE_INVALID',
      });
    }

    // Compare signatures using constant-time comparison
    // Both must be valid hex strings of same length (64 chars = 32 bytes)
    try {
      const expectedBuffer = Buffer.from(expectedSignature, 'hex');
      const receivedBuffer = Buffer.from(receivedSignature, 'hex');

      // timingSafeEqual requires buffers of same length
      if (expectedBuffer.length !== receivedBuffer.length) {
        throw new UnauthorizedException({
          statusCode: 403,
          message: 'Invalid webhook signature',
          errorCode: 'WHATSAPP_SIGNATURE_INVALID',
        });
      }

      const isValid = crypto.timingSafeEqual(expectedBuffer, receivedBuffer);

      if (!isValid) {
        throw new UnauthorizedException({
          statusCode: 403,
          message: 'Invalid webhook signature',
          errorCode: 'WHATSAPP_SIGNATURE_INVALID',
        });
      }
    } catch (error) {
      // If it's already an UnauthorizedException, re-throw it
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      // Otherwise, wrap other errors (e.g., invalid hex)
      throw new UnauthorizedException({
        statusCode: 403,
        message: 'Invalid webhook signature',
        errorCode: 'WHATSAPP_SIGNATURE_INVALID',
      });
    }

    return true;
  }
}
