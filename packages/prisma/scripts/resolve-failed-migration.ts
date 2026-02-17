#!/usr/bin/env ts-node
/**
 * Script to resolve failed Prisma migrations in production
 * 
 * Usage:
 *   ts-node packages/prisma/scripts/resolve-failed-migration.ts <migration-name> <status>
 * 
 * Status options:
 *   - rolled-back: Mark migration as rolled back (if it failed and was rolled back)
 *   - applied: Mark migration as applied (if it actually succeeded but was marked as failed)
 * 
 * Example:
 *   ts-node packages/prisma/scripts/resolve-failed-migration.ts 20250131000002_add_price_lists rolled-back
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const migrationName = process.argv[2];
  const status = process.argv[3] as 'rolled-back' | 'applied';

  if (!migrationName) {
    console.error('Error: Migration name is required');
    console.error('Usage: ts-node resolve-failed-migration.ts <migration-name> <rolled-back|applied>');
    process.exit(1);
  }

  if (!status || !['rolled-back', 'applied'].includes(status)) {
    console.error('Error: Status must be either "rolled-back" or "applied"');
    console.error('Usage: ts-node resolve-failed-migration.ts <migration-name> <rolled-back|applied>');
    process.exit(1);
  }

  try {
    console.log(`Resolving migration ${migrationName} as ${status}...`);

    // Use Prisma's migrate resolve command via raw SQL
    // This updates the _prisma_migrations table
    if (status === 'rolled-back') {
      await prisma.$executeRawUnsafe(`
        UPDATE "_prisma_migrations"
        SET "finished_at" = NULL,
            "rolled_back_at" = NOW()
        WHERE "migration_name" = $1
      `, migrationName);
      console.log(`✓ Migration ${migrationName} marked as rolled-back`);
    } else {
      await prisma.$executeRawUnsafe(`
        UPDATE "_prisma_migrations"
        SET "finished_at" = NOW(),
            "rolled_back_at" = NULL
        WHERE "migration_name" = $1
      `, migrationName);
      console.log(`✓ Migration ${migrationName} marked as applied`);
    }

    console.log('Migration status resolved successfully!');
  } catch (error: any) {
    console.error('Error resolving migration:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
