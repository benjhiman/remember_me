/**
 * Prisma Migration Recovery Script
 * 
 * Automatically recovers from failed Prisma migrations (P3009).
 * Detects partial application and resolves the migration state.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/prisma-recover.ts
 */

import { PrismaClient } from '@prisma/client';
import { execSync } from 'child_process';
import * as path from 'path';

const TARGET_MIGRATION = '20250124120000_add_accounting_lite_models';

interface MigrationStatus {
  exists: boolean;
  failed: boolean;
  applied: boolean;
  rolledBack: boolean;
  logs?: string | null;
}

interface DatabaseState {
  hasLedgerAccount: boolean;
  hasLedgerCategory: boolean;
  hasCustomerBalanceSnapshot: boolean;
  hasCurrencyColumn: boolean;
  hasReferenceNumberColumn: boolean;
  hasLedgerAccountEnum: boolean;
  hasLedgerCategoryEnum: boolean;
}

async function checkMigrationStatus(prisma: PrismaClient): Promise<MigrationStatus | null> {
  try {
    const result = await prisma.$queryRaw<Array<{
      migration_name: string;
      started_at: Date | null;
      finished_at: Date | null;
      applied_steps_count: number;
      logs: string | null;
    }>>`
      SELECT migration_name, started_at, finished_at, applied_steps_count, logs
      FROM "_prisma_migrations"
      WHERE migration_name = ${TARGET_MIGRATION}
      LIMIT 1
    `;

    if (result.length === 0) {
      return null;
    }

    const migration = result[0];
    const failed = migration.finished_at === null && migration.applied_steps_count > 0;
    const applied = migration.finished_at !== null && migration.applied_steps_count > 0;
    const rolledBack = migration.finished_at === null && migration.applied_steps_count === 0;

    return {
      exists: true,
      failed,
      applied,
      rolledBack,
      logs: migration.logs,
    };
  } catch (error) {
    console.error('❌ Error checking migration status:', error);
    throw error;
  }
}

async function checkDatabaseState(prisma: PrismaClient): Promise<DatabaseState> {
  try {
    // Check tables
    const [ledgerAccount, ledgerCategory, customerBalance] = await Promise.all([
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'LedgerAccount'
        ) as exists
      `,
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'LedgerCategory'
        ) as exists
      `,
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = 'CustomerBalanceSnapshot'
        ) as exists
      `,
    ]);

    // Check columns in Purchase table
    const [currencyCol, refNumCol] = await Promise.all([
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'Purchase' 
            AND column_name = 'currency'
        ) as exists
      `,
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
            AND table_name = 'Purchase' 
            AND column_name = 'referenceNumber'
        ) as exists
      `,
    ]);

    // Check enum values
    const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'AuditEntityType'
      ORDER BY enumlabel
    `;

    const enumLabels = enumValues.map((v) => v.enumlabel);
    const hasLedgerAccountEnum = enumLabels.includes('LedgerAccount');
    const hasLedgerCategoryEnum = enumLabels.includes('LedgerCategory');

    return {
      hasLedgerAccount: (ledgerAccount[0] as any).exists === true,
      hasLedgerCategory: (ledgerCategory[0] as any).exists === true,
      hasCustomerBalanceSnapshot: (customerBalance[0] as any).exists === true,
      hasCurrencyColumn: (currencyCol[0] as any).exists === true,
      hasReferenceNumberColumn: (refNumCol[0] as any).exists === true,
      hasLedgerAccountEnum,
      hasLedgerCategoryEnum,
    };
  } catch (error) {
    console.error('❌ Error checking database state:', error);
    throw error;
  }
}

