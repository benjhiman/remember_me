import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { seedOwnerOnBoot } from './bootstrap/seed-owner-on-boot';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Verify critical environment variables are loaded
  const configService = app.get(ConfigService);
  const jwtSecret = configService.get<string>('JWT_SECRET');
  
  if (!jwtSecret) {
    console.warn('⚠️  WARNING: JWT_SECRET missing: env not loaded correctly');
    console.warn('   Expected .env file at: apps/api/.env');
    console.warn('   Current working directory:', process.cwd());
  } else {
    console.log('✅ Environment variables loaded successfully');
  }

  // Security headers
  app.use(helmet());

  // CORS configuration - Hardened with callback function for robust origin validation
  // ⚠️ PROD SAFETY: Always include production domains in allowed origins
  
  // Normalize origin: trim and remove trailing slash
  function normalizeOrigin(origin: string): string {
    return origin.trim().replace(/\/+$/, '');
  }

  // Build allowlist with hardcoded production domains + env vars
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Hardcoded production origins (always allowed in prod)
  const hardcodedProdOrigins = [
    'https://app.iphonealcosto.com',
    'https://iphonealcosto.com',
    'https://www.iphonealcosto.com',
  ].map(normalizeOrigin);

  // Development origins
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:3001',
  ].map(normalizeOrigin);

  // Parse CORS_ORIGINS from env (comma-separated)
  const envOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(normalizeOrigin).filter(Boolean)
    : [];

  // Build final allowlist
  const allowlist = new Set<string>();
  
  // Always include dev origins
  devOrigins.forEach(origin => allowlist.add(origin));
  
  // In production, always include hardcoded prod origins
  if (isProduction) {
    hardcodedProdOrigins.forEach(origin => allowlist.add(origin));
  }
  
  // Add env origins (normalized)
  envOrigins.forEach(origin => allowlist.add(origin));

  // CORS origin callback function
  const corsOriginCallback = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // A) If origin is undefined (curl/server-to-server) => allow
    if (!origin) {
      callback(null, true);
      return;
    }

    // B) Normalize origin
    const normalizedOrigin = normalizeOrigin(origin);

    // C) Check exact match in allowlist
    if (allowlist.has(normalizedOrigin)) {
      callback(null, true);
      return;
    }

    // D) Allow Vercel previews (*.vercel.app)
    if (normalizedOrigin.match(/^https:\/\/[^/]+\.vercel\.app$/)) {
      callback(null, true);
      return;
    }

    // E) Allow custom preview domains (*.iphonealcosto.com)
    if (normalizedOrigin.match(/^https:\/\/[^/]+\.iphonealcosto\.com$/)) {
      callback(null, true);
      return;
    }

    // F) Origin not allowed
    const error = new Error(`CORS_NOT_ALLOWED:${normalizedOrigin}`);
    console.warn(`[CORS] Blocked origin: ${normalizedOrigin}`);
    callback(error, false);
  };

  app.enableCors({
    origin: corsOriginCallback,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key', 'X-Organization-Id'],
    exposedHeaders: ['X-Request-Id'],
  });

  // Log CORS configuration on startup
  if (isProduction) {
    console.log('[CORS] Production mode - Allowed origins:', Array.from(allowlist).join(', '));
  } else {
    console.log('[CORS] Development mode - Allowed origins:', Array.from(allowlist).join(', '));
  }

  // Global validation pipe (strict)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      disableErrorMessages: process.env.NODE_ENV === 'production',
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // Seed OWNER on boot (si SEED_OWNER_ON_BOOT === 'true')
  const prismaService = app.get(PrismaService);
  await seedOwnerOnBoot(prismaService);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 API server running on: http://localhost:${port}/api`);
}

bootstrap();
