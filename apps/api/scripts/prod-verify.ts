/**
 * Production Verification Script
 * 
 * Verifies that production database is in a healthy state:
 * - No failed migrations (P3009)
 * - Migration 20250124130000_add_purchase_stock_application is properly applied
 * - All expected schema changes exist
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/prod-verify.ts
 */

import { PrismaClient } from '@prisma/client';
import * as url from 'url';

const PURCHASE_STOCK_MIGRATION = '20250124130000_add_purchase_stock_application';

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

async function main() {
  console.log('🔍 Production Verification Script');
  console.log('==================================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ VERIFY FAILED: DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  // A) Log DB_FINGERPRINT
  const fingerprint = getDatabaseFingerprint(process.env.DATABASE_URL);
  console.log('📡 DATABASE FINGERPRINT:');
  console.log(`DB_FINGERPRINT => ${fingerprint.fingerprint}`);
  console.log(`   - host: ${fingerprint.host}`);
  console.log(`   - port: ${fingerprint.port}`);
  console.log(`   - database: ${fingerprint.database}`);
  console.log(`   - username: ${fingerprint.username}\n`);

  const prisma = new PrismaClient();
  let allChecksPassed = true;
  const failures: string[] = [];

  try {
    // B) Check for failed migrations
    console.log('📋 Checking for failed migrations (P3009)...');
    const failedMigrations = await prisma.$queryRaw<Array<{
      migration_name: string;
      started_at: Date | null;
      finished_at: Date | null;
      rolled_back_at: Date | null;
      applied_steps_count: number;
    }>>`
      SELECT 
        migration_name, 
        started_at, 
        finished_at, 
        rolled_back_at, 
        applied_steps_count
      FROM "_prisma_migrations"
      WHERE finished_at IS NULL 
        AND rolled_back_at IS NULL
        AND started_at IS NOT NULL
      ORDER BY started_at DESC
    `;

    if (failedMigrations.length > 0) {
      console.error(`❌ VERIFY FAILED: Found ${failedMigrations.length} failed migration(s):`);
      failedMigrations.forEach((m) => {
        console.error(`   - ${m.migration_name} (started: ${m.started_at}, steps: ${m.applied_steps_count})`);
        failures.push(`Failed migration: ${m.migration_name}`);
      });
      allChecksPassed = false;
    } else {
      console.log('✅ No failed migrations found');
    }

    // C) Check specific migration status
    console.log(`\n📋 Checking status of ${PURCHASE_STOCK_MIGRATION}...`);
    const migrationStatus = await prisma.$queryRaw<Array<{
      migration_name: string;
      finished_at: Date | null;
      rolled_back_at: Date | null;
      applied_steps_count: number;
      logs: string | null;
    }>>`
      SELECT 
        migration_name, 
        finished_at, 
        rolled_back_at, 
        applied_steps_count, 
        logs
      FROM "_prisma_migrations"
      WHERE migration_name = ${PURCHASE_STOCK_MIGRATION}
      ORDER BY started_at DESC
      LIMIT 1
    `;

    if (migrationStatus.length === 0) {
      console.log(`⚠️  Migration ${PURCHASE_STOCK_MIGRATION} not found in _prisma_migrations`);
      console.log('   → This is OK if it was never applied');
    } else {
      const m = migrationStatus[0];
      console.log(`   - finished_at: ${m.finished_at || 'NULL'}`);
      console.log(`   - rolled_back_at: ${m.rolled_back_at || 'NULL'}`);
      console.log(`   - applied_steps_count: ${m.applied_steps_count}`);
      
      if (m.finished_at) {
        console.log('✅ Migration is marked as applied');
      } else if (m.rolled_back_at) {
        console.log('⚠️  Migration is marked as rolled back');
      } else {
        console.error('❌ Migration is in FAILED state');
        failures.push(`Migration ${PURCHASE_STOCK_MIGRATION} is failed`);
        allChecksPassed = false;
      }
      
      if (m.logs) {
        const logsPreview = m.logs.substring(Math.max(0, m.logs.length - 200));
        console.log(`   - logs (last 200 chars): ${logsPreview}`);
      }
    }

    // D) SQL Real Validations
    console.log('\n🔍 Validating schema changes with SQL...');

    // D1) PurchaseStockApplication table
    console.log('   1. Checking PurchaseStockApplication table...');
    const tableCheck = await prisma.$queryRaw<Array<{ tbl: string | null }>>`
      SELECT to_regclass('public."PurchaseStockApplication"') AS tbl
    `;
    const tableExists = tableCheck[0]?.tbl !== null && tableCheck[0]?.tbl !== '';
    if (!tableExists) {
      console.error('   ❌ PurchaseStockApplication table does NOT exist');
      failures.push('PurchaseStockApplication table missing');
      allChecksPassed = false;
    } else {
      console.log(`   ✅ PurchaseStockApplication table exists (${tableCheck[0]?.tbl})`);
    }

    // D2) PurchaseLine.stockItemId column
    console.log('   2. Checking PurchaseLine.stockItemId column...');
    const columnCheck = await prisma.$queryRaw<Array<{ has_col: boolean }>>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = 'PurchaseLine' 
          AND column_name = 'stockItemId'
      ) AS has_col
    `;
    const hasColumn = (columnCheck[0] as any).has_col === true;
    if (!hasColumn) {
      console.error('   ❌ PurchaseLine.stockItemId column does NOT exist');
      failures.push('PurchaseLine.stockItemId column missing');
      allChecksPassed = false;
    } else {
      console.log('   ✅ PurchaseLine.stockItemId column exists');
    }

    // D3) PurchaseStockApplication indexes
    console.log('   3. Checking PurchaseStockApplication indexes...');
    const indexesCheck = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname 
      FROM pg_indexes
      WHERE schemaname = 'public' 
        AND tablename = 'PurchaseStockApplication'
    `;
    const indexNames = indexesCheck.map((i) => i.indexname);
    if (indexNames.length === 0) {
      console.error('   ❌ No indexes found on PurchaseStockApplication table');
      failures.push('PurchaseStockApplication indexes missing');
      allChecksPassed = false;
    } else {
      console.log(`   ✅ Found ${indexNames.length} index(es): ${indexNames.join(', ')}`);
    }

    // D4) PurchaseStockApplication foreign keys
    console.log('   4. Checking PurchaseStockApplication foreign keys...');
    const fkCheck = await prisma.$queryRaw<Array<{ constraint_name: string }>>`
      SELECT constraint_name 
      FROM information_schema.table_constraints
      WHERE table_schema = 'public' 
        AND table_name = 'PurchaseStockApplication' 
        AND constraint_type = 'FOREIGN KEY'
    `;
    const fkNames = fkCheck.map((f) => f.constraint_name);
    if (fkNames.length === 0) {
      console.error('   ❌ No foreign keys found on PurchaseStockApplication table');
      failures.push('PurchaseStockApplication foreign keys missing');
      allChecksPassed = false;
    } else {
      console.log(`   ✅ Found ${fkNames.length} foreign key(s): ${fkNames.join(', ')}`);
    }

    // Summary
    console.log('\n📊 Verification Summary:');
    console.log('========================');
    
    if (allChecksPassed) {
      console.log('✅ VERIFY PASSED');
      console.log('   → No failed migrations');
      console.log('   → PurchaseStockApplication migration is properly applied');
      console.log('   → All schema changes verified with SQL');
      await prisma.$disconnect();
      process.exit(0);
    } else {
      console.error('❌ VERIFY FAILED');
      console.error('   Failures:');
      failures.forEach((f) => {
        console.error(`   - ${f}`);
      });
      await prisma.$disconnect();
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ VERIFY FAILED: Error during verification');
    console.error('   Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
