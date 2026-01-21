/**
 * Bootstrap helper para crear usuario OWNER automáticamente al boot del API.
 * 
 * Solo se ejecuta si SEED_OWNER_ON_BOOT === 'true'
 * 
 * Requiere variables de entorno:
 * - OWNER_EMAIL
 * - OWNER_PASSWORD (mínimo 8 caracteres)
 * - OWNER_ORG_NAME
 * - OWNER_ORG_SLUG
 * 
 * Completamente idempotente: no duplica datos si ya existen.
 */

import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

export async function seedOwnerOnBoot(prisma: PrismaService): Promise<void> {
  // Solo correr si la env var está en 'true'
  if (process.env.SEED_OWNER_ON_BOOT !== 'true') {
    return;
  }

  // Leer variables de entorno
  const OWNER_EMAIL = process.env.OWNER_EMAIL;
  const OWNER_PASSWORD = process.env.OWNER_PASSWORD;
  const OWNER_ORG_NAME = process.env.OWNER_ORG_NAME;
  const OWNER_ORG_SLUG = process.env.OWNER_ORG_SLUG;

  // Validación básica
  if (!OWNER_EMAIL || !OWNER_PASSWORD || !OWNER_ORG_NAME || !OWNER_ORG_SLUG) {
    console.warn('[SEED] ⚠️  Variables de entorno faltantes. Seed omitido.');
    console.warn('[SEED]    Requeridas: OWNER_EMAIL, OWNER_PASSWORD, OWNER_ORG_NAME, OWNER_ORG_SLUG');
    return;
  }

  if (OWNER_PASSWORD.length < 8) {
    console.warn('[SEED] ⚠️  OWNER_PASSWORD debe tener al menos 8 caracteres. Seed omitido.');
    return;
  }

  try {
    console.log('[SEED] 🚀 Iniciando seed de OWNER al boot...');
    console.log(`[SEED]    Email: ${OWNER_EMAIL}`);
    console.log(`[SEED]    Org: ${OWNER_ORG_NAME} (${OWNER_ORG_SLUG})`);

    // 1. Upsert User
    let user;
    const existingUser = await prisma.user.findUnique({
      where: { email: OWNER_EMAIL },
    });

    if (existingUser) {
      console.log(`[SEED]    Usuario ya existe: ${existingUser.id}`);
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
      console.log(`[SEED]    Usuario creado: ${user.id}`);
    }
    console.log('[SEED] ✅ user ok');

    // 2. Upsert Organization
    let organization;
    const existingOrg = await prisma.organization.findUnique({
      where: { slug: OWNER_ORG_SLUG },
    });

    if (existingOrg) {
      console.log(`[SEED]    Organización ya existe: ${existingOrg.id}`);
      organization = existingOrg;
    } else {
      organization = await prisma.organization.create({
        data: {
          name: OWNER_ORG_NAME,
          slug: OWNER_ORG_SLUG,
        },
      });
      console.log(`[SEED]    Organización creada: ${organization.id}`);
    }
    console.log('[SEED] ✅ org ok');

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
        await prisma.membership.update({
          where: { id: existingMembership.id },
          data: { role: Role.OWNER },
        });
        console.log(`[SEED]    Membership actualizado a OWNER: ${existingMembership.id}`);
      } else {
        console.log(`[SEED]    Membership ya existe como OWNER: ${existingMembership.id}`);
      }
    } else {
      const membership = await prisma.membership.create({
        data: {
          userId: user.id,
          organizationId: organization.id,
          role: Role.OWNER,
        },
      });
      console.log(`[SEED]    Membership creado como OWNER: ${membership.id}`);
    }
    console.log('[SEED] ✅ membership ok');

    console.log('[SEED] ✅ Seed completado exitosamente');
    console.log(`[SEED]    User ID: ${user.id}`);
    console.log(`[SEED]    Organization ID: ${organization.id}`);
    console.log(`[SEED]    Role: OWNER`);
  } catch (error) {
    // NO romper el arranque si hay error
    console.error('[SEED] ❌ Error durante seed (no bloquea arranque):', error);
    if (error instanceof Error) {
      console.error('[SEED]    Mensaje:', error.message);
    }
    // No lanzar el error, solo loguearlo
  }
}
