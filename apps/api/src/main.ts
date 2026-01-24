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

  // CORS configuration
  // ⚠️ PROD SAFETY: Always include production domain in allowed origins
  const defaultOrigins = ['http://localhost:3000', 'http://localhost:3001'];
  const prodOrigin = 'https://app.iphonealcosto.com';
  
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : defaultOrigins;
  
  // Ensure production origin is always included if not in env var
  const isProduction = process.env.NODE_ENV === 'production';
  const finalOrigins = isProduction && !corsOrigins.includes(prodOrigin)
    ? [...corsOrigins, prodOrigin]
    : corsOrigins;

  app.enableCors({
    origin: finalOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key', 'X-Organization-Id'],
    exposedHeaders: ['X-Request-Id'],
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
