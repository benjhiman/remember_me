import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class WhatsAppRawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // Only process POST requests to WhatsApp webhook
    if (req.method === 'POST' && req.path.includes('/webhooks/whatsapp')) {
      let data = '';

      req.on('data', (chunk) => {
        data += chunk;
      });

      req.on('end', () => {
        // Store raw body for signature verification
        (req as any).rawBody = Buffer.from(data, 'utf8');
        next();
      });
    } else {
      next();
    }
  }
}
