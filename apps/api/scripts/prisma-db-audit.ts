/**
 * Prisma Database Audit Script
 * 
 * Audits the database state to detect missing tables, empty databases,
 * and migration status.
 * 
 * Usage: ts-node -r tsconfig-paths/register scripts/prisma-db-audit.ts
 */

import { PrismaClient } from '@prisma/client';
import * as url from 'url';

const CORE_TABLES = [
  'Organization',
  'User',
  'Purchase',
  'PurchaseLine',
  'Customer',
  'Vendor',
  'Membership',
  'Lead',
  'StockItem',
  'Sale',
];

interface AuditResult {
  coreTablesMissing: string[];
  hasOrganizationTable: boolean;
  organizationCount: number | null;
  migrations: Array<{
    migration_name: string;
    started_at: Date | null;
    finished_at: Date | null;
    rolled_back_at: Date | null;
    applied_steps_count: number;
  }>;
  allTables: string[];
  isDatabaseEmpty: boolean;
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

async function main() {
  console.log('🔍 Prisma Database Audit');
  console.log('=========================\n');

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable is not set');
    process.exit(1);
  }

  const redactedUrl = redactDatabaseUrl(process.env.DATABASE_URL);
  console.log(`📡 Database: ${redactedUrl}\n`);

  const prisma = new PrismaClient();

  try {
    // 1. List all tables
    console.log('📋 Listing all tables...');
    const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `;

    const allTables = tables.map((t) => t.tablename);
    console.log(`   → Found ${allTables.length} tables`);
    if (allTables.length > 0) {
      console.log(`   → Tables: ${allTables.join(', ')}`);
    }

    // 2. Check core tables
    console.log('\n🔍 Checking core tables...');
    const coreTablesMissing: string[] = [];
    for (const table of CORE_TABLES) {
      const exists = allTables.includes(table);
      if (!exists) {
        coreTablesMissing.push(table);
        console.log(`   ❌ Missing: ${table}`);
      } else {
        console.log(`   ✅ Exists: ${table}`);
      }
    }

    // 3. Check Organization table and count
    const hasOrganizationTable = allTables.includes('Organization');
    let organizationCount: number | null = null;

    if (hasOrganizationTable) {
      try {
        const countResult = await prisma.$queryRaw<Array<{ count: bigint }>>`
          SELECT COUNT(*)::int as count FROM "Organization"
        `;
        organizationCount = Number(countResult[0]?.count || 0);
        console.log(`\n📊 Organization count: ${organizationCount}`);
      } catch (error) {
        console.log(`\n⚠️  Could not count organizations: ${error}`);
      }
    } else {
      console.log('\n⚠️  Organization table does not exist');
    }

    // 4. Check migrations
    console.log('\n📜 Checking migration status...');
    const migrations = await prisma.$queryRaw<Array<{
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
      ORDER BY started_at
    `;

    console.log(`   → Found ${migrations.length} migration records`);
    
    const failedMigrations = migrations.filter(
      (m) => m.finished_at === null && m.rolled_back_at === null && m.started_at !== null
    );
    
    if (failedMigrations.length > 0) {
      console.log(`   ⚠️  ${failedMigrations.length} failed migration(s):`);
      failedMigrations.forEach((m) => {
        console.log(`      - ${m.migration_name} (steps: ${m.applied_steps_count})`);
      });
    } else {
      console.log('   ✅ No failed migrations');
    }

    // 5. Determine if database is empty
    const isDatabaseEmpty = 
      !hasOrganizationTable || 
      (hasOrganizationTable && organizationCount === 0) ||
      (coreTablesMissing.length > 0 && !hasOrganizationTable);

    console.log('\n📊 Audit Summary:');
    console.log('==================');
    console.log(JSON.stringify({
      coreTablesMissing,
      hasOrganizationTable,
      organizationCount,
      migrations: migrations.map((m) => ({
        migration_name: m.migration_name,
        started_at: m.started_at?.toISOString() || null,
        finished_at: m.finished_at?.toISOString() || null,
        rolled_back_at: m.rolled_back_at?.toISOString() || null,
        applied_steps_count: m.applied_steps_count,
      })),
      allTables,
      isDatabaseEmpty,
    }, null, 2));

    if (isDatabaseEmpty) {
      console.log('\n⚠️  EMPTY DATABASE DETECTED');
      console.log('   → Safe to rebuild with db push --accept-data-loss');
    } else {
      console.log('\n✅ Database has data');
      console.log('   → Use normal migration flow');
    }

    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Audit failed:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

main();
