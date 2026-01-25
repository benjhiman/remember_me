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
import * as url from 'url';

const TARGET_MIGRATION = '20250124120000_add_accounting_lite_models';

interface MigrationRecord {
  migration_name: string;
  started_at: Date | null;
  finished_at: Date | null;
  rolled_back_at: Date | null;
  applied_steps_count: number;
  logs: string | null;
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

function redactDatabaseUrl(dbUrl: string): string {
  try {
    const parsed = url.parse(dbUrl);
    if (parsed.auth) {
      const [user, ...passParts] = parsed.auth.split(':');
      const password = passParts.join(':');
      parsed.auth = `${user}:${password ? '***' : ''}`;
    }
    return url.format(parsed);
  } catch {
    // If parsing fails, just redact after @
    const atIndex = dbUrl.indexOf('@');
    if (atIndex > 0) {
      const beforeAt = dbUrl.substring(0, dbUrl.indexOf(':', dbUrl.indexOf('://') + 3) + 1);
      return `${beforeAt}***@${dbUrl.substring(atIndex + 1)}`;
    }
    return '***';
  }
}

function getDatabaseHostname(dbUrl: string): string {
  try {
    const parsed = url.parse(dbUrl);
    return parsed.hostname || 'unknown';
  } catch {
    return 'unknown';
  }
}

async function getMigrationRecord(prisma: PrismaClient): Promise<MigrationRecord | null> {
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
      WHERE migration_name = ${TARGET_MIGRATION}
      ORDER BY started_at DESC
      LIMIT 1
    `;

    if (result.length === 0) {
      return null;
    }

    return result[0];
  } catch (error) {
    console.error('❌ Error querying _prisma_migrations:', error);
    throw error;
  }
}

function isFailed(record: MigrationRecord): boolean {
  return (
    record.finished_at === null &&
    record.rolled_back_at === null &&
    record.started_at !== null
  );
}

async function checkDatabaseState(prisma: PrismaClient): Promise<DatabaseState> {
  try {
    // Check tables using to_regclass (PostgreSQL native)
    const [ledgerAccount, ledgerCategory, customerBalance] = await Promise.all([
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT (to_regclass('public."LedgerAccount"') IS NOT NULL) as exists
      `,
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT (to_regclass('public."LedgerCategory"') IS NOT NULL) as exists
      `,
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT (to_regclass('public."CustomerBalanceSnapshot"') IS NOT NULL) as exists
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

async function cleanupPartialTables(prisma: PrismaClient, state: DatabaseState): Promise<void> {
  console.log('🧹 Cleaning up partial tables (if needed)...');

  try {
    // Only drop tables if they exist and might cause issues
    // We keep columns in Purchase as they're safe
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

    console.log('✅ Cleanup completed');
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

function getMonorepoRoot(): string {
  const currentDir = process.cwd();
  return currentDir.includes('apps/api') 
    ? path.resolve(currentDir, '../..')
    : currentDir;
}

async function resolveMigrationViaPrisma(action: 'rolled-back' | 'applied', migrationName: string): Promise<boolean> {
  console.log(`📝 Attempting to resolve migration as ${action} via Prisma CLI...`);
  try {
    const monorepoRoot = getMonorepoRoot();
    
    execSync(
      `pnpm --filter @remember-me/prisma exec prisma migrate resolve --${action} ${migrationName}`,
      { 
        stdio: 'inherit', 
        cwd: monorepoRoot,
        env: { ...process.env }
      }
    );
    console.log(`✅ Migration resolved as ${action} via Prisma CLI`);
    return true;
  } catch (error) {
    console.error(`⚠️  Failed to resolve migration via Prisma CLI:`, error);
    return false;
  }
}

async function forceRollbackViaSQL(prisma: PrismaClient, migrationName: string): Promise<void> {
  console.log('🔧 Forcing rollback via direct SQL UPDATE...');
  try {
    await prisma.$executeRawUnsafe(`
      UPDATE "_prisma_migrations"
      SET 
        rolled_back_at = NOW(),
        finished_at = NOW(),
        logs = COALESCE(logs, '') || E'\\n[auto-recover] forced rolled_back_at/finished_at at ' || NOW()::text
      WHERE migration_name = $1
        AND finished_at IS NULL
        AND rolled_back_at IS NULL
    `, migrationName);
    
    console.log('✅ Forced rollback via SQL completed');
  } catch (error) {
    console.error('❌ Failed to force rollback via SQL:', error);
    throw error;
  }
}

async function verifyMigrationCleared(prisma: PrismaClient): Promise<boolean> {
  const record = await getMigrationRecord(prisma);
  if (!record) {
    return true; // No record exists, that's fine
  }
  return !isFailed(record); // Not failed anymore
}

async function printMigrationStatus(prisma: PrismaClient): Promise<void> {
  const record = await getMigrationRecord(prisma);
  if (!record) {
    console.log('   → No migration record found');
    return;
  }
  
  console.log('   → Migration record:');
  console.log(`      - migration_name: ${record.migration_name}`);
  console.log(`      - started_at: ${record.started_at || 'NULL'}`);
  console.log(`      - finished_at: ${record.finished_at || 'NULL'}`);
  console.log(`      - rolled_back_at: ${record.rolled_back_at || 'NULL'}`);
  console.log(`      - applied_steps_count: ${record.applied_steps_count}`);
  console.log(`      - is_failed: ${isFailed(record)}`);
  if (record.logs) {
    console.log(`      - logs (last 200 chars): ${record.logs.substring(Math.max(0, record.logs.length - 200))}`);
  }
}

async function runMigrateDeploy(): Promise<void> {
  console.log('🚀 Running prisma migrate deploy...');
  try {
    const monorepoRoot = getMonorepoRoot();
    
    execSync(
      `pnpm --filter @remember-me/prisma db:migrate:deploy`,
      { 
        stdio: 'inherit', 
        cwd: monorepoRoot,
        env: { ...process.env }
      }
    );
    console.log('✅ prisma migrate deploy completed successfully');
  } catch (error) {
    console.error('❌ prisma migrate deploy failed:', error);
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

  // PASO 1: Log DATABASE_URL (redactado) y hostname
  const redactedUrl = redactDatabaseUrl(process.env.DATABASE_URL);
  const hostname = getDatabaseHostname(process.env.DATABASE_URL);
  console.log(`📡 Database connection:`);
  console.log(`   - DATABASE_URL: ${redactedUrl}`);
  console.log(`   - Hostname: ${hostname}\n`);

  const prisma = new PrismaClient();

  try {
    // PASO 2: Query directo a _prisma_migrations
    console.log(`📋 Checking migration status for: ${TARGET_MIGRATION}`);
    const migrationRecord = await getMigrationRecord(prisma);

    if (!migrationRecord) {
      console.log('✅ No failed migration record found');
      console.log('   → Proceeding with normal migrate deploy...\n');
      await prisma.$disconnect();
      await runMigrateDeploy();
      process.exit(0);
    }

    console.log('   → Migration record found:');
    console.log(`      - started_at: ${migrationRecord.started_at || 'NULL'}`);
    console.log(`      - finished_at: ${migrationRecord.finished_at || 'NULL'}`);
    console.log(`      - rolled_back_at: ${migrationRecord.rolled_back_at || 'NULL'}`);
    console.log(`      - applied_steps_count: ${migrationRecord.applied_steps_count}`);
    
    const isFailedState = isFailed(migrationRecord);
    
    if (!isFailedState) {
      if (migrationRecord.finished_at) {
        console.log('✅ Migration is already applied (nothing to recover)');
      } else if (migrationRecord.rolled_back_at) {
        console.log('✅ Migration is already rolled back (nothing to recover)');
      } else {
        console.log('⚠️  Migration exists but is not in failed state (skipping recovery)');
      }
      await prisma.$disconnect();
      await runMigrateDeploy();
      process.exit(0);
    }

    console.log('⚠️  Migration is in FAILED state');
    if (migrationRecord.logs) {
      console.log(`   → Logs: ${migrationRecord.logs.substring(0, 300)}...`);
    }

    // PASO 3: Check database state
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

    // Determine if everything is applied
    const hasAllTables = dbState.hasLedgerAccount && dbState.hasLedgerCategory && dbState.hasCustomerBalanceSnapshot;
    const hasAllColumns = dbState.hasCurrencyColumn && dbState.hasReferenceNumberColumn;
    const hasAllEnums = dbState.hasLedgerAccountEnum && dbState.hasLedgerCategoryEnum;
    const hasEverything = hasAllTables && hasAllColumns && hasAllEnums;

    console.log('\n🎯 Recovery strategy:');

    if (hasEverything) {
      // A2: Everything exists, mark as applied
      console.log('   → Everything is applied, marking as applied...');
      const resolved = await resolveMigrationViaPrisma('applied', TARGET_MIGRATION);
      
      if (!resolved) {
        console.error('❌ Failed to resolve as applied, cannot proceed');
        await printMigrationStatus(prisma);
        await prisma.$disconnect();
        process.exit(1);
      }

      // Verify it's cleared
      const cleared = await verifyMigrationCleared(prisma);
      if (!cleared) {
        console.error('❌ Migration still appears as failed after resolve --applied');
        await printMigrationStatus(prisma);
        await prisma.$disconnect();
        process.exit(1);
      }

      console.log('✅ Recovered FAILED migration record (marked as applied)');
      await printMigrationStatus(prisma);
      
      await prisma.$disconnect();
      await runMigrateDeploy();
      process.exit(0);
    } else {
      // A3: Partial or nothing applied, cleanup and rollback
      console.log('   → Partial or no application detected, cleaning up and rolling back...');
      
      // Cleanup partial tables if needed
      if (dbState.hasLedgerAccount || dbState.hasLedgerCategory || dbState.hasCustomerBalanceSnapshot) {
        await cleanupPartialTables(prisma, dbState);
      }

      // Try Prisma CLI first
      const resolved = await resolveMigrationViaPrisma('rolled-back', TARGET_MIGRATION);
      
      if (!resolved) {
        console.log('   → Prisma CLI resolve failed, trying direct SQL...');
        await forceRollbackViaSQL(prisma, TARGET_MIGRATION);
      }

      // Verify it's cleared
      const cleared = await verifyMigrationCleared(prisma);
      if (!cleared) {
        console.error('❌ Migration still appears as failed after rollback attempt');
        await printMigrationStatus(prisma);
        await prisma.$disconnect();
        process.exit(1);
      }

      console.log('✅ Recovered FAILED migration record (marked as rolled-back)');
      await printMigrationStatus(prisma);
      
      await prisma.$disconnect();
      await runMigrateDeploy();
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Recovery failed:', error);
    console.log('\n📋 Final migration status:');
    await printMigrationStatus(prisma).catch(() => {});
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
