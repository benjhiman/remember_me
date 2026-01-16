import { Controller, Get, Headers, HttpCode, HttpStatus, UnauthorizedException, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from '../decorators/roles.decorator';
import { Role } from '@remember-me/prisma';
import { Public } from '../guards/public.decorator';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @Public() // Allow access with token or auth
  async getMetrics(@Headers('x-metrics-token') metricsTokenHeader?: string) {
    // Check if METRICS_TOKEN is configured
    const metricsToken = process.env.METRICS_TOKEN;
    
    if (metricsToken) {
      // Token-based authentication via X-Metrics-Token header
      if (!metricsTokenHeader || metricsTokenHeader !== metricsToken) {
        throw new UnauthorizedException('Invalid metrics token');
      }
    } else {
      // If no METRICS_TOKEN, require JWT auth (ADMIN/OWNER)
      // This endpoint should not be public without token
      throw new UnauthorizedException('Metrics endpoint requires authentication');
    }

    const metrics = await this.metricsService.getMetrics();
    return metrics;
  }

  @Get('authenticated')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.ADMIN, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  async getMetricsAuthenticated() {
    const metrics = await this.metricsService.getMetrics();
    return metrics;
  }
}
