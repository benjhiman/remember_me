import { Controller, Get, Put, Body, UseGuards, BadRequestException } from '@nestjs/common';
import { MetaConfigService } from './meta-config.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuditLogService } from '../../common/audit/audit-log.service';
import { AuditAction, AuditEntityType } from '@remember-me/prisma';

interface UpdateMetaConfigDto {
  adAccountId: string;
}

@Controller('integrations/meta')
@UseGuards(JwtAuthGuard)
export class MetaConfigController {
  constructor(
    private readonly metaConfigService: MetaConfigService,
    private readonly auditLog: AuditLogService,
  ) {}

  /**
   * Get Meta configuration for organization
   * GET /api/integrations/meta/config
   * 
   * Returns:
   * {
   *   "adAccountId": "act_123456789" | null,
   *   "connected": true | false
   * }
   */
  @Get('config')
  async getConfig(@CurrentOrganization() organizationId: string) {
    return this.metaConfigService.getConfig(organizationId);
  }

  /**
   * Update Meta configuration for organization
   * PUT /api/integrations/meta/config
   * 
   * Body:
   * {
   *   "adAccountId": "act_123456789" | "123456789"
   * }
   * 
   * Returns:
   * {
   *   "adAccountId": "act_123456789"
   * }
   */
  @Put('config')
  async updateConfig(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() body: UpdateMetaConfigDto,
  ) {
    if (!body.adAccountId) {
      throw new BadRequestException('adAccountId is required');
    }

    const result = await this.metaConfigService.updateConfig(
      organizationId,
      body.adAccountId,
    );

    await this.auditLog.log({
      organizationId,
      actorUserId: user?.userId || null,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.Task,
      entityId: 'integration:meta',
      metadata: {
        provider: 'META',
        event: 'CONFIG_UPDATED',
        payload: { adAccountId: result.adAccountId },
      },
    });

    return result;
  }
}
