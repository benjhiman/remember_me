import { Controller, Get, Post, Param, Body, Delete, UseGuards, Query } from '@nestjs/common';
import { IntegrationsService } from './integrations.service';
import { IntegrationJobsService } from './jobs/integration-jobs.service';
import { IntegrationQueueService } from './jobs/queue/integration-queue.service';
import { MetaSpendJobProcessorService } from './jobs/meta-spend-job-processor.service';
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

class SendWhatsAppMessageDto {
  @IsString()
  toPhone!: string;

  @IsString()
  text!: string;

  @IsOptional()
  @IsString()
  leadId?: string;
}

@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
export class IntegrationsController {
  constructor(
    private readonly integrationsService: IntegrationsService,
    private readonly integrationJobsService: IntegrationJobsService,
    private readonly integrationQueueService: IntegrationQueueService,
    private readonly metaSpendJobProcessor: MetaSpendJobProcessorService,
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

  @Post('whatsapp/send')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async sendWhatsAppMessage(
    @CurrentOrganization() organizationId: string,
    @Body() dto: SendWhatsAppMessageDto,
  ) {
    return this.integrationsService.sendWhatsAppMessage(
      organizationId,
      dto.toPhone,
      dto.text,
      dto.leadId,
    );
  }

  @Get('messages')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async listMessages(
    @CurrentOrganization() organizationId: string,
    @Query('leadId') leadId?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.integrationsService.listMessages(
      organizationId,
      leadId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Post('meta/spend/fetch-now')
  @Roles(Role.ADMIN, Role.OWNER) // Dev/admin only
  @UseGuards(RateLimitGuard)
  @RateLimit({ action: 'integrations.meta_spend_fetch', limit: 5, windowSec: 60, skipIfDisabled: true })
  async forceFetchMetaSpend(
    @CurrentOrganization() organizationId: string,
    @Query('date') date?: string, // YYYY-MM-DD, defaults to yesterday
  ) {
    const targetDate = date ? new Date(date) : new Date();
    if (!date) {
      targetDate.setDate(targetDate.getDate() - 1); // Yesterday
    }
    const dateStr = targetDate.toISOString().split('T')[0];

    // Enqueue job
    const job = await this.integrationQueueService.enqueue({
      jobType: IntegrationJobType.FETCH_META_SPEND,
      provider: IntegrationProvider.INSTAGRAM,
      payload: {
        organizationId,
        date: dateStr,
        level: 'CAMPAIGN',
      },
      runAt: new Date(), // Run immediately
      organizationId,
    });

    // Process immediately
    await this.metaSpendJobProcessor.processPendingJobs(1);

    return {
      message: 'Meta spend fetch job enqueued and processed',
      jobId: job.id,
      date: dateStr,
    };
  }

  @Get('jobs/metrics')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async getJobMetrics(@CurrentOrganization() organizationId: string) {
    return this.integrationJobsService.getMetrics(organizationId);
  }
}
