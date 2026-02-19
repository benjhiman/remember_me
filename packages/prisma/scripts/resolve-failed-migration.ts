#!/usr/bin/env tsx
/**
 * Script to resolve failed Prisma migrations
 * 
 * This script marks a failed migration as rolled back in the _prisma_migrations table,
 * allowing new migrations to be applied.
 * 
 * Usage:
 *   tsx scripts/resolve-failed-migration.ts <migration_name>
 * 
 * Example:
 *   tsx scripts/resolve-failed-migration.ts 20260217000000_add_customer_assigned_seller_and_commissions
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function resolveFailedMigration(migrationName: string) {
  try {
    console.log(`Resolving failed migration: ${migrationName}`);

    // Check if migration exists in _prisma_migrations
    const migration = await prisma.$queryRaw<Array<{ migration_name: string; finished_at: any; rolled_back_at: any }>>`
      SELECT migration_name, finished_at, rolled_back_at
      FROM "_prisma_migrations"
      WHERE migration_name = ${migrationName}
    `;

    if (migration.length === 0) {
      console.log(`Migration ${migrationName} not found in _prisma_migrations table.`);
      console.log('This might mean it was never applied, or the migration name is incorrect.');
      return;
    }

    const migrationRecord = migration[0];

    if (migrationRecord.finished_at === null && migrationRecord.rolled_back_at === null) {
      // Migration is in failed state - mark it as rolled back
      console.log(`Marking migration ${migrationName} as rolled back...`);
      
      await prisma.$executeRaw`
        UPDATE "_prisma_migrations"
        SET rolled_back_at = NOW()
        WHERE migration_name = ${migrationName}
      `;

      console.log(`✅ Migration ${migrationName} marked as rolled back.`);
      console.log('You can now apply new migrations.');
    } else if (migrationRecord.rolled_back_at !== null) {
      console.log(`Migration ${migrationName} is already marked as rolled back.`);
    } else if (migrationRecord.finished_at !== null) {
      console.log(`Migration ${migrationName} is already applied (finished_at: ${migrationRecord.finished_at}).`);
    }
  } catch (error) {
    console.error('Error resolving migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Get migration name from command line args
const migrationName = process.argv[2];

if (!migrationName) {
  console.error('Usage: tsx scripts/resolve-failed-migration.ts <migration_name>');
  console.error('Example: tsx scripts/resolve-failed-migration.ts 20260217000000_add_customer_assigned_seller_and_commissions');
  process.exit(1);
}

resolveFailedMigration(migrationName)
  .then(() => {
    console.log('Done.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Failed to resolve migration:', error);
    process.exit(1);
  });
