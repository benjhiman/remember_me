import { Module, OnModuleInit } from '@nestjs/common';
import { IdempotencyService } from './idempotency.service';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [IdempotencyService, IdempotencyInterceptor],
  exports: [IdempotencyService, IdempotencyInterceptor],
})
export class IdempotencyModule implements OnModuleInit {
  constructor(private readonly idempotencyService: IdempotencyService) {}

  async onModuleInit() {
    // Cleanup expired idempotency keys on startup
    await this.idempotencyService.cleanupExpired();
  }
}
