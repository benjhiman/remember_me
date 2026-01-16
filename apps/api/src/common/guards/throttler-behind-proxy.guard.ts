import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';

@Injectable()
export class ThrottlerBehindProxyGuard extends ThrottlerGuard {
  protected getTracker(req: Record<string, any>): Promise<string> {
    // For authenticated routes, use userId if available
    if (req.user?.userId) {
      return Promise.resolve(`user:${req.user.userId}`);
    }
    // For unauthenticated routes, use IP (works behind proxy via X-Forwarded-For)
    const forwarded = req.headers['x-forwarded-for'] as string;
    const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || req.socket.remoteAddress;
    return Promise.resolve(`ip:${ip}`);
  }
}
