#!/usr/bin/env tsx
/**
 * Pre-migration cleanup script
 * 
 * This script cleans up failed migration states before Prisma tries to apply migrations.
 * It should be run before `prisma migrate deploy` in production.
 * 
 * Usage:
 *   tsx scripts/pre-migrate-cleanup.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanupFailedMigrations() {
  try {
    console.log('Checking for failed migrations...');

    // Find failed migrations (started_at is not null, finished_at is null, rolled_back_at is null)
    const failedMigrations = await prisma.$queryRaw<Array<{ migration_name: string; started_at: Date }>>`
      SELECT migration_name, started_at
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
        AND started_at IS NOT NULL
      ORDER BY started_at DESC
    `;

    if (failedMigrations.length === 0) {
      console.log('✅ No failed migrations found.');
      return;
    }

    console.log(`Found ${failedMigrations.length} failed migration(s):`);
    failedMigrations.forEach((m) => {
      console.log(`  - ${m.migration_name} (started at: ${m.started_at})`);
    });

    // Mark them as rolled back
    for (const migration of failedMigrations) {
      console.log(`Marking ${migration.migration_name} as rolled back...`);
      
      await prisma.$executeRaw`
        UPDATE "_prisma_migrations"
        SET rolled_back_at = NOW()
        WHERE migration_name = ${migration.migration_name}
          AND finished_at IS NULL
          AND rolled_back_at IS NULL
      `;

      console.log(`✅ ${migration.migration_name} marked as rolled back.`);
    }

    console.log('✅ All failed migrations have been cleaned up.');
    console.log('You can now run `prisma migrate deploy` safely.');
  } catch (error) {
    console.error('Error cleaning up failed migrations:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

cleanupFailedMigrations()
  .then(() => {
    console.log('Pre-migration cleanup completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Pre-migration cleanup failed:', error);
    process.exit(1);
  });
