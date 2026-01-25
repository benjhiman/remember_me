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

  // CORS configuration - Hard-fix: Simple, deterministic, bulletproof
  // ⚠️ PROD SAFETY: https://app.iphonealcosto.com is ALWAYS allowed, no exceptions
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  // Normalize origin: trim and remove trailing slash
  function normalizeOrigin(origin: string): string {
    return origin.trim().replace(/\/+$/, '');
  }

  // CORS logging middleware (before CORS middleware)
  app.use((req: any, res: any, next: any) => {
    const originRaw = req.headers.origin;
    if (originRaw && isProduction) {
      const originNormalized = normalizeOrigin(originRaw);
      const requestId = req.headers['x-request-id'] || null;
      const path = req.path || req.url;
      
      // Determine if it will be allowed (same logic as callback)
      let allowed = false;
      let reason = '';
      
      if (originNormalized === 'https://app.iphonealcosto.com') {
        allowed = true;
        reason = 'exact_match_app_iphonealcosto';
      } else if (originNormalized === 'https://iphonealcosto.com' || originNormalized === 'https://www.iphonealcosto.com') {
        allowed = true;
        reason = 'exact_match_main_domains';
      } else if (originNormalized.endsWith('.vercel.app')) {
        allowed = true;
        reason = 'vercel_preview';
      } else if (originNormalized.endsWith('.iphonealcosto.com')) {
        allowed = true;
        reason = 'iphonealcosto_subdomain';
      } else if (originNormalized.startsWith('http://localhost:') || originNormalized.startsWith('http://127.0.0.1:')) {
        allowed = true;
        reason = 'localhost_dev';
      } else {
        allowed = false;
        reason = 'not_allowed';
      }
      
      console.log('[CORS]', JSON.stringify({
        originRaw,
        originNormalized,
        allowed,
        reason,
        path,
        requestId,
      }));
    }
    next();
  });

  // CORS origin callback function - SIMPLE AND DETERMINISTIC
  const corsOriginCallback = (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // A) If origin is undefined (curl/server-to-server) => allow
    if (!origin) {
      callback(null, true);
      return;
    }

    // B) Normalize origin
    const normalizedOrigin = normalizeOrigin(origin);

    // C) HARD-FIX: https://app.iphonealcosto.com is ALWAYS allowed (exact match)
    if (normalizedOrigin === 'https://app.iphonealcosto.com') {
      callback(null, true);
      return;
    }

    // D) Main domains
    if (normalizedOrigin === 'https://iphonealcosto.com' || normalizedOrigin === 'https://www.iphonealcosto.com') {
      callback(null, true);
      return;
    }

    // E) Development origins
    if (normalizedOrigin.startsWith('http://localhost:') || normalizedOrigin.startsWith('http://127.0.0.1:')) {
      callback(null, true);
      return;
    }

    // F) Vercel previews (*.vercel.app)
    if (normalizedOrigin.endsWith('.vercel.app')) {
      callback(null, true);
      return;
    }

    // G) Custom preview domains (*.iphonealcosto.com)
    if (normalizedOrigin.endsWith('.iphonealcosto.com')) {
      callback(null, true);
      return;
    }

    // H) Origin not allowed
    const error = new Error(`CORS_NOT_ALLOWED:${normalizedOrigin}`);
    if (isProduction) {
      console.warn(`[CORS] ❌ Blocked origin: ${normalizedOrigin}`);
    }
    callback(error, false);
  };

  app.enableCors({
    origin: corsOriginCallback,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key', 'X-Organization-Id'],
    exposedHeaders: ['X-Request-Id', 'X-App-Commit'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // Log CORS configuration on startup
  if (isProduction) {
    console.log('[CORS] ✅ Production mode - Hard-fix enabled');
    console.log('[CORS] ✅ https://app.iphonealcosto.com is ALWAYS allowed (exact match)');
  } else {
    console.log('[CORS] Development mode - CORS logging enabled');
  }

  // Set X-App-Commit header for version tracking
  app.use((req: any, res: any, next: any) => {
    const commitSha = process.env.RAILWAY_GIT_COMMIT_SHA || 
                      process.env.VERCEL_GIT_COMMIT_SHA || 
                      process.env.GIT_COMMIT || 
                      'unknown';
    res.setHeader('X-App-Commit', commitSha);
    next();
  });

  // Belt & suspenders: Ensure OPTIONS requests return 204 before routes
  app.use((req: any, res: any, next: any) => {
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

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
