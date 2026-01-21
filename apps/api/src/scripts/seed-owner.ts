#!/usr/bin/env node

/**
 * Script idempotente para crear un OWNER en producción (Railway) directamente en la DB vía Prisma.
 *
 * Uso:
 *   export OWNER_EMAIL=admin@example.com
 *   export OWNER_PASSWORD=SecurePass123!
 *   export OWNER_ORG_NAME="Mi Organización"
 *   export OWNER_ORG_SLUG=mi-organizacion
 *   pnpm --filter @remember-me/api seed:owner
 *
 * O en Railway:
 *   Railway CLI: railway run pnpm --filter @remember-me/api seed:owner
 *   O configurar env vars en Railway dashboard y ejecutar el comando
 */

import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

// Leer variables de entorno con defaults seguros
const OWNER_EMAIL = process.env.OWNER_EMAIL || 'admin@example.com';
const OWNER_PASSWORD = process.env.OWNER_PASSWORD || '';
const OWNER_ORG_NAME = process.env.OWNER_ORG_NAME || 'Default Organization';
const OWNER_ORG_SLUG = process.env.OWNER_ORG_SLUG || 'default-org';

// Validación básica
if (!OWNER_PASSWORD || OWNER_PASSWORD.length < 8) {
  console.error('❌ Error: OWNER_PASSWORD debe tener al menos 8 caracteres');
  console.error('   Por favor, configura OWNER_PASSWORD como variable de entorno');
  process.exit(1);
}

async function seedOwner() {
  try {
    console.log('🚀 Iniciando seed de OWNER...');
    console.log(`   Email: ${OWNER_EMAIL}`);
    console.log(`   Org: ${OWNER_ORG_NAME} (${OWNER_ORG_SLUG})`);

    // 1. Upsert User
    let user;
    const existingUser = await prisma.user.findUnique({
      where: { email: OWNER_EMAIL },
    });

    if (existingUser) {
      console.log(`   ✓ Usuario ya existe: ${existingUser.id}`);
      
      // Actualizar password si es necesario (opcional, comentado por seguridad)
      // const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);
      // user = await prisma.user.update({
      //   where: { id: existingUser.id },
      //   data: { passwordHash },
      // });
      // console.log(`   ✓ Password actualizado`);
      
      user = existingUser;
    } else {
      const passwordHash = await bcrypt.hash(OWNER_PASSWORD, 12);
      user = await prisma.user.create({
        data: {
          email: OWNER_EMAIL,
          passwordHash,
          name: OWNER_EMAIL.split('@')[0], // Nombre por defecto desde email
          emailVerified: true, // Asumimos verificado para OWNER
        },
      });
      console.log(`   ✓ Usuario creado: ${user.id}`);
    }

    // 2. Upsert Organization
    let organization;
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: OWNER_ORG_SLUG },
    });

    if (existingOrg) {
      console.log(`   ✓ Organización ya existe: ${existingOrg.id}`);
      organization = existingOrg;
    } else {
      organization = await prisma.organization.create({
        data: {
          name: OWNER_ORG_NAME,
          slug: OWNER_ORG_SLUG,
        },
      });
      console.log(`   ✓ Organización creada: ${organization.id}`);
    }

    // 3. Upsert Membership (OWNER role)
    const existingMembership = await prisma.membership.findUnique({
      where: {
        userId_organizationId: {
          userId: user.id,
          organizationId: organization.id,
        },
      },
    });

    if (existingMembership) {
      if (existingMembership.role !== Role.OWNER) {
        // Actualizar role a OWNER si no lo es
        const updated = await prisma.membership.update({
          where: { id: existingMembership.id },
          data: { role: Role.OWNER },
        });
        console.log(`   ✓ Membership actualizado a OWNER: ${updated.id}`);
      } else {
        console.log(`   ✓ Membership ya existe como OWNER: ${existingMembership.id}`);
      }
    } else {
      const membership = await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.OWNER,
        },
      });
      console.log(`   ✓ Membership creado como OWNER: ${membership.id}`);
    }

    // Resumen final
    console.log('\n✅ Seed completado exitosamente:');
    console.log(`   User ID: ${user.id}`);
    console.log(`   User Email: ${user.email}`);
    console.log(`   Organization ID: ${organization.id}`);
    console.log(`   Organization Slug: ${organization.slug}`);
    console.log(`   Role: OWNER\n`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Error durante seed:', error);
    if (error instanceof Error) {
      console.error('   Mensaje:', error.message);
      if (error.stack) {
        console.error('   Stack:', error.stack);
      }
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar
seedOwner();
