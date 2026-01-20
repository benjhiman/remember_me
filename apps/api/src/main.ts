import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { ConfigService } from '@nestjs/config';

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
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
    : ['http://localhost:3000', 'http://localhost:3001'];

  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
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

  const port = process.env.PORT || 4000;
  await app.listen(port);
  console.log(`🚀 API server running on: http://localhost:${port}/api`);
}

bootstrap();
