import { Controller, Get, Post, Param, Body, Delete, UseGuards, Query } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationJobsService } from './jobs/integration-jobs.service';
import { IntegrationQueueService } from './jobs/queue/integration-queue.service';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { RateLimit } from '../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../common/rate-limit/rate-limit.guard';
import { Role, IntegrationProvider, IntegrationJobType } from '@remember-me/prisma';
import { IsOptional, IsString, IsNumberString } from 'class-validator';

class ConnectAccountDto {
  @IsString()
  externalAccountId!: string;

  @IsOptional()
  @IsString()
  displayName?: string;
}


@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly integrationJobsService: IntegrationJobsService,
    private readonly integrationQueueService: IntegrationQueueService,
  ) {}

  @Get()
  async listIntegrations(@CurrentOrganization() organizationId: string) {
    return this.integrationsService.listConnectedAccounts(organizationId);
  }

  @Post(':provider/connect')
  async connectProvider(
    @CurrentOrganization() organizationId: string,
    @Param('provider') provider: IntegrationProvider,
    @Body() dto: Omit<ConnectAccountDto, 'provider'>,
  ) {
    return this.integrationsService.connectAccount(
      organizationId,
      provider,
      dto.externalAccountId,
      dto.displayName,
    );
  }

  @Delete(':accountId/disconnect')
  async disconnectAccount(
    @CurrentOrganization() organizationId: string,
    @Param('accountId') accountId: string,
  ) {
    return this.integrationsService.disconnectAccount(organizationId, accountId);
  }


  @Get('jobs/metrics')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async getJobMetrics(@CurrentOrganization() organizationId: string) {
    return this.integrationJobsService.getMetrics(organizationId);
  }
}
