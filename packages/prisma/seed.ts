import { PrismaClient, Role, SaleStatus, ReservationStatus, StockMovementType, RuleType, ScopeType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // Get all organizations
  const organizations = await prisma.organization.findMany();

  for (const org of organizations) {
    // Check if default pipeline already exists
    const existingPipeline = await prisma.pipeline.findFirst({
      where: {
        organizationId: org.id,
        isDefault: true,
      },
    });

    if (existingPipeline) {
      console.log(`⏭️  Default pipeline already exists for organization ${org.name}`);
      continue;
    }

    // Create default pipeline
    const pipeline = await prisma.pipeline.create({
      data: {
        organizationId: org.id,
        name: 'Default',
        color: '#6366f1',
        order: 0,
        isDefault: true,
      },
    });

    console.log(`✅ Created default pipeline for organization ${org.name}`);

    // Create default stages
    const stages = [
      { name: 'New', order: 0, color: '#94a3b8' },
      { name: 'Contacted', order: 1, color: '#3b82f6' },
      { name: 'Won', order: 2, color: '#10b981' },
      { name: 'Lost', order: 3, color: '#ef4444' },
    ];

    for (const stage of stages) {
      await prisma.stage.create({
        data: {
          pipelineId: pipeline.id,
          name: stage.name,
          order: stage.order,
          color: stage.color,
        },
      });
    }

    console.log(`✅ Created default stages for organization ${org.name}`);
  }

  // Seed stock items demo
  for (const org of organizations) {
    // Check if stock items already exist for this org
    const existingItems = await prisma.stockItem.findFirst({
      where: { organizationId: org.id },
    });

    if (existingItems) {
      console.log(`⏭️  Stock items already exist for organization ${org.name}`);
      continue;
    }

    // Create demo stock items
    const stockItems = [
      // New items (sealed, without IMEI, quantity > 1)
      {
        model: 'iPhone 15 Pro 256GB',
        storage: '256GB',
        color: 'Natural Titanium',
        condition: 'NEW' as const,
        quantity: 5,
        costPrice: 900,
        basePrice: 1200,
        location: 'Almacén Principal',
      },
      {
        model: 'iPhone 14 128GB',
        storage: '128GB',
        color: 'Midnight',
        condition: 'NEW' as const,
        quantity: 10,
        costPrice: 700,
        basePrice: 950,
        location: 'Almacén Principal',
      },
      // Used items (with IMEI, quantity = 1)
      {
        model: 'iPhone 15 Pro 256GB',
        storage: '256GB',
        color: 'Blue Titanium',
        condition: 'USED' as const,
        imei: '123456789012345',
        quantity: 1,
        costPrice: 800,
        basePrice: 1100,
        location: 'Almacén Usados',
        notes: 'Buen estado, caja original',
      },
      {
        model: 'iPhone 14 Pro 256GB',
        storage: '256GB',
        color: 'Deep Purple',
        condition: 'USED' as const,
        imei: '123456789012346',
        quantity: 1,
        costPrice: 750,
        basePrice: 1000,
        location: 'Almacén Usados',
        notes: 'Excelente estado',
      },
      {
        model: 'iPhone 13 128GB',
        storage: '128GB',
        color: 'Pink',
        condition: 'REFURBISHED' as const,
        imei: '123456789012347',
        quantity: 1,
        costPrice: 600,
        basePrice: 850,
        location: 'Almacén Refurbished',
        notes: 'Reacondicionado, garantía 90 días',
      },
    ];

    for (const item of stockItems) {
      await prisma.stockItem.create({
        data: {
          organizationId: org.id,
          model: item.model,
          storage: item.storage,
          color: item.color,
          condition: item.condition,
          imei: item.imei,
          quantity: item.quantity,
          costPrice: item.costPrice,
          basePrice: item.basePrice,
          location: item.location,
          notes: item.notes,
        },
      });
    }

    console.log(`✅ Created ${stockItems.length} demo stock items for organization ${org.name}`);
  }

  // Seed demo sales
  for (const org of organizations) {
    // Get owner user for this org
    const owner = await prisma.user.findFirst({
      where: {
        memberships: {
          some: {
            organizationId: org.id,
            role: 'OWNER',
          },
        },
      },
    });

    if (!owner) {
      console.log(`⏭️  No owner found for organization ${org.name}, skipping sales seed`);
      continue;
    }

    // Get stock items for this org
    const stockItems = await prisma.stockItem.findMany({
      where: { organizationId: org.id },
      take: 3,
    });

    if (stockItems.length < 2) {
      console.log(`⏭️  Not enough stock items for organization ${org.name}, skipping sales seed`);
      continue;
    }

    // Check if sales already exist
    const existingSales = await prisma.sale.findFirst({
      where: { organizationId: org.id },
    });

    if (existingSales) {
      console.log(`⏭️  Sales already exist for organization ${org.name}`);
      continue;
    }

    // Sale 1: RESERVED with ACTIVE reservations
    const reservation1 = await prisma.stockReservation.create({
      data: {
        organizationId: org.id,
        stockItemId: stockItems[0].id,
        quantity: 1,
        status: ReservationStatus.ACTIVE,
        createdById: owner.id,
        notes: 'Demo reservation for sale 1',
      },
    });

    const reservation2 = await prisma.stockReservation.create({
      data: {
        organizationId: org.id,
        stockItemId: stockItems[1].id,
        quantity: 2,
        status: ReservationStatus.ACTIVE,
        createdById: owner.id,
        notes: 'Demo reservation for sale 1',
      },
    });

    const sale1Subtotal =
      parseFloat(stockItems[0].basePrice.toString()) * 1 + parseFloat(stockItems[1].basePrice.toString()) * 2;
    const sale1Total = sale1Subtotal;

    const sale1 = await prisma.sale.create({
      data: {
        organizationId: org.id,
        createdById: owner.id,
        assignedToId: owner.id,
        saleNumber: `SALE-${new Date().getFullYear()}-001`,
        status: SaleStatus.RESERVED,
        customerName: 'John Doe',
        customerEmail: 'john@example.com',
        customerPhone: '+1234567890',
        subtotal: sale1Subtotal,
        discount: 0,
        total: sale1Total,
        currency: 'USD',
        reservedAt: new Date(),
        notes: 'Demo sale - RESERVED status',
        items: {
          create: [
            {
              stockItemId: stockItems[0].id,
              model: stockItems[0].model,
              quantity: 1,
              unitPrice: stockItems[0].basePrice,
              totalPrice: stockItems[0].basePrice,
            },
            {
              stockItemId: stockItems[1].id,
              model: stockItems[1].model,
              quantity: 2,
              unitPrice: stockItems[1].basePrice,
              totalPrice: parseFloat(stockItems[1].basePrice.toString()) * 2,
            },
          ],
        },
      },
    });

    // Link reservations to sale 1
    await prisma.stockReservation.updateMany({
      where: {
        id: { in: [reservation1.id, reservation2.id] },
      },
      data: {
        saleId: sale1.id,
      },
    });

    console.log(`✅ Created sale 1 (RESERVED) for organization ${org.name}`);

    // Sale 2: PAID with CONFIRMED reservations (stock already deducted)
    const reservation3 = await prisma.stockReservation.create({
      data: {
        organizationId: org.id,
        stockItemId: stockItems[0].id,
        quantity: 1,
        status: ReservationStatus.CONFIRMED,
        createdById: owner.id,
        notes: 'Demo reservation for sale 2 (confirmed)',
      },
    });

    // Deduct stock for confirmed reservation
    await prisma.stockItem.update({
      where: { id: stockItems[0].id },
      data: {
        quantity: stockItems[0].quantity - 1,
      },
    });

    // Create movement for confirmed reservation
    await prisma.stockMovement.create({
      data: {
        organizationId: org.id,
        stockItemId: stockItems[0].id,
        type: StockMovementType.SOLD,
        quantity: 1,
        quantityBefore: stockItems[0].quantity,
        quantityAfter: stockItems[0].quantity - 1,
        reason: 'Sale 2 - confirmed reservation',
        reservationId: reservation3.id,
        createdById: owner.id,
      },
    });

    const sale2Subtotal = parseFloat(stockItems[0].basePrice.toString()) * 1;
    const sale2Total = sale2Subtotal;

    const sale2 = await prisma.sale.create({
      data: {
        organizationId: org.id,
        createdById: owner.id,
        assignedToId: owner.id,
        saleNumber: `SALE-${new Date().getFullYear()}-002`,
        status: SaleStatus.PAID,
        customerName: 'Jane Smith',
        customerEmail: 'jane@example.com',
        customerPhone: '+0987654321',
        subtotal: sale2Subtotal,
        discount: 0,
        total: sale2Total,
        currency: 'USD',
        reservedAt: new Date(),
        paidAt: new Date(),
        notes: 'Demo sale - PAID status',
        items: {
          create: [
            {
              stockItemId: stockItems[0].id,
              model: stockItems[0].model,
              quantity: 1,
              unitPrice: stockItems[0].basePrice,
              totalPrice: stockItems[0].basePrice,
            },
          ],
        },
      },
    });

    // Link reservation to sale 2
    await prisma.stockReservation.update({
      where: { id: reservation3.id },
      data: {
        saleId: sale2.id,
      },
    });

    console.log(`✅ Created sale 2 (PAID) for organization ${org.name}`);
  }

  // Seed demo pricing rules
  for (const org of organizations) {
    // Check if pricing rules already exist
    const existingRules = await prisma.pricingRule.findFirst({
      where: { organizationId: org.id },
    });

    if (existingRules) {
      console.log(`⏭️  Pricing rules already exist for organization ${org.name}`);
      continue;
    }

    // Rule 1: GLOBAL markup percent (20%)
    await prisma.pricingRule.create({
      data: {
        organizationId: org.id,
        name: 'Global 20% Markup',
        priority: 10,
        isActive: true,
        ruleType: RuleType.MARKUP_PERCENT,
        scopeType: ScopeType.GLOBAL,
        matchers: {},
        value: 20,
        currency: 'USD',
      },
    });

    // Rule 2: BY_PRODUCT override for iPhone 15 Pro
    await prisma.pricingRule.create({
      data: {
        organizationId: org.id,
        name: 'iPhone 15 Pro Override',
        priority: 50, // Higher priority
        isActive: true,
        ruleType: RuleType.OVERRIDE_PRICE,
        scopeType: ScopeType.BY_PRODUCT,
        matchers: {
          model: 'iPhone 15 Pro 256GB',
        },
        value: 1500,
        currency: 'USD',
      },
    });

    // Rule 3: BY_CONDITION markup fixed for USED items
    await prisma.pricingRule.create({
      data: {
        organizationId: org.id,
        name: 'Used Items Fixed Markup',
        priority: 30,
        isActive: true,
        ruleType: RuleType.MARKUP_FIXED,
        scopeType: ScopeType.BY_CONDITION,
        matchers: {
          condition: 'USED',
        },
        value: 50,
        currency: 'USD',
      },
    });

    console.log(`✅ Created 3 demo pricing rules for organization ${org.name}`);
  }

  // Seed demo data for dashboard
  for (const org of organizations) {
    // Get owner user for this org
    const owner = await prisma.user.findFirst({
      where: {
        memberships: {
          some: {
            organizationId: org.id,
            role: 'OWNER',
          },
        },
      },
    });

    if (!owner) {
      console.log(`⏭️  No owner found for organization ${org.name}, skipping dashboard seed`);
      continue;
    }

    // Get default pipeline and stages
    const pipeline = await prisma.pipeline.findFirst({
      where: {
        organizationId: org.id,
        isDefault: true,
      },
      include: {
        stages: {
          orderBy: {
            order: 'asc',
          },
        },
      },
    });

    if (!pipeline || pipeline.stages.length === 0) {
      console.log(`⏭️  No pipeline/stages found for organization ${org.name}, skipping dashboard seed`);
      continue;
    }

    // Check if dashboard data already exists
    const existingLeads = await prisma.lead.count({
      where: { organizationId: org.id },
    });

    if (existingLeads > 20) {
      console.log(`⏭️  Dashboard data already exists for organization ${org.name} (${existingLeads} leads)`);
      continue;
    }

    // Create demo leads (15 leads)
    const stageIds = pipeline.stages.map((s) => s.id);
    const demoLeads = [
      { name: 'John Doe', email: 'john@example.com', stageId: stageIds[0] },
      { name: 'Jane Smith', email: 'jane@example.com', stageId: stageIds[0] },
      { name: 'Bob Johnson', email: 'bob@example.com', stageId: stageIds[1] },
      { name: 'Alice Williams', email: 'alice@example.com', stageId: stageIds[1] },
      { name: 'Charlie Brown', email: 'charlie@example.com', stageId: stageIds[1] },
      { name: 'Diana Prince', email: 'diana@example.com', stageId: stageIds[2] },
      { name: 'Eve Davis', email: 'eve@example.com', stageId: stageIds[2] },
      { name: 'Frank Miller', email: 'frank@example.com', stageId: stageIds[2] },
      { name: 'Grace Lee', email: 'grace@example.com', stageId: stageIds[3] },
      { name: 'Henry Wilson', email: 'henry@example.com', stageId: stageIds[3] },
      { name: 'Ivy Martinez', email: 'ivy@example.com', stageId: stageIds[0] },
      { name: 'Jack Taylor', email: 'jack@example.com', stageId: stageIds[1] },
      { name: 'Kate Anderson', email: 'kate@example.com', stageId: stageIds[1] },
      { name: 'Liam Thompson', email: 'liam@example.com', stageId: stageIds[2] },
      { name: 'Mia Garcia', email: 'mia@example.com', stageId: stageIds[2] },
    ];

    const leadIds: string[] = [];
    for (const leadData of demoLeads) {
      const lead = await prisma.lead.create({
        data: {
          organizationId: org.id,
          pipelineId: pipeline.id,
          stageId: leadData.stageId,
          createdById: owner.id,
          assignedToId: owner.id,
          name: leadData.name,
          email: leadData.email,
          phone: '+1234567890',
          status: LeadStatus.ACTIVE,
        },
      });
      leadIds.push(lead.id);
    }

    console.log(`✅ Created ${demoLeads.length} demo leads for organization ${org.name}`);

    // Get stock items for creating more sales
    const stockItems = await prisma.stockItem.findMany({
      where: { organizationId: org.id },
      take: 5,
    });

    if (stockItems.length < 2) {
      console.log(`⏭️  Not enough stock items for organization ${org.name}, skipping additional sales seed`);
      continue;
    }

    // Create additional demo sales (12 sales in various states)
    const salesData = [
      { status: SaleStatus.PAID, count: 5 },
      { status: SaleStatus.RESERVED, count: 3 },
      { status: SaleStatus.SHIPPED, count: 2 },
      { status: SaleStatus.DELIVERED, count: 2 },
    ];

    let saleNumber = 3; // Start after seed sales
    for (const saleGroup of salesData) {
      for (let i = 0; i < saleGroup.count; i++) {
        // Create reservation
        const reservation = await prisma.stockReservation.create({
          data: {
            organizationId: org.id,
            stockItemId: stockItems[i % stockItems.length].id,
            quantity: 1,
            status: saleGroup.status === SaleStatus.PAID || saleGroup.status === SaleStatus.SHIPPED || saleGroup.status === SaleStatus.DELIVERED
              ? ReservationStatus.CONFIRMED
              : ReservationStatus.ACTIVE,
            createdById: owner.id,
          },
        });

        const subtotal = parseFloat(stockItems[i % stockItems.length].basePrice.toString());
        const total = subtotal;

        const sale = await prisma.sale.create({
          data: {
            organizationId: org.id,
            createdById: owner.id,
            assignedToId: owner.id,
            saleNumber: `SALE-${new Date().getFullYear()}-${saleNumber.toString().padStart(3, '0')}`,
            status: saleGroup.status,
            customerName: `Customer ${saleNumber}`,
            customerEmail: `customer${saleNumber}@example.com`,
            customerPhone: '+1234567890',
            subtotal,
            discount: 0,
            total,
            currency: 'USD',
            reservedAt: saleGroup.status !== SaleStatus.DRAFT ? new Date() : null,
            paidAt: saleGroup.status === SaleStatus.PAID || saleGroup.status === SaleStatus.SHIPPED || saleGroup.status === SaleStatus.DELIVERED ? new Date() : null,
            shippedAt: saleGroup.status === SaleStatus.SHIPPED || saleGroup.status === SaleStatus.DELIVERED ? new Date() : null,
            deliveredAt: saleGroup.status === SaleStatus.DELIVERED ? new Date() : null,
            items: {
              create: [
                {
                  stockItemId: stockItems[i % stockItems.length].id,
                  model: stockItems[i % stockItems.length].model,
                  quantity: 1,
                  unitPrice: stockItems[i % stockItems.length].basePrice,
                  totalPrice: stockItems[i % stockItems.length].basePrice,
                },
              ],
            },
          },
        });

        await prisma.stockReservation.update({
          where: { id: reservation.id },
          data: { saleId: sale.id },
        });

        saleNumber++;
      }
    }

    console.log(`✅ Created ${salesData.reduce((sum, s) => sum + s.count, 0)} additional demo sales for organization ${org.name}`);

    // Create additional stock movements
    for (let i = 0; i < 10; i++) {
      await prisma.stockMovement.create({
        data: {
          organizationId: org.id,
          stockItemId: stockItems[i % stockItems.length].id,
          type: i % 2 === 0 ? StockMovementType.IN : StockMovementType.OUT,
          quantity: i % 2 === 0 ? 5 : -2,
          quantityBefore: 10,
          quantityAfter: i % 2 === 0 ? 15 : 8,
          reason: `Demo movement ${i + 1}`,
          createdById: owner.id,
        },
      });
    }

    console.log(`✅ Created 10 demo stock movements for organization ${org.name}`);
  }

  console.log('✨ Seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
