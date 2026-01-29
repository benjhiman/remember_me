import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { APPLE_IPHONE_CATALOG } from './apple-iphone-catalog';
import { ItemCondition } from '@remember-me/prisma';

@Injectable()
export class ItemsSeederService {
  private readonly logger = new Logger(ItemsSeederService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Seed default Apple iPhone catalog for an organization
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

    this.logger.log(`Seeding default Apple iPhone catalog for organization ${organizationId}`);

    // Map catalog items to Prisma create data
    const itemsToCreate = APPLE_IPHONE_CATALOG.map((item) => {
      const conditionLabel = item.condition === 'NEW' ? 'new' : item.condition === 'USED' ? 'usado' : 'oem';
      const name = `${item.brand} ${item.model} ${item.storageGb}GB ${item.color} (${conditionLabel})`;

      return {
        organizationId,
        name,
        brand: item.brand,
        model: item.model,
        storageGb: item.storageGb,
        condition: item.condition as ItemCondition,
        color: item.color,
        isActive: true,
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

    this.logger.log(`Successfully seeded ${created} default items for organization ${organizationId}`);
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
}
