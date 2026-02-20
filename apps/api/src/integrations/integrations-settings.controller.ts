import {
  Controller,
  Get,
  Post,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../common/audit/audit-log.service';
import { AuditAction, AuditEntityType, IntegrationProvider, Role } from '@remember-me/prisma';

type TokenStatus = 'OK' | 'EXPIRING_SOON' | 'EXPIRED' | 'UNKNOWN';

function computeTokenStatus(expiresAt?: Date | null): TokenStatus {
  if (!expiresAt) return 'UNKNOWN';
  const now = Date.now();
  const exp = expiresAt.getTime();
  if (exp <= now) return 'EXPIRED';
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  if (exp - now <= sevenDaysMs) return 'EXPIRING_SOON';
  return 'OK';
}

@Controller('integrations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class IntegrationsSettingsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
  ) {}

  @Get('status')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async getStatus(@CurrentOrganization() organizationId: string) {
    const lastChecked = new Date().toISOString();

    const accounts = await this.prisma.connectedAccount.findMany({
      where: { organizationId },
      include: { oauthTokens: { orderBy: { createdAt: 'desc' }, take: 1 } },
    });

    const getAccount = (provider: IntegrationProvider) =>
      accounts.find((a) => a.provider === provider && a.status === 'CONNECTED') ||
      accounts.find((a) => a.provider === provider);

    const metaAccount = getAccount(IntegrationProvider.FACEBOOK);

    const metaTokenExpiresAt = metaAccount?.oauthTokens?.[0]?.expiresAt || undefined;

    const errorsForProvider = async (provider: IntegrationProvider) => {
      const failed = await this.prisma.integrationJob.findMany({
        where: { organizationId, provider, status: 'FAILED' as any },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: { lastError: true, updatedAt: true },
      });
      return failed
        .filter((f) => !!f.lastError)
        .map((f) => ({
          message: f.lastError as string,
          at: f.updatedAt.toISOString(),
        }));
    };

    const metaErrors = await errorsForProvider(IntegrationProvider.FACEBOOK);

    const metaMetadata = (metaAccount?.metadataJson as any) || {};

    return {
      lastChecked,
      providers: {
        meta: {
          accountId: metaAccount?.id || null,
          connected: !!metaAccount && metaAccount.status === 'CONNECTED',
          tokenStatus: computeTokenStatus(metaTokenExpiresAt),
          tokenExpiresAt: metaTokenExpiresAt?.toISOString() || null,
          errors: metaErrors,
        },
      },
    };
  }

  @Get('audit')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async getAudit(
    @CurrentOrganization() organizationId: string,
    @Query('limit') limit: string = '20',
  ) {
    const take = Math.min(parseInt(limit, 10) || 20, 50);
    const logs = await this.prisma.auditLog.findMany({
      where: {
        organizationId,
        entityType: AuditEntityType.Task, // reuse existing entity type to avoid schema changes
        entityId: { startsWith: 'integration:' },
      },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return logs.map((l) => {
      const meta = (l.metadataJson as any) || {};
      return {
        id: l.id,
        createdAt: l.createdAt,
        actorUserId: l.actorUserId,
        provider: meta.provider || null,
        event: meta.event || null,
        ok: meta.ok ?? null,
        error: meta.error ?? null,
        payload: meta.payload ?? null,
      };
    });
  }

}

