import { NestFactory } from '@nestjs/core';
import { ValidationPipe, BadRequestException } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from './prisma/prisma.service';
import { seedOwnerOnBoot } from './bootstrap/seed-owner-on-boot';
import { BUILD_INFO } from './build-info';
import * as fs from 'fs';
import * as path from 'path';

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

  // Cookie parser (required for httpOnly cookies) - MUST be before other middleware
  app.use(cookieParser());
  
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
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Request-Id',
      'Idempotency-Key',
      'X-Organization-Id',
      'X-Client',
      'X-Client-Version',
    ],
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
    // Try to read BUILD_COMMIT.txt from Dockerfile if available
    let buildCommitFromFile: string | null = null;
    try {
      const buildCommitPath = path.join(process.cwd(), 'BUILD_COMMIT.txt');
      if (fs.existsSync(buildCommitPath)) {
        const content = fs.readFileSync(buildCommitPath, 'utf-8').trim();
        const match = content.match(/commit=([a-f0-9]+)/);
        if (match) {
          buildCommitFromFile = match[1].substring(0, 7);
        }
      }
    } catch (e) {
      // Ignore errors reading file
    }

    const commitSha = buildCommitFromFile || BUILD_INFO.commit;
    res.setHeader('X-App-Commit', commitSha);
    res.setHeader('X-App-Build-Time', BUILD_INFO.buildTime);
    next();
  });

  // NOTE: enableCors already handles OPTIONS requests correctly
  // We don't need a separate OPTIONS handler

  // Global validation pipe (strict)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
      // Always show error messages for better debugging and user experience
      disableErrorMessages: false,
      // Return detailed validation errors
      exceptionFactory: (errors) => {
        const messages = errors.map((error) => {
          const constraints = error.constraints;
          if (constraints) {
            return Object.values(constraints)[0];
          }
          return `${error.property} has invalid value`;
        });
        return new BadRequestException({
          message: messages.length === 1 ? messages[0] : messages,
          error: 'Validation failed',
          statusCode: 400,
        });
      },
    }),
  );

  // Global prefix
  app.setGlobalPrefix('api');

  // CRITICAL: Deployment diagnostics - log commit, build time, cwd, and entry point
  // Try to read BUILD_COMMIT.txt from Dockerfile if available
  let buildCommitFromFile: string | null = null;
  try {
    const buildCommitPath = path.join(process.cwd(), 'BUILD_COMMIT.txt');
    if (fs.existsSync(buildCommitPath)) {
      const content = fs.readFileSync(buildCommitPath, 'utf-8').trim();
      const match = content.match(/commit=([a-f0-9]+)/);
      if (match) {
        buildCommitFromFile = match[1].substring(0, 7);
      }
    }
  } catch (e) {
    // Ignore errors reading file
  }

  const commitSha = buildCommitFromFile || BUILD_INFO.commit;
  const buildTime = BUILD_INFO.buildTime;
  const cwd = process.cwd();
  const entryFile = __filename;

  console.log(`📦 Deployment diagnostics:`);
  console.log(`📦 commit=${commitSha}`);
  console.log(`📦 buildTime=${buildTime}`);
  console.log(`📦 cwd=${cwd}`);
  console.log(`📦 entry=${entryFile}`);

  // Log registered routes (diagnostic - only in production for now)
  if (process.env.NODE_ENV === 'production' || process.env.LOG_ROUTES === 'true') {
    try {
      const httpAdapter = app.getHttpAdapter();
      const instance = httpAdapter.getInstance();
      
      // For Express - simple route logging
      if (instance && typeof (instance as any)._router !== 'undefined') {
        const routes: string[] = [];
        const router = (instance as any)._router;
        if (router && router.stack) {
          router.stack.forEach((layer: any) => {
            if (layer.route) {
              const path = layer.route.path;
              const methods = Object.keys(layer.route.methods).filter((m: string) => m !== '_all');
              methods.forEach((method: string) => {
                routes.push(`${method.toUpperCase()} ${path}`);
              });
            }
          });
        }
        
        // Filter and log stock routes
        const stockRoutes = routes.filter((r: string) => r.includes('/stock'));
        if (stockRoutes.length > 0) {
          console.log('📋 Registered /api/stock routes:');
          stockRoutes.forEach((route: string) => console.log(`   ${route}`));
        } else {
          console.warn('⚠️  No /api/stock routes found in registered routes!');
        }
      }
    } catch (error) {
      console.warn('⚠️  Could not list routes (non-critical):', error instanceof Error ? error.message : String(error));
    }
  }

  // Seed OWNER on boot (si SEED_OWNER_ON_BOOT === 'true')
  const prismaService = app.get(PrismaService);
  await seedOwnerOnBoot(prismaService);

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 API server running on: http://localhost:${port}/api`);
}

bootstrap();
