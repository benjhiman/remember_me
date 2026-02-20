import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ORG_SETTINGS_DEFAULTS, OrgSettings } from './org-settings.defaults';
import { Prisma } from '@remember-me/prisma';

function isObject(val: unknown): val is Record<string, any> {
  return !!val && typeof val === 'object' && !Array.isArray(val);
}

function deepMerge<T>(base: T, patch: any): T {
  if (!isObject(base)) return patch ?? base;
  const out: any = Array.isArray(base) ? [...(base as any)] : { ...(base as any) };
  if (!isObject(patch)) return out;
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (isObject((out as any)[k]) && isObject(v)) {
      (out as any)[k] = deepMerge((out as any)[k], v);
    } else {
      (out as any)[k] = v;
    }
  }
  return out;
}

@Injectable()
export class OrgSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(organizationId: string): Promise<OrgSettings> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true, name: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const current = (org.settings as any) || {};
    const rawCrm = current.crm || {};
    const mergedCrm = deepMerge(ORG_SETTINGS_DEFAULTS.crm, rawCrm);

    // Org-specific branding defaults (white-label)
    if (!mergedCrm.branding.name || mergedCrm.branding.name === 'CRM') {
      mergedCrm.branding.name = `${org.name} CRM`;
    }
    if (!mergedCrm.branding.accentColor) {
      mergedCrm.branding.accentColor = mergedCrm.ui?.accentColor || 'blue';
    }
    if (!mergedCrm.branding.density) {
      mergedCrm.branding.density = mergedCrm.ui?.density || 'comfortable';
    }
    return { crm: mergedCrm };
  }

  async updateSettings(
    organizationId: string,
    patch: Partial<OrgSettings>,
  ): Promise<OrgSettings> {
    const org = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { settings: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const current = (org.settings as any) || {};
    const currentCrm = current.crm || {};

    const patchCrm: any = patch.crm || {};

    const nextCrm = deepMerge(
      deepMerge(ORG_SETTINGS_DEFAULTS.crm, currentCrm),
      patchCrm,
    );

    // Keep ui.* aligned as fallback if branding provides these
    if (nextCrm?.branding?.density) nextCrm.ui = { ...(nextCrm.ui || {}), density: nextCrm.branding.density };
    if (nextCrm?.branding?.accentColor && ['blue', 'violet', 'green'].includes(nextCrm.branding.accentColor)) {
      nextCrm.ui = { ...(nextCrm.ui || {}), accentColor: nextCrm.branding.accentColor as any };
    }

    const nextSettings = {
      ...current,
      crm: nextCrm,
    };

    await this.prisma.organization.update({
      where: { id: organizationId },
      data: { settings: nextSettings as Prisma.InputJsonValue },
    });

    return { crm: nextCrm };
  }
}

