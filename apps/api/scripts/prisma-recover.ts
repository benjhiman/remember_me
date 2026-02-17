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
const PURCHASE_STOCK_MIGRATION = '20250124130000_add_purchase_stock_application';
const PRICE_LISTS_MIGRATION = '20250131000002_add_price_lists';

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

interface DatabaseAudit {
  isDatabaseEmpty: boolean;
  hasOrganizationTable: boolean;
  organizationCount: number | null;
  coreTablesMissing: string[];
  hasPurchaseTable: boolean;
  allTables: string[];
  emptyReason: string;
}

interface DatabaseFingerprint {
  host: string;
  port: string;
  database: string;
  username: string;
  fingerprint: string;
}

function getDatabaseFingerprint(dbUrl: string): DatabaseFingerprint {
  try {
    const parsed = new URL(dbUrl);
    const fingerprint = `host=${parsed.hostname} port=${parsed.port || '5432'} db=${parsed.pathname.replace('/', '')} user=${parsed.username}`;
    return {
      host: parsed.hostname || 'unknown',
      port: parsed.port || '5432',
      database: parsed.pathname.replace('/', '') || 'unknown',
      username: parsed.username || 'unknown',
      fingerprint,
    };
  } catch (error) {
    return {
      host: 'unknown',
      port: 'unknown',
      database: 'unknown',
      username: 'unknown',
      fingerprint: 'unknown',
    };
  }
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

let initialFingerprint: DatabaseFingerprint | null = null;

function verifyFingerprintConsistency(dbUrl: string, step: string): void {
  const currentFingerprint = getDatabaseFingerprint(dbUrl);
  
  if (!initialFingerprint) {
    initialFingerprint = currentFingerprint;
    return;
  }

  if (
    initialFingerprint.host !== currentFingerprint.host ||
    initialFingerprint.port !== currentFingerprint.port ||
    initialFingerprint.database !== currentFingerprint.database ||
    initialFingerprint.username !== currentFingerprint.username
  ) {
    throw new Error(
      `DATABASE_URL MISMATCH BETWEEN STEPS\n` +
      `Initial: ${initialFingerprint.fingerprint}\n` +
      `Current (${step}): ${currentFingerprint.fingerprint}`
    );
  }
}

async function getMigrationRecord(prisma: PrismaClient, migrationName?: string): Promise<MigrationRecord | null> {
  try {
    const target = migrationName || TARGET_MIGRATION;
    const result = await prisma.$queryRaw<Array<MigrationRecord>>`
      SELECT 
        migration_name, 
        started_at, 
        finished_at, 
        rolled_back_at, 
        applied_steps_count, 
        logs
      FROM "_prisma_migrations"
      WHERE migration_name = ${target}
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

async function getAllFailedMigrations(prisma: PrismaClient): Promise<MigrationRecord[]> {
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
      WHERE finished_at IS NULL
        AND rolled_back_at IS NULL
        AND started_at IS NOT NULL
      ORDER BY started_at DESC
    `;

    return result;
  } catch (error) {
    console.error('❌ Error querying failed migrations:', error);
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

async function auditDatabase(prisma: PrismaClient): Promise<DatabaseAudit> {
  try {
    // Query ALL tables from information_schema (REAL query, no assumptions)
    const tablesResult = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;

    const allTables = tablesResult.map((t) => t.tablename);
    
    // Check specific core tables
    const hasOrganizationTable = allTables.includes('Organization');
    const hasPurchaseTable = allTables.includes('Purchase');
    const hasUserTable = allTables.includes('User');

    // Check core tables
    const coreTables = ['Organization', 'User', 'Purchase', 'PurchaseLine', 'Customer', 'Vendor'];
    const coreTablesMissing: string[] = [];
    
    for (const table of coreTables) {
      if (!allTables.includes(table)) {
        coreTablesMissing.push(table);
      }
    }

    let organizationCount: number | null = null;
    if (hasOrganizationTable) {
      try {
        const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::int as count FROM "Organization"
        `;
        organizationCount = Number(countResult[0]?.count || 0);
      } catch {
        organizationCount = null;
      }
    }

    // Determine if database is empty/incomplete (IRREFUTABLE LOGIC)
    let isDatabaseEmpty = false;
    let emptyReason = '';

    if (allTables.length <= 1 && allTables.includes('_prisma_migrations')) {
      isDatabaseEmpty = true;
      emptyReason = 'Only _prisma_migrations table exists';
    } else if (!hasPurchaseTable) {
      isDatabaseEmpty = true;
      emptyReason = 'Purchase table missing';
    } else if (!hasOrganizationTable) {
      isDatabaseEmpty = true;
      emptyReason = 'Organization table missing';
    } else if (!hasUserTable) {
      isDatabaseEmpty = true;
      emptyReason = 'User table missing';
    } else {
      emptyReason = 'Database has core tables';
    }

    return {
      isDatabaseEmpty,
      hasOrganizationTable,
      organizationCount,
      coreTablesMissing,
      hasPurchaseTable,
      allTables: allTables.slice(0, 30), // First 30 tables
      emptyReason,
    };
  } catch (error) {
    console.error('❌ Error auditing database:', error);
    throw error;
  }
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
    
    // Verify fingerprint before executing
    if (process.env.DATABASE_URL) {
      verifyFingerprintConsistency(process.env.DATABASE_URL, `resolve-${action}`);
    }
    
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

async function verifyMigrationCleared(prisma: PrismaClient, migrationName?: string): Promise<boolean> {
  const record = await getMigrationRecord(prisma, migrationName);
  if (!record) {
    return true; // No record exists, that's fine
  }
  return !isFailed(record); // Not failed anymore
}

interface PriceListsAudit {
  hasPriceListTable: boolean;
  hasPriceListItemTable: boolean;
  hasPriceListItemOverrideTable: boolean;
  allTablesExist: boolean;
}

async function auditPriceListsMigration(prisma: PrismaClient): Promise<PriceListsAudit> {
  try {
    // Check tables using to_regclass (PostgreSQL native)
    const [priceList, priceListItem, priceListItemOverride] = await Promise.all([
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT (to_regclass('public."PriceList"') IS NOT NULL) as exists
      `,
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT (to_regclass('public."PriceListItem"') IS NOT NULL) as exists
      `,
      prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT (to_regclass('public."PriceListItemOverride"') IS NOT NULL) as exists
      `,
    ]);

    const hasPriceListTable = (priceList[0] as any)?.exists === true;
    const hasPriceListItemTable = (priceListItem[0] as any)?.exists === true;
    const hasPriceListItemOverrideTable = (priceListItemOverride[0] as any)?.exists === true;
    const allTablesExist = hasPriceListTable && hasPriceListItemTable && hasPriceListItemOverrideTable;

    return {
      hasPriceListTable,
      hasPriceListItemTable,
      hasPriceListItemOverrideTable,
      allTablesExist,
    };
  } catch (error) {
    console.error('❌ Error auditing PriceLists migration:', error);
    return {
      hasPriceListTable: false,
      hasPriceListItemTable: false,
      hasPriceListItemOverrideTable: false,
      allTablesExist: false,
    };
  }
}

interface PurchaseStockApplicationAudit {
  hasPurchaseStockApplicationTable: boolean;
  hasPurchaseLineStockItemIdColumn: boolean;
  hasPurchaseLineStockItemIdIndex: boolean;
  hasPurchaseStockApplicationIndexes: boolean;
  hasPurchaseStockApplicationForeignKeys: boolean;
  allChangesApplied: boolean;
}

async function auditPurchaseStockApplicationMigration(prisma: PrismaClient): Promise<PurchaseStockApplicationAudit> {
  try {
    // Check if PurchaseStockApplication table exists
    const tableCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT (to_regclass('public."PurchaseStockApplication"') IS NOT NULL) as exists
    `;
    const hasPurchaseStockApplicationTable = (tableCheck[0] as any).exists === true;

    // Check if PurchaseLine.stockItemId column exists
    const columnCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
          AND table_name = 'PurchaseLine' 
          AND column_name = 'stockItemId'
      ) as exists
    `;
    const hasPurchaseLineStockItemIdColumn = (columnCheck[0] as any).exists === true;

    // Check if PurchaseLine_stockItemId_idx index exists
    const indexCheck = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'public' 
          AND indexname = 'PurchaseLine_stockItemId_idx'
      ) as exists
    `;
    const hasPurchaseLineStockItemIdIndex = (indexCheck[0] as any).exists === true;

    // Check if PurchaseStockApplication indexes exist
    // Note: UNIQUE INDEX appears in pg_indexes, not as a constraint
    const psaIndexes = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes 
      WHERE schemaname = 'public' 
        AND tablename = 'PurchaseStockApplication'
    `;
    const indexNames = psaIndexes.map((i) => i.indexname);
    
    // Also check unique constraints (which may appear as indexes)
    const uniqueConstraints = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
        AND table_name = 'PurchaseStockApplication'
        AND constraint_type = 'UNIQUE'
    `;
    const constraintNames = uniqueConstraints.map((c) => c.constraint_name);
    
    const hasPurchaseStockApplicationIndexes = 
      (indexNames.includes('PurchaseStockApplication_purchaseId_key') || 
       constraintNames.includes('PurchaseStockApplication_purchaseId_key')) &&
      (indexNames.some((n) => n.includes('organizationId_appliedAt')) ||
       indexNames.some((n) => n.includes('organizationId') && n.includes('appliedAt'))) &&
      (indexNames.some((n) => n.includes('purchaseId')) || 
       indexNames.some((n) => n === 'PurchaseStockApplication_purchaseId_key'));

    // Check if foreign keys exist
    const fkCheck = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
        AND table_name = 'PurchaseStockApplication'
        AND constraint_type = 'FOREIGN KEY'
    `;
    const fkNames = fkCheck.map((f) => f.constraint_name);
    const hasPurchaseStockApplicationForeignKeys = 
      fkNames.some((n) => n.includes('organizationId')) &&
      fkNames.some((n) => n.includes('purchaseId')) &&
      fkNames.some((n) => n.includes('appliedByUserId'));

    // Check PurchaseLine foreign key
    const purchaseLineFk = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_schema = 'public' 
        AND table_name = 'PurchaseLine'
        AND constraint_name = 'PurchaseLine_stockItemId_fkey'
    `;
    const hasPurchaseLineFk = purchaseLineFk.length > 0;

    const allChangesApplied = 
      hasPurchaseStockApplicationTable &&
      hasPurchaseLineStockItemIdColumn &&
      hasPurchaseLineStockItemIdIndex &&
      hasPurchaseStockApplicationIndexes &&
      hasPurchaseStockApplicationForeignKeys &&
      hasPurchaseLineFk;

    return {
      hasPurchaseStockApplicationTable,
      hasPurchaseLineStockItemIdColumn,
      hasPurchaseLineStockItemIdIndex,
      hasPurchaseStockApplicationIndexes,
      hasPurchaseStockApplicationForeignKeys,
      allChangesApplied,
    };
  } catch (error) {
    console.error('❌ Error auditing PurchaseStockApplication migration:', error);
    throw error;
  }
}

async function printMigrationStatus(prisma: PrismaClient, migrationName?: string): Promise<void> {
  const record = await getMigrationRecord(prisma, migrationName);
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
    console.log(`      - logs (last 500 chars): ${record.logs.substring(Math.max(0, record.logs.length - 500))}`);
  }
}

async function runDbPush(): Promise<void> {
  console.log('🔨 Running prisma db push --accept-data-loss...');
  
  // Verify fingerprint before db push
  if (process.env.DATABASE_URL) {
    verifyFingerprintConsistency(process.env.DATABASE_URL, 'db-push');
    const fingerprint = getDatabaseFingerprint(process.env.DATABASE_URL);
    console.log(`DB_FINGERPRINT (before db push) => ${fingerprint.fingerprint}`);
  }
  
  try {
    const monorepoRoot = getMonorepoRoot();
    
    // Capture stdout and stderr
    let stdout = '';
    let stderr = '';
    
    try {
      const output = execSync(
        `pnpm --filter @remember-me/prisma exec prisma db push --accept-data-loss`,
        { 
          stdio: 'pipe',
          encoding: 'utf8',
          cwd: monorepoRoot,
          env: { ...process.env }
        }
      );
      stdout = output.toString();
      console.log(stdout);
    } catch (error: any) {
      stdout = error.stdout?.toString() || '';
      stderr = error.stderr?.toString() || '';
      console.log('STDOUT:', stdout);
      console.error('STDERR:', stderr);
      throw error;
    }
    
    console.log('✅ prisma db push completed successfully');
  } catch (error) {
    console.error('❌ prisma db push failed:', error);
    throw error;
  }
}

async function validatePurchaseTableWithSQL(prisma: PrismaClient): Promise<boolean> {
  console.log('🔍 Validating Purchase table with SQL (to_regclass)...');
  try {
    const result = await prisma.$queryRaw<Array<{ purchase_table: string | null }>>`
      SELECT to_regclass('public."Purchase"') AS purchase_table
    `;
    
    const purchaseTable = result[0]?.purchase_table;
    const exists = purchaseTable !== null && purchaseTable !== '';
    
    console.log(`   → to_regclass('public."Purchase"') = ${purchaseTable || 'NULL'}`);
    
    if (!exists) {
      console.error('❌ Purchase table validation FAILED - table does not exist');
      return false;
    }
    
    console.log('✅ DB PUSH VALIDATED — Purchase table exists');
    return true;
  } catch (error) {
    console.error('❌ Error validating Purchase table:', error);
    return false;
  }
}

async function runMigrateDeploy(rescueMode: boolean = false): Promise<boolean> {
  console.log('🚀 Running prisma migrate deploy...');
  
  // Verify fingerprint before migrate deploy
  if (process.env.DATABASE_URL) {
    verifyFingerprintConsistency(process.env.DATABASE_URL, 'migrate-deploy');
    const fingerprint = getDatabaseFingerprint(process.env.DATABASE_URL);
    console.log(`DB_FINGERPRINT (before migrate deploy) => ${fingerprint.fingerprint}`);
  }
  
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
    return true;
  } catch (error: any) {
    console.error('❌ prisma migrate deploy failed:', error);
    
    // Check if error is about Purchase not existing (DATABASE_URL mismatch)
    const errorMessage = error.message || error.toString() || '';
    if (errorMessage.includes('relation "Purchase" does not exist') || errorMessage.includes('42P01')) {
      console.error('\n🚨 CRITICAL ERROR: DATABASE_URL USED BY MIGRATE DEPLOY IS DIFFERENT FROM DB PUSH');
      if (initialFingerprint) {
        const currentFingerprint = getDatabaseFingerprint(process.env.DATABASE_URL || '');
        console.error(`Initial fingerprint: ${initialFingerprint.fingerprint}`);
        console.error(`Current fingerprint: ${currentFingerprint.fingerprint}`);
      }
      throw new Error('DATABASE_URL mismatch detected - Purchase table exists but migrate deploy cannot see it');
    }
    
    if (rescueMode) {
      console.log('⚠️  RESCUE MODE: Continuing despite migration failure');
      return false;
    }
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

  // PASO 1: Fingerprint IRREFUTABLE del DATABASE_URL
  const fingerprint = getDatabaseFingerprint(process.env.DATABASE_URL);
  initialFingerprint = fingerprint;
  
  console.log('📡 DATABASE FINGERPRINT:');
  console.log(`DB_FINGERPRINT => ${fingerprint.fingerprint}`);
  console.log(`   - host: ${fingerprint.host}`);
  console.log(`   - port: ${fingerprint.port}`);
  console.log(`   - database: ${fingerprint.database}`);
  console.log(`   - username: ${fingerprint.username}`);
  console.log(`   - process.cwd(): ${process.cwd()}`);
  console.log(`   - NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`   - RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT || 'not set'}\n`);

  const redactedUrl = redactDatabaseUrl(process.env.DATABASE_URL);
  console.log(`   - DATABASE_URL (redacted): ${redactedUrl}\n`);

  const prisma = new PrismaClient();
  const rescueMode = process.env.PRISMA_MIGRATE_MODE === 'rescue';

  try {
    // PASO 2: Auditoría REAL de la base (SIN SUPOSICIONES)
    console.log('📊 Auditing database state (REAL queries to information_schema)...');
    const dbAudit = await auditDatabase(prisma);
    
    console.log('\n📋 Database Audit Results:');
    console.log(`   - allTables (first 30): ${dbAudit.allTables.join(', ') || 'none'}`);
    console.log(`   - totalTables: ${dbAudit.allTables.length}`);
    console.log(`   - hasOrganizationTable: ${dbAudit.hasOrganizationTable}`);
    console.log(`   - hasPurchaseTable: ${dbAudit.hasPurchaseTable}`);
    console.log(`   - organizationCount: ${dbAudit.organizationCount}`);
    console.log(`   - coreTablesMissing: ${dbAudit.coreTablesMissing.join(', ') || 'none'}`);
    console.log(`   - isDatabaseEmpty: ${dbAudit.isDatabaseEmpty}`);
    console.log(`   - emptyReason: ${dbAudit.emptyReason}\n`);

    // CASO A: DB VACÍA O INCOMPLETA
    if (dbAudit.isDatabaseEmpty) {
      console.log('⚠️  EMPTY OR INCOMPLETE DATABASE DETECTED — FORCING DB PUSH');
      console.log(`   Reason: ${dbAudit.emptyReason}\n`);
      
      await prisma.$disconnect();
      await runDbPush();
      
      // PASO 3: VALIDACIÓN SQL OBLIGATORIA (NO Prisma)
      const prisma2 = new PrismaClient();
      const purchaseExists = await validatePurchaseTableWithSQL(prisma2);
      await prisma2.$disconnect();
      
      if (!purchaseExists) {
        throw new Error('DB PUSH FAILED — Purchase table still missing after db push');
      }
      
      console.log('✅ Purchase table validated with SQL\n');
      console.log('✅ DB PUSH completed - ready for migrate deploy\n');
      
      // Exit successfully - migrate deploy will run separately
      process.exit(0);
    }

    // CASO B: DB NO VACÍA - Continuar con recovery normal
    console.log('✅ Database has data - using normal migration flow\n');

    // Check for ALL failed migrations (P3009 detection) - PRIORITY
    console.log('📋 Checking for failed migrations (P3009)...');
    
    // Specific migration: 20250131000002_add_price_lists
    const priceListsMigration = '20250131000002_add_price_lists';
    const priceListsFailed = await checkFailedMigration(priceListsMigration);
    if (priceListsFailed) {
      console.log(`\n⚠️  Found failed migration: ${priceListsMigration}`);
      console.log('   This migration creates PriceList tables.');
      console.log('   Attempting to resolve automatically...');
      
      // Check if tables exist (migration partially succeeded)
      const tablesExist = await checkTablesExist([
        'PriceList',
        'PriceListItem',
        'PriceListItemOverride',
      ]);
      
      if (tablesExist) {
        console.log('   ✓ Tables exist - marking migration as applied');
        await resolveMigration(priceListsMigration, 'applied');
      } else {
        console.log('   ✗ Tables do not exist - marking migration as rolled-back');
        await resolveMigration(priceListsMigration, 'rolled-back');
      }
    }
    const failedMigrations = await getAllFailedMigrations(prisma);
    
    if (failedMigrations.length > 0) {
      console.log(`⚠️  Found ${failedMigrations.length} failed migration(s):`);
      failedMigrations.forEach((m) => {
        console.log(`   - ${m.migration_name} (started: ${m.started_at}, steps: ${m.applied_steps_count})`);
        if (m.logs) {
          console.log(`     Logs (last 200 chars): ${m.logs.substring(Math.max(0, m.logs.length - 200))}`);
        }
      });
      
      // Handle PurchaseStockApplication migration specifically
      const purchaseStockMigration = failedMigrations.find(
        (m) => m.migration_name === PURCHASE_STOCK_MIGRATION
      );
      
      if (purchaseStockMigration) {
        console.log(`\n🔍 Auditing ${PURCHASE_STOCK_MIGRATION} migration state...`);
        const psaAudit = await auditPurchaseStockApplicationMigration(prisma);
        
        console.log('   Migration audit results:');
        console.log(`   - PurchaseStockApplication table: ${psaAudit.hasPurchaseStockApplicationTable ? '✅ exists' : '❌ missing'}`);
        console.log(`   - PurchaseLine.stockItemId column: ${psaAudit.hasPurchaseLineStockItemIdColumn ? '✅ exists' : '❌ missing'}`);
        console.log(`   - PurchaseLine_stockItemId_idx index: ${psaAudit.hasPurchaseLineStockItemIdIndex ? '✅ exists' : '❌ missing'}`);
        console.log(`   - PurchaseStockApplication indexes: ${psaAudit.hasPurchaseStockApplicationIndexes ? '✅ exists' : '❌ missing'}`);
        console.log(`   - PurchaseStockApplication foreign keys: ${psaAudit.hasPurchaseStockApplicationForeignKeys ? '✅ exists' : '❌ missing'}`);
        console.log(`   - All changes applied: ${psaAudit.allChangesApplied ? '✅ YES' : '❌ NO'}`);
        
        if (psaAudit.allChangesApplied) {
          console.log('\n✅ All changes from migration are already applied');
          console.log('   → Marking migration as applied...');
          
          const resolved = await resolveMigrationViaPrisma('applied', PURCHASE_STOCK_MIGRATION);
          if (!resolved) {
            console.error('❌ Failed to resolve migration as applied');
            await printMigrationStatus(prisma, PURCHASE_STOCK_MIGRATION);
            await prisma.$disconnect();
            process.exit(1);
          }
          
          const cleared = await verifyMigrationCleared(prisma, PURCHASE_STOCK_MIGRATION);
          if (!cleared) {
            console.error('❌ Migration still appears as failed after resolve');
            await printMigrationStatus(prisma, PURCHASE_STOCK_MIGRATION);
            await prisma.$disconnect();
            process.exit(1);
          }
          
          console.log('✅ Migration resolved as applied');
          console.log('   → Continuing with other migrations...\n');
        } else {
          console.error('\n❌ Migration changes are NOT fully applied');
          console.error('   → Cannot safely mark as applied');
          console.error('   → Manual intervention required');
          console.error('\n📋 To fix manually:');
          console.error('   1. Review the migration SQL: packages/prisma/migrations/20250124130000_add_purchase_stock_application/migration.sql');
          console.error('   2. Apply missing changes manually or create a hotfix migration');
          console.error('   3. Then run: pnpm --filter @remember-me/prisma exec prisma migrate resolve --applied 20250124130000_add_purchase_stock_application');
          await printMigrationStatus(prisma, PURCHASE_STOCK_MIGRATION);
          await prisma.$disconnect();
          process.exit(1);
        }
      }
      
      // Check if there are other failed migrations (besides PurchaseStockApplication and PriceLists)
      const otherFailedMigrations = failedMigrations.filter(
        (m) => m.migration_name !== PURCHASE_STOCK_MIGRATION && m.migration_name !== PRICE_LISTS_MIGRATION
      );
      
      if (otherFailedMigrations.length > 0) {
        console.log(`⚠️  ${otherFailedMigrations.length} other failed migration(s) detected`);
        otherFailedMigrations.forEach((m) => {
          console.log(`   - ${m.migration_name}`);
        });
        console.log('   → These will be handled by standard recovery logic\n');
      }
    } else {
      console.log('✅ No failed migrations found\n');
    }

    // Check migration status for TARGET_MIGRATION (existing logic)
    console.log(`📋 Checking migration status for: ${TARGET_MIGRATION}`);
    const migrationRecord = await getMigrationRecord(prisma);

    if (!migrationRecord) {
      console.log('✅ No failed migration record found');
      console.log('   → Database ready for migrate deploy\n');
      await prisma.$disconnect();
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
      console.log('   → Database ready for migrate deploy\n');
      process.exit(0);
    }

    console.log('⚠️  Migration is in FAILED state');
    if (migrationRecord.logs) {
      console.log(`   → Logs: ${migrationRecord.logs.substring(0, 300)}...`);
    }

    // Check database state for migration recovery
    console.log('\n📊 Checking database state for migration recovery...');
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
      const cleared = await verifyMigrationCleared(prisma, TARGET_MIGRATION);
      if (!cleared) {
        console.error('❌ Migration still appears as failed after resolve --applied');
        await printMigrationStatus(prisma);
        await prisma.$disconnect();
        process.exit(1);
      }

      console.log('✅ Recovered FAILED migration record (marked as applied)');
      await printMigrationStatus(prisma);
      
      await prisma.$disconnect();
      console.log('   → Database ready for migrate deploy\n');
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
      const cleared = await verifyMigrationCleared(prisma, TARGET_MIGRATION);
      if (!cleared) {
        console.error('❌ Migration still appears as failed after rollback attempt');
        await printMigrationStatus(prisma);
        await prisma.$disconnect();
        process.exit(1);
      }

      console.log('✅ Recovered FAILED migration record (marked as rolled-back)');
      await printMigrationStatus(prisma);
      
      await prisma.$disconnect();
      console.log('   → Database ready for migrate deploy\n');
      process.exit(0);
    }
  } catch (error) {
    console.error('\n❌ Recovery failed:', error);
    console.log('\n📋 Final migration status:');
    await printMigrationStatus(prisma).catch(() => {});
    
    if (rescueMode) {
      console.log('\n⚠️  RESCUE MODE: Exiting with code 0 to allow API to start');
      await prisma.$disconnect();
      process.exit(0);
    }
    
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
