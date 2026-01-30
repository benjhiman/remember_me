import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function inspectMigration() {
  const migrationName = '20250130000000_add_folder_prefix';

  try {
    // Read migration record from _prisma_migrations
    const migration = await prisma.$queryRaw<Array<{
      migration_name: string;
      started_at: Date | null;
      finished_at: Date | null;
      rolled_back_at: Date | null;
      applied_steps_count: number;
      logs: string | null;
    }>>`
      SELECT 
        migration_name,
        started_at,
        finished_at,
        rolled_back_at,
        applied_steps_count,
        logs
      FROM "_prisma_migrations"
      WHERE migration_name = ${migrationName}
      LIMIT 1
    `;

    if (migration.length === 0) {
      console.log(`❌ Migration ${migrationName} not found in _prisma_migrations`);
      return;
    }

    const m = migration[0];
    console.log('\n📋 Migration Status:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Migration Name: ${m.migration_name}`);
    console.log(`Started At: ${m.started_at || 'N/A'}`);
    console.log(`Finished At: ${m.finished_at || 'N/A'}`);
    console.log(`Rolled Back At: ${m.rolled_back_at || 'N/A'}`);
    console.log(`Applied Steps Count: ${m.applied_steps_count}`);
    console.log(`Logs/Error: ${m.logs || 'N/A'}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Check if expected objects exist in DB
    console.log('🔍 Checking Expected Objects:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Check if table exists
    const tableExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'FolderPrefix'
      ) as exists
    `;
    console.log(`✅ Table "FolderPrefix" exists: ${tableExists[0]?.exists || false}`);

    if (tableExists[0]?.exists) {
      // Check columns
      const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'FolderPrefix'
        ORDER BY ordinal_position
      `;
      console.log(`   Columns: ${columns.map((c) => c.column_name).join(', ')}`);

      // Check unique index
      const uniqueIndex = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
          AND tablename = 'FolderPrefix'
          AND indexname = 'FolderPrefix_organizationId_prefix_key'
        ) as exists
      `;
      console.log(`✅ Unique index "FolderPrefix_organizationId_prefix_key" exists: ${uniqueIndex[0]?.exists || false}`);

      // Check regular index
      const regularIndex = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM pg_indexes
          WHERE schemaname = 'public'
          AND tablename = 'FolderPrefix'
          AND indexname = 'FolderPrefix_organizationId_idx'
        ) as exists
      `;
      console.log(`✅ Index "FolderPrefix_organizationId_idx" exists: ${regularIndex[0]?.exists || false}`);

      // Check foreign key constraint
      const fkExists = await prisma.$queryRaw<Array<{ exists: boolean }>>`
        SELECT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints tc
          JOIN information_schema.constraint_column_usage ccu
            ON tc.constraint_name = ccu.constraint_name
          WHERE tc.table_schema = 'public'
          AND tc.table_name = 'FolderPrefix'
          AND tc.constraint_type = 'FOREIGN KEY'
          AND tc.constraint_name = 'FolderPrefix_organizationId_fkey'
        ) as exists
      `;
      console.log(`✅ Foreign key "FolderPrefix_organizationId_fkey" exists: ${fkExists[0]?.exists || false}`);
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Summary and recommendation
    const isApplied = m.finished_at !== null && m.rolled_back_at === null;
    const isRolledBack = m.rolled_back_at !== null;
    const tableExistsBool = tableExists[0]?.exists || false;

    console.log('💡 Recommendation:');
    if (isApplied && tableExistsBool) {
      console.log('   → Migration appears APPLIED. Use: --applied');
    } else if (isRolledBack || (!isApplied && !tableExistsBool)) {
      console.log('   → Migration appears ROLLED-BACK or NOT APPLIED. Use: --rolled-back');
    } else if (!isApplied && tableExistsBool) {
      console.log('   → Migration partially applied. Check manually and use: --applied (if complete) or --rolled-back (if incomplete)');
    } else {
      console.log('   → Status unclear. Review logs above.');
    }
    console.log('');

  } catch (error) {
    console.error('❌ Error inspecting migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

inspectMigration()
  .then(() => {
    console.log('✅ Inspection complete');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Inspection failed:', error);
    process.exit(1);
  });