async function cleanupPartialMigration(prisma: PrismaClient, state: DatabaseState): Promise<void> {
  console.log('🧹 Cleaning up partial migration...');

  try {
    // Drop tables if they exist (idempotent, safe if empty)
    if (state.hasCustomerBalanceSnapshot) {
      console.log('   → Dropping CustomerBalanceSnapshot table...');
      await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "CustomerBalanceSnapshot" CASCADE;');
    }

    if (state.hasLedgerCategory) {
      console.log('   → Dropping LedgerCategory table...');
      await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "LedgerCategory" CASCADE;');
    }

    if (state.hasLedgerAccount) {
      console.log('   → Dropping LedgerAccount table...');
      await prisma.$executeRawUnsafe('DROP TABLE IF EXISTS "LedgerAccount" CASCADE;');
    }

    // Remove enum values if they exist (PostgreSQL doesn't support direct removal, but we can ignore)
    // Note: We'll let the migration re-add them if needed

    // Keep currency and referenceNumber columns (they're safe to keep)

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

function resolveMigration(action: 'rolled-back' | 'applied', migrationName: string): void {
  console.log(`📝 Resolving migration as ${action}...`);
  try {
    // Run from monorepo root
    const currentDir = process.cwd();
    const monorepoRoot = currentDir.includes('apps/api') 
      ? path.resolve(currentDir, '../..')
      : currentDir;
    
    execSync(
      `pnpm --filter @remember-me/prisma exec prisma migrate resolve --${action} ${migrationName}`,
      { 
        stdio: 'inherit', 
        cwd: monorepoRoot,
        env: { ...process.env }
      }
    );
    console.log(`✅ Migration resolved as ${action}`);
  } catch (error) {
    console.error(`❌ Failed to resolve migration as ${action}:`, error);
    throw error;
  }
}

async function main() {
  console.log('🔍 Prisma Migration Recovery Script');
  console.log('=====================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // Step 1: Check migration status
    console.log(`📋 Checking migration status for: ${TARGET_MIGRATION}`);
    const migrationStatus = await checkMigrationStatus(prisma);

    if (!migrationStatus || !migrationStatus.exists) {
      console.log('✅ Migration not found in _prisma_migrations (not failed, nothing to recover)');
      await prisma.$disconnect();
      process.exit(0);
    }

    if (migrationStatus.applied) {
      console.log('✅ Migration is already applied (nothing to recover)');
      await prisma.$disconnect();
      process.exit(0);
    }

    if (migrationStatus.rolledBack) {
      console.log('✅ Migration is already rolled back (nothing to recover)');
      await prisma.$disconnect();
      process.exit(0);
    }

    if (!migrationStatus.failed) {
      console.log('⚠️  Migration exists but is not in failed state (skipping recovery)');
      await prisma.$disconnect();
      process.exit(0);
    }

    console.log('⚠️  Migration is in FAILED state');
    if (migrationStatus.logs) {
      console.log(`   Logs: ${migrationStatus.logs.substring(0, 200)}...`);
    }

    // Step 2: Check database state
    console.log('\n📊 Checking database state...');
    const dbState = await checkDatabaseState(prisma);
    console.log('   Database state:');
    console.log(`   - LedgerAccount table: ${dbState.hasLedgerAccount ? '✅ exists' : '❌ missing'}`);
    console.log(`   - LedgerCategory table: ${dbState.hasLedgerCategory ? '✅ exists' : '❌ missing'}`);
    console.log(`   - CustomerBalanceSnapshot table: ${dbState.hasCustomerBalanceSnapshot ? '✅ exists' : '❌ missing'}`);
    console.log(`   - Purchase.currency column: ${dbState.hasCurrencyColumn ? '✅ exists' : '❌ missing'}`);
    console.log(`   - Purchase.referenceNumber column: ${dbState.hasReferenceNumberColumn ? '✅ exists' : '❌ missing'}`);
    console.log(`   - AuditEntityType.LedgerAccount enum: ${dbState.hasLedgerAccountEnum ? '✅ exists' : '❌ missing'}`);
    console.log(`   - AuditEntityType.LedgerCategory enum: ${dbState.hasLedgerCategoryEnum ? '✅ exists' : '❌ missing'}`);

    // Step 3: Determine recovery strategy
    const hasAnyTables = dbState.hasLedgerAccount || dbState.hasLedgerCategory || dbState.hasCustomerBalanceSnapshot;
    const hasAnyColumns = dbState.hasCurrencyColumn || dbState.hasReferenceNumberColumn;
    const hasAnyEnums = dbState.hasLedgerAccountEnum || dbState.hasLedgerCategoryEnum;
    const hasEverything = hasAnyTables && hasAnyColumns && hasAnyEnums;

    console.log('\n🎯 Recovery strategy:');

    if (!hasAnyTables && !hasAnyColumns && !hasAnyEnums) {
      // Nothing was applied, just mark as rolled-back
      console.log('   → Nothing was applied, marking as rolled-back');
      resolveMigration('rolled-back', TARGET_MIGRATION);
    } else if (hasEverything) {
      // Everything exists, mark as applied
      console.log('   → Everything exists, marking as applied');
      resolveMigration('applied', TARGET_MIGRATION);
    } else {
      // Partial application, cleanup and mark as rolled-back
      console.log('   → Partial application detected, cleaning up...');
      await cleanupPartialMigration(prisma, dbState);
      resolveMigration('rolled-back', TARGET_MIGRATION);
    }

    console.log('\n✅ Recovery completed successfully');
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Recovery failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
