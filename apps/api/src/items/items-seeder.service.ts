import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { APPLE_IPHONE_CATALOG } from './apple-iphone-catalog';
import { ItemCondition } from '@remember-me/prisma';
import {
  generateSku,
  generateSortKey,
  conditionLabel,
} from './item-utils';

@Injectable()
export class ItemsSeederService {
  private readonly logger = new Logger(ItemsSeederService.name);
  private readonly SEED_SOURCE = 'APPLE_IPHONE';
  private readonly SEED_VERSION = 3;

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed default Apple iPhone catalog for an organization (version 3)
   * Idempotent: only seeds if organization has no items
   */
  async seedDefaultItemsForOrg(organizationId: string): Promise<number> {
    // Check if organization already has items
    const existingCount = await this.prisma.item.count({
      where: {
        organizationId,
        deletedAt: null,
      },
    });

    if (existingCount > 0) {
      this.logger.debug(`Organization ${organizationId} already has ${existingCount} items, skipping seed`);
      return 0;
    }

    return this.reseedAppleCatalogForOrg(organizationId);
  }

  /**
   * Reseed Apple catalog for an organization (version 3)
   * Soft-deletes old seed items (v2 and earlier) and creates new ones
   */
  async reseedAppleCatalogForOrg(organizationId: string): Promise<number> {
    this.logger.log(`Reseeding Apple iPhone catalog v${this.SEED_VERSION} for organization ${organizationId}`);

    // Check if already at version 3
    const existingV3Count = await this.prisma.item.count({
      where: {
        organizationId,
        seedSource: this.SEED_SOURCE as any,
        seedVersion: this.SEED_VERSION,
        deletedAt: null,
      },
    });

    const expectedCount = APPLE_IPHONE_CATALOG.length;
    if (existingV3Count >= expectedCount * 0.9) {
      // Already seeded (90% threshold to account for potential deletions)
      this.logger.debug(`Organization ${organizationId} already has v${this.SEED_VERSION} items (${existingV3Count}), skipping reseed`);
      return 0;
    }

    // Soft-delete old seed items (seedSource="APPLE_IPHONE" with seedVersion < 3, or legacy detection)
    const legacyItems = await this.prisma.item.findMany({
      where: {
        organizationId,
        deletedAt: null,
        OR: [
          // Items with seedSource but version < 3
          {
            AND: [
              { seedSource: this.SEED_SOURCE as any },
              {
                OR: [
                  { seedVersion: { lt: this.SEED_VERSION } },
                  { seedVersion: null },
                ],
              },
            ],
          },
          // Legacy detection: brand="Apple" or "APPLE" and name starts with "Apple iPhone" or "APPLE iPhone"
          {
            AND: [
              { brand: { in: ['Apple', 'APPLE'] } },
              { name: { startsWith: 'Apple iPhone' } },
              { seedSource: null }, // Only if not already marked as seed
            ],
          },
          {
            AND: [
              { brand: { in: ['Apple', 'APPLE'] } },
              { name: { startsWith: 'APPLE iPhone' } },
              { seedSource: null }, // Only if not already marked as seed
            ],
          },
          // Or SKU starts with "IPH" and seedSource is null (legacy seed)
          {
            AND: [
              { sku: { startsWith: 'IPH' } },
              { seedSource: null },
            ],
          },
        ],
      },
      select: { id: true },
    });

    if (legacyItems.length > 0) {
      await this.prisma.item.updateMany({
        where: {
          id: { in: legacyItems.map((i) => i.id) },
        },
        data: {
          deletedAt: new Date(),
        },
      });
      this.logger.debug(`Soft-deleted ${legacyItems.length} legacy seed items`);
    }

    // Map catalog items to Prisma create data with SKU and sortKey
    const itemsToCreate = APPLE_IPHONE_CATALOG.map((item) => {
      const condition = item.condition as ItemCondition;
      const conditionDisplayLabel = conditionLabel(condition);
      const brand = 'APPLE'; // Always uppercase
      const name = `${brand} ${item.model} ${item.storageGb}GB ${item.color} (${conditionDisplayLabel})`;
      const sku = generateSku(item.model, item.storageGb, condition, item.color);
      const sortKey = generateSortKey(item.model, item.storageGb, condition, item.color);

      return {
        organizationId,
        name,
        sku,
        brand,
        model: item.model,
        storageGb: item.storageGb,
        condition,
        color: item.color,
        isActive: true,
        seedSource: this.SEED_SOURCE,
        seedVersion: this.SEED_VERSION,
        sortKey,
      };
    });

    // Create items in batches to avoid overwhelming the database
    const batchSize = 100;
    let created = 0;

    for (let i = 0; i < itemsToCreate.length; i += batchSize) {
      const batch = itemsToCreate.slice(i, i + batchSize);
      await this.prisma.item.createMany({
        data: batch,
        skipDuplicates: true, // Idempotent: skip if duplicate exists
      });
      created += batch.length;
      this.logger.debug(`Created batch ${Math.floor(i / batchSize) + 1}, ${created}/${itemsToCreate.length} items`);
    }

    this.logger.log(`Successfully reseeded ${created} Apple iPhone items (v${this.SEED_VERSION}) for organization ${organizationId}`);
    return created;
  }

  /**
   * Backfill default items for all existing organizations that don't have items
   */
  async backfillExistingOrganizations(): Promise<{ total: number; seeded: number }> {
    this.logger.log('Starting backfill of default items for existing organizations');

    const organizations = await this.prisma.organization.findMany({
      select: { id: true },
    });

    let totalSeeded = 0;

    for (const org of organizations) {
      try {
        const count = await this.seedDefaultItemsForOrg(org.id);
        totalSeeded += count;
      } catch (error) {
        this.logger.error(`Failed to seed items for organization ${org.id}: ${error.message}`, error.stack);
      }
    }

    this.logger.log(`Backfill completed: seeded ${totalSeeded} items across ${organizations.length} organizations`);
    return { total: organizations.length, seeded: totalSeeded };
  }

  /**
   * Reseed Apple catalog for all organizations (version 2)
   * Idempotent: checks seedVersion before reseeding
   */
  async reseedAllOrganizations(): Promise<{ total: number; reseeded: number }> {
    this.logger.log(`Starting reseed of Apple iPhone catalog v${this.SEED_VERSION} for all organizations`);

    const organizations = await this.prisma.organization.findMany({
      select: { id: true },
    });

    let totalReseeded = 0;

    for (const org of organizations) {
      try {
        // Check if already at version 2
        const existingV2Count = await this.prisma.item.count({
          where: {
            organizationId: org.id,
            seedSource: this.SEED_SOURCE as any,
            seedVersion: this.SEED_VERSION,
            deletedAt: null,
          },
        });

        // Expected count: all catalog items
        const expectedCount = APPLE_IPHONE_CATALOG.length;

        if (existingV2Count >= expectedCount * 0.9) {
          // Already seeded (90% threshold to account for potential deletions)
          this.logger.debug(`Organization ${org.id} already has v${this.SEED_VERSION} items (${existingV2Count}), skipping`);
          continue;
        }

        const count = await this.reseedAppleCatalogForOrg(org.id);
        totalReseeded += count;
      } catch (error) {
        this.logger.error(`Failed to reseed items for organization ${org.id}: ${error.message}`, error.stack);
      }
    }

    this.logger.log(`Reseed completed: ${totalReseeded} items reseeded across ${organizations.length} organizations`);
    return { total: organizations.length, reseeded: totalReseeded };
  }
}
