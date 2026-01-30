/**
 * Script to resolve failed migration: 20250130000000_add_folder_prefix
 * 
 * This script:
 * 1. Inspects the migration status
 * 2. Checks if expected objects exist
 * 3. Resolves the migration as rolled-back or applied accordingly
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/resolve-folder-prefix-migration.ts
 */

import { PrismaClient } from '@prisma/client';

const MIGRATION_NAME = '20250130000000_add_folder_prefix';
const prisma = new PrismaClient();

interface MigrationRecord {
  migration_name: string;
  started_at: Date | null;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
  logs: string | null;
}

async function getMigrationRecord(): Promise<MigrationRecord | null> {
  try {
    const result = await prisma.$queryRaw<Array<MigrationRecord>>`
      SELECT 
        migration_name, 
        started_at, 
        finished_at, 
        rolled_back_at, 
        applied_steps_count, 
        logs
      FROM "_prisma_migrations"
      WHERE migration_name = ${MIGRATION_NAME}
      LIMIT 1
    `;

    return result.length > 0 ? result[0] : null;
  } catch (error) {
    console.error('❌ Error querying migration record:', error);
    throw error;
  }
}

async function checkExpectedObjects(): Promise<{
  tableExists: boolean;
  uniqueIndexExists: boolean;
  regularIndexExists: boolean;
  foreignKeyExists: boolean;
  allExist: boolean;
}> {
  try {
    // Check table
    const tableCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'FolderPrefix'
      ) as exists
    `;
    const tableExists = tableCheck[0]?.exists || false;

    if (!tableExists) {
      return {
        tableExists: false,
        uniqueIndexExists: false,
        regularIndexExists: false,
        foreignKeyExists: false,
        allExist: false,
      };
    }

    // Check unique index
    const uniqueIndexCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'FolderPrefix'
        AND indexname = 'FolderPrefix_organizationId_prefix_key'
      ) as exists
    `;
    const uniqueIndexExists = uniqueIndexCheck[0]?.exists || false;

    // Check regular index
    const regularIndexCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'FolderPrefix'
        AND indexname = 'FolderPrefix_organizationId_idx'
      ) as exists
    `;
    const regularIndexExists = regularIndexCheck[0]?.exists || false;

    // Check foreign key
    const fkCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public'
        AND tc.table_name = 'FolderPrefix'
        AND tc.constraint_type = 'FOREIGN KEY'
        AND tc.constraint_name = 'FolderPrefix_organizationId_fkey'
      ) as exists
    `;
    const foreignKeyExists = fkCheck[0]?.exists || false;

    const allExist = tableExists && uniqueIndexExists && regularIndexExists && foreignKeyExists;

    return {
      tableExists,
      uniqueIndexExists,
      regularIndexExists,
      foreignKeyExists,
      allExist,
    };
  } catch (error) {
    console.error('❌ Error checking expected objects:', error);
    throw error;
  }
}

async function resolveMigration(action: 'rolled-back' | 'applied'): Promise<boolean> {
  const { execSync } = require('child_process');
  const path = require('path');

  try {
    const monorepoRoot = path.resolve(__dirname, '../..');
    
    console.log(`📝 Resolving migration as ${action}...`);
    execSync(
      `pnpm --filter @remember-me/prisma exec prisma migrate resolve --${action} ${MIGRATION_NAME}`,
      {
        stdio: 'inherit',
        cwd: monorepoRoot,
        env: { ...process.env },
      }
    );
    console.log(`✅ Migration resolved as ${action}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to resolve migration as ${action}:`, error);
    return false;
  }
}

async function main() {
  console.log('🔍 Resolving FolderPrefix Migration');
  console.log('=====================================\n');

  try {
    // Step 1: Get migration record
    console.log(`📋 Checking migration record: ${MIGRATION_NAME}`);
    const migration = await getMigrationRecord();

    if (!migration) {
      console.log('✅ No migration record found - migration not started yet');
      console.log('   → Ready for migrate deploy\n');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('   Migration status:');
    console.log(`   - started_at: ${migration.started_at || 'NULL'}`);
    console.log(`   - finished_at: ${migration.finished_at || 'NULL'}`);
    console.log(`   - rolled_back_at: ${migration.rolled_back_at || 'NULL'}`);
    console.log(`   - applied_steps_count: ${migration.applied_steps_count}`);
    if (migration.logs) {
      const logsPreview = migration.logs.length > 200 
        ? migration.logs.substring(migration.logs.length - 200)
        : migration.logs;
      console.log(`   - logs (last 200 chars): ${logsPreview}`);
    }

    // Check if already resolved
    if (migration.finished_at !== null || migration.rolled_back_at !== null) {
      console.log('\n✅ Migration already resolved');
      console.log('   → Ready for migrate deploy\n');
      await prisma.$disconnect();
      process.exit(0);
    }

    // Check if in failed state
    const isFailed = migration.started_at !== null && migration.finished_at === null && migration.rolled_back_at === null;
    if (!isFailed) {
      console.log('\n⚠️  Migration not in failed state');
      console.log('   → Ready for migrate deploy\n');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('\n⚠️  Migration is in FAILED state');

    // Step 2: Check expected objects
    console.log('\n🔍 Checking expected objects in database...');
    const objects = await checkExpectedObjects();

    console.log('   Expected objects:');
    console.log(`   - FolderPrefix table: ${objects.tableExists ? '✅ exists' : '❌ missing'}`);
    console.log(`   - Unique index (organizationId_prefix_key): ${objects.uniqueIndexExists ? '✅ exists' : '❌ missing'}`);
    console.log(`   - Regular index (organizationId_idx): ${objects.regularIndexExists ? '✅ exists' : '❌ missing'}`);
    console.log(`   - Foreign key (organizationId_fkey): ${objects.foreignKeyExists ? '✅ exists' : '❌ missing'}`);

    // Step 3: Determine resolution strategy
    console.log('\n🎯 Resolution strategy:');

    if (objects.allExist) {
      console.log('   → All objects exist - marking as APPLIED');
      const resolved = await resolveMigration('applied');
      if (!resolved) {
        console.error('❌ Failed to resolve as applied');
        await prisma.$disconnect();
        process.exit(1);
      }
    } else {
      console.log('   → Objects missing or partial - marking as ROLLED-BACK');
      const resolved = await resolveMigration('rolled-back');
      if (!resolved) {
        console.error('❌ Failed to resolve as rolled-back');
        await prisma.$disconnect();
        process.exit(1);
      }
    }

    // Verify resolution
    const afterMigration = await getMigrationRecord();
    if (afterMigration && (afterMigration.finished_at !== null || afterMigration.rolled_back_at !== null)) {
      console.log('\n✅ Migration successfully resolved');
      console.log('   → Ready for migrate deploy\n');
    } else {
      console.error('\n❌ Migration still appears as failed after resolve');
      await prisma.$disconnect();
      process.exit(1);
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error resolving migration:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
