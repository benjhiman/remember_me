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
import { MetaConfigService } from './meta/meta-config.service';
import { MetaAdsService } from './meta/meta-ads.service';
import { MetaTokenService } from './meta/meta-token.service';
import { IntegrationsService } from './integrations.service';

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
    private readonly metaConfigService: MetaConfigService,
    private readonly metaAdsService: MetaAdsService,
    private readonly metaTokenService: MetaTokenService,
    private readonly integrationsService: IntegrationsService,
  ) {}

  @Get('status')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async getStatus(@CurrentOrganization() organizationId: string) {
    const lastChecked = new Date().toISOString();

    const [metaCfg, accounts] = await Promise.all([
      this.metaConfigService.getConfig(organizationId).catch(() => ({ adAccountId: null, connected: false })),
      this.prisma.connectedAccount.findMany({
        where: { organizationId },
        include: { oauthTokens: { orderBy: { createdAt: 'desc' }, take: 1 } },
      }),
    ]);

    const getAccount = (provider: IntegrationProvider) =>
      accounts.find((a) => a.provider === provider && a.status === 'CONNECTED') ||
      accounts.find((a) => a.provider === provider);

    const metaAccount =
      getAccount(IntegrationProvider.FACEBOOK) || getAccount(IntegrationProvider.INSTAGRAM);
    const igAccount = getAccount(IntegrationProvider.INSTAGRAM);
    const waAccount = getAccount(IntegrationProvider.WHATSAPP);

    const metaTokenExpiresAt = metaAccount?.oauthTokens?.[0]?.expiresAt || undefined;
    const igTokenExpiresAt = igAccount?.oauthTokens?.[0]?.expiresAt || undefined;

    const metaLastSync = await this.prisma.metaSpendDaily.findFirst({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    });

    const inboxLastSync = async (provider: IntegrationProvider) => {
      const conv = await this.prisma.conversation.findFirst({
        where: { organizationId, provider, deletedAt: null },
        orderBy: { lastMessageAt: 'desc' },
        select: { lastMessageAt: true },
      });
      return conv?.lastMessageAt?.toISOString() || null;
    };

    const [igLastMessageAt, waLastMessageAt] = await Promise.all([
      inboxLastSync(IntegrationProvider.INSTAGRAM),
      inboxLastSync(IntegrationProvider.WHATSAPP),
    ]);

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

    const [metaErrors, igErrors, waErrors] = await Promise.all([
      errorsForProvider(IntegrationProvider.INSTAGRAM), // Meta uses token via INSTAGRAM/FACEBOOK; jobs use INSTAGRAM in this repo
      errorsForProvider(IntegrationProvider.INSTAGRAM),
      errorsForProvider(IntegrationProvider.WHATSAPP),
    ]);

    const metaMetadata = (metaAccount?.metadataJson as any) || {};
    const igMetadata = (igAccount?.metadataJson as any) || {};
    const waMetadata = (waAccount?.metadataJson as any) || {};

    const metaGuardrails: Array<{ level: 'warning' | 'error'; message: string }> = [];
    if (metaCfg.connected && !metaCfg.adAccountId) {
      metaGuardrails.push({
        level: 'warning',
        message: 'Meta conectado pero falta adAccountId. Seleccioná una Ad Account en /ads.',
      });
    }

    const waCriticalMissing: string[] = [];
    const waPhoneNumberId = waMetadata.phoneNumberId || waMetadata.phone_number_id || null;
    const waWabaId = waMetadata.wabaId || waMetadata.waba_id || null;
    if (waAccount?.status === 'CONNECTED') {
      if (!waPhoneNumberId) waCriticalMissing.push('phoneNumberId');
      if (!waWabaId) waCriticalMissing.push('wabaId');
    }

    const igCriticalMissing: string[] = [];
    const igPageId = igMetadata.pageId || null;
    const igBusinessId = igMetadata.igUserId || igMetadata.igBusinessId || null;
    if (igAccount?.status === 'CONNECTED') {
      if (!igPageId) igCriticalMissing.push('pageId');
      if (!igBusinessId) igCriticalMissing.push('igBusinessId');
    }

    return {
      lastChecked,
      providers: {
        meta: {
          accountId: metaAccount?.id || null,
          connected: !!metaAccount && metaAccount.status === 'CONNECTED',
          lastSyncAt: metaLastSync?.updatedAt?.toISOString() || null,
          tokenStatus: computeTokenStatus(metaTokenExpiresAt),
          tokenExpiresAt: metaTokenExpiresAt?.toISOString() || null,
          errors: metaErrors,
          configSummary: {
            adAccountId: metaCfg.adAccountId,
          },
          guardrails: metaGuardrails,
        },
        instagram: {
          accountId: igAccount?.id || null,
          connected: !!igAccount && igAccount.status === 'CONNECTED',
          lastSyncAt: igLastMessageAt,
          tokenStatus: computeTokenStatus(igTokenExpiresAt),
          tokenExpiresAt: igTokenExpiresAt?.toISOString() || null,
          errors: igErrors,
          configSummary: {
            pageId: igPageId,
            igBusinessId,
          },
          guardrails: igCriticalMissing.length
            ? [{ level: 'warning', message: `Faltan datos críticos: ${igCriticalMissing.join(', ')}` }]
            : [],
        },
        whatsapp: {
          accountId: waAccount?.id || null,
          connected: !!waAccount && waAccount.status === 'CONNECTED',
          lastSyncAt: waLastMessageAt,
          tokenStatus: 'UNKNOWN' as TokenStatus,
          tokenExpiresAt: null,
          errors: waErrors,
          configSummary: {
            phoneNumberId: waPhoneNumberId,
            wabaId: waWabaId,
          },
          guardrails: waCriticalMissing.length
            ? [{ level: 'warning', message: `Faltan datos críticos: ${waCriticalMissing.join(', ')}` }]
            : [],
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

  @Post('meta/test')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async testMeta(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
  ) {
    const cfg = await this.metaConfigService.getConfig(organizationId);
    if (!cfg.connected) {
      throw new BadRequestException('Meta no conectado');
    }
    if (!cfg.adAccountId) {
      throw new BadRequestException('No hay Ad Account configurada. Setear en /api/integrations/meta/config');
    }

    let ok = false;
    let error: string | null = null;
    try {
      const accounts = await this.metaAdsService.listAdAccounts(organizationId);
      ok = Array.isArray(accounts);
    } catch (e) {
      ok = false;
      error = e instanceof Error ? e.message : 'Unknown error';
    }

    await this.auditLog.log({
      organizationId,
      actorUserId: user?.userId || null,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.Task,
      entityId: 'integration:meta',
      metadata: {
        provider: 'META',
        event: 'TEST_RUN',
        ok,
        error,
      },
    });

    return { ok, error };
  }

  @Post('instagram/test')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async testInstagram(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
  ) {
    let ok = false;
    let error: string | null = null;
    try {
      const token = await this.metaTokenService.ensureValidToken(organizationId);
      const url = `https://graph.facebook.com/v21.0/me?fields=id&access_token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      ok = res.ok;
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        error = `Meta Graph error: ${res.status} ${txt.substring(0, 200)}`;
      }
    } catch (e) {
      ok = false;
      error = e instanceof Error ? e.message : 'Unknown error';
    }

    await this.auditLog.log({
      organizationId,
      actorUserId: user?.userId || null,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.Task,
      entityId: 'integration:instagram',
      metadata: {
        provider: 'INSTAGRAM',
        event: 'TEST_RUN',
        ok,
        error,
      },
    });

    return { ok, error };
  }

  @Post('whatsapp/test')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async testWhatsApp(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
  ) {
    const toPhone = process.env.WHATSAPP_TEST_TO || '';
    const text = process.env.WHATSAPP_TEST_TEXT || 'Test message from Remember Me';

    let ok = false;
    let error: string | null = null;

    if (!toPhone) {
      ok = false;
      error = 'WHATSAPP_TEST_TO no configurado. Setear un número destino permitido para test.';
    } else {
      try {
        await this.integrationsService.sendWhatsAppMessage(organizationId, toPhone, text);
        ok = true;
      } catch (e) {
        ok = false;
        error = e instanceof Error ? e.message : 'Unknown error';
      }
    }

    await this.auditLog.log({
      organizationId,
      actorUserId: user?.userId || null,
      action: AuditAction.UPDATE,
      entityType: AuditEntityType.Task,
      entityId: 'integration:whatsapp',
      metadata: {
        provider: 'WHATSAPP',
        event: 'TEST_RUN',
        ok,
        error,
        payload: toPhone ? { toPhone } : null,
      },
    });

    return { ok, error };
  }
}

