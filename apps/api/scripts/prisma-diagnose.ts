/**
 * Prisma Migration Diagnosis Script
 * 
 * Diagnoses the state of a failed Prisma migration.
 * Useful for manual inspection before running recovery.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/prisma-diagnose.ts
 */

import { PrismaClient } from '@prisma/client';

const TARGET_MIGRATION = '20250124120000_add_accounting_lite_models';

async function main() {
  console.log('🔍 Prisma Migration Diagnosis');
  console.log('==============================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const prisma = new PrismaClient();

  try {
    // Check migration status
    console.log(`📋 Migration Status: ${TARGET_MIGRATION}`);
    const migration = await prisma.$queryRaw<Array<{
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

    if (migration.length === 0) {
      console.log('   → Migration not found in _prisma_migrations');
    } else {
      const m = migration[0];
      console.log(`   → Started at: ${m.started_at || 'N/A'}`);
      console.log(`   → Finished at: ${m.finished_at || 'N/A'}`);
      console.log(`   → Applied steps: ${m.applied_steps_count}`);
      console.log(`   → Status: ${m.finished_at ? 'APPLIED' : m.applied_steps_count > 0 ? 'FAILED' : 'ROLLED_BACK'}`);
      if (m.logs) {
        console.log(`   → Logs:\n${m.logs}`);
      }
    }

    // Check database state
    console.log('\n📊 Database State:');
    
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

    const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel
      FROM pg_enum e
      JOIN pg_type t ON t.oid = e.enumtypid
      WHERE t.typname = 'AuditEntityType'
      ORDER BY enumlabel
    `;

    console.log(`   → LedgerAccount table: ${(ledgerAccount[0] as any).exists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   → LedgerCategory table: ${(ledgerCategory[0] as any).exists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   → CustomerBalanceSnapshot table: ${(customerBalance[0] as any).exists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   → Purchase.currency column: ${(currencyCol[0] as any).exists ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   → Purchase.referenceNumber column: ${(refNumCol[0] as any).exists ? '✅ EXISTS' : '❌ MISSING'}`);
    
    const enumLabels = enumValues.map((v) => v.enumlabel);
    console.log(`   → AuditEntityType.LedgerAccount: ${enumLabels.includes('LedgerAccount') ? '✅ EXISTS' : '❌ MISSING'}`);
    console.log(`   → AuditEntityType.LedgerCategory: ${enumLabels.includes('LedgerCategory') ? '✅ EXISTS' : '❌ MISSING'}`);

    console.log('\n✅ Diagnosis completed');
    await prisma.$disconnect();
  } catch (error) {
    console.error('\n❌ Diagnosis failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
