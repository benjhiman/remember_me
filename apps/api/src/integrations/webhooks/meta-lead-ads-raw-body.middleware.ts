import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to capture raw body for Meta Lead Ads webhook signature verification
 * Must be applied before body parsing middleware
 */
@Injectable()
export class MetaLeadAdsRawBodyMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    if (req.method === 'POST' && req.path.includes('/webhooks/meta-lead-ads')) {
      let data = '';

      req.setEncoding('utf8');
      req.on('data', (chunk) => {
        data += chunk;
      });

      req.on('end', () => {
        (req as any).rawBody = Buffer.from(data, 'utf8');
        next();
      });
    } else {
      next();
    }
  }
}
