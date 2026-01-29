import { Module } from '@nestjs/common';
import { ItemsController } from './items.controller';
import { ItemsService } from './items.service';
import { ItemsSeederService } from './items-seeder.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../common/audit/audit-log.module';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [ItemsController],
  providers: [ItemsService, ItemsSeederService],
  exports: [ItemsService, ItemsSeederService],
})
export class ItemsModule {}
