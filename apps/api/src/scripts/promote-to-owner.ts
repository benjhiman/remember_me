/**
 * Script to promote a user to OWNER role
 * 
 * Usage:
 * EMAIL_TO_PROMOTE=user@example.com pnpm --filter @remember-me/api promote:owner
 * 
 * This script:
 * - Finds the user by email
 * - Updates all their memberships to OWNER role
 * - Logs the result
 */

import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const email = process.env.EMAIL_TO_PROMOTE;

  if (!email) {
    console.error('❌ ERROR: EMAIL_TO_PROMOTE environment variable is required');
    console.error('Usage: EMAIL_TO_PROMOTE=user@example.com pnpm --filter @remember-me/api promote:owner');
    process.exit(1);
  }

  console.log(`🔍 Looking for user with email: ${email}`);

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    include: {
      memberships: {
        include: {
          organization: {
            select: {
              id: true,
              name: true,
              slug: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    console.error(`❌ ERROR: User with email ${email} not found`);
    process.exit(1);
  }

  console.log(`✅ Found user: ${user.name || user.email} (ID: ${user.id})`);
  console.log(`📊 Current memberships: ${user.memberships.length}`);

  if (user.memberships.length === 0) {
    console.error(`❌ ERROR: User has no memberships. Cannot promote to OWNER.`);
    process.exit(1);
  }

  // Update all memberships to OWNER
  const updatePromises = user.memberships.map(async (membership) => {
    const updated = await prisma.membership.update({
      where: { id: membership.id },
      data: { role: Role.OWNER },
    });

    console.log(
      `  ✅ Updated membership in organization "${membership.organization.name}" (${membership.organization.slug}) from ${membership.role} to OWNER`
    );

    return updated;
  });

  await Promise.all(updatePromises);

  console.log(`\n🎉 Success! User ${email} has been promoted to OWNER in all organizations.`);
  console.log(`\n⚠️  IMPORTANT: The user needs to log out and log back in for the changes to take effect.`);
  console.log(`   (The JWT token contains the old role and needs to be refreshed)`);
}

main()
  .catch((error) => {
    console.error('❌ Error promoting user:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
