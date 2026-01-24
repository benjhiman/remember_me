/**
 * E2E Seed Script
 * 
 * Creates deterministic test data for E2E tests:
 * - Organization "E2E"
 * - User with role OWNER (email/password from env vars)
 * - 1 Vendor
 * - 1 Customer
 * - 1 Lead
 * - 1 Purchase DRAFT
 * 
 * Usage:
 *   E2E_EMAIL=test@example.com E2E_PASSWORD=TestPassword123! pnpm ops:e2e-seed
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const E2E_EMAIL = process.env.E2E_EMAIL || 'e2e@test.com';
const E2E_PASSWORD = process.env.E2E_PASSWORD || 'E2ETestPassword123!';
const E2E_ORG_NAME = 'E2E';

async function main() {
  console.log('🌱 Starting E2E seed...');
  console.log(`Email: ${E2E_EMAIL}`);
  console.log(`Org: ${E2E_ORG_NAME}`);

  // 1. Create or find organization
  let organization = await prisma.organization.findFirst({
    where: { name: E2E_ORG_NAME },
  });

  if (!organization) {
    organization = await prisma.organization.create({
      data: {
        name: E2E_ORG_NAME,
        slug: 'e2e',
      },
    });
    console.log(`✅ Created organization: ${organization.id}`);
  } else {
    console.log(`✅ Found existing organization: ${organization.id}`);
  }

  // 2. Create or find user
  let user = await prisma.user.findUnique({
    where: { email: E2E_EMAIL },
  });

  if (!user) {
    const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);
    user = await prisma.user.create({
      data: {
        email: E2E_EMAIL,
        passwordHash,
        name: 'E2E Test User',
      },
    });
    console.log(`✅ Created user: ${user.id}`);
  } else {
    // Update password in case it changed
    const passwordHash = await bcrypt.hash(E2E_PASSWORD, 10);
    user = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    console.log(`✅ Found existing user, updated password: ${user.id}`);
  }

  // 3. Ensure membership with OWNER role
  let membership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
      organizationId: organization.id,
    },
  });

  if (!membership) {
    membership = await prisma.membership.create({
      data: {
        userId: user.id,
        organizationId: organization.id,
        role: 'OWNER',
      },
    });
    console.log(`✅ Created membership: ${membership.id}`);
  } else if (membership.role !== 'OWNER') {
    membership = await prisma.membership.update({
      where: { id: membership.id },
      data: { role: 'OWNER' },
    });
    console.log(`✅ Updated membership to OWNER: ${membership.id}`);
  } else {
    console.log(`✅ Membership already exists with OWNER role: ${membership.id}`);
  }

  // 4. Create or find vendor
  let vendor = await prisma.vendor.findFirst({
    where: {
      organizationId: organization.id,
      name: 'E2E Test Vendor',
    },
  });

  if (!vendor) {
    vendor = await prisma.vendor.create({
      data: {
        organizationId: organization.id,
        name: 'E2E Test Vendor',
        email: 'vendor@e2e.test',
        phone: '+1234567890',
        status: 'ACTIVE',
        createdById: user.id,
      },
    });
    console.log(`✅ Created vendor: ${vendor.id}`);
  } else {
    console.log(`✅ Found existing vendor: ${vendor.id}`);
  }

  // 5. Create or find customer
  let customer = await prisma.customer.findFirst({
    where: {
      organizationId: organization.id,
      name: 'E2E Test Customer',
    },
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        organizationId: organization.id,
        name: 'E2E Test Customer',
        email: 'customer@e2e.test',
        phone: '+1234567891',
        status: 'ACTIVE',
        createdById: user.id,
      },
    });
    console.log(`✅ Created customer: ${customer.id}`);
  } else {
    console.log(`✅ Found existing customer: ${customer.id}`);
  }

  // 6. Create or find pipeline and stage for lead
  let pipeline = await prisma.pipeline.findFirst({
    where: {
      organizationId: organization.id,
      name: 'E2E Sales Pipeline',
    },
  });

  if (!pipeline) {
    pipeline = await prisma.pipeline.create({
      data: {
        organizationId: organization.id,
        name: 'E2E Sales Pipeline',
        isDefault: true,
      },
    });
    console.log(`✅ Created pipeline: ${pipeline.id}`);
  } else {
    console.log(`✅ Found existing pipeline: ${pipeline.id}`);
  }

  let stage = await prisma.pipelineStage.findFirst({
    where: {
      pipelineId: pipeline.id,
      name: 'Nuevo',
    },
  });

  if (!stage) {
    stage = await prisma.pipelineStage.create({
      data: {
        pipelineId: pipeline.id,
        name: 'Nuevo',
        order: 0,
      },
    });
    console.log(`✅ Created stage: ${stage.id}`);
  } else {
    console.log(`✅ Found existing stage: ${stage.id}`);
  }

  // 7. Create or find lead
  let lead = await prisma.lead.findFirst({
    where: {
      organizationId: organization.id,
      name: 'E2E Test Lead',
    },
  });

  if (!lead) {
    lead = await prisma.lead.create({
      data: {
        organizationId: organization.id,
        pipelineId: pipeline.id,
        stageId: stage.id,
        name: 'E2E Test Lead',
        email: 'lead@e2e.test',
        phone: '+1234567892',
        source: 'E2E',
        assignedToId: user.id,
      },
    });
    console.log(`✅ Created lead: ${lead.id}`);
  } else {
    console.log(`✅ Found existing lead: ${lead.id}`);
  }

  // 8. Create or find purchase DRAFT
  let purchase = await prisma.purchase.findFirst({
    where: {
      organizationId: organization.id,
      status: 'DRAFT',
    },
    include: {
      lines: true,
    },
  });

  if (!purchase) {
    purchase = await prisma.purchase.create({
      data: {
        organizationId: organization.id,
        vendorId: vendor.id,
        createdById: user.id,
        status: 'DRAFT',
        notes: 'E2E Test Purchase',
        subtotalCents: 10000, // $100.00
        taxCents: 0,
        totalCents: 10000,
        lines: {
          create: {
            description: 'E2E Test Item',
            quantity: 1,
            unitPriceCents: 10000,
            lineTotalCents: 10000,
          },
        },
      },
      include: {
        lines: true,
      },
    });
    console.log(`✅ Created purchase: ${purchase.id}`);
  } else {
    console.log(`✅ Found existing purchase: ${purchase.id}`);
  }

  console.log('\n✅ E2E seed completed successfully!');
  console.log(`\nCredentials:`);
  console.log(`  Email: ${E2E_EMAIL}`);
  console.log(`  Password: ${E2E_PASSWORD}`);
  console.log(`  Organization: ${organization.name} (${organization.id})`);
}

main()
  .catch((e) => {
    console.error('❌ Error seeding E2E data:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
