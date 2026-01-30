import { Module } from '@nestjs/common';
import { StockService } from './stock.service';
import { StockController } from './stock.controller';
import { ReservationsExpirerService } from './reservations-expirer.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditLogModule } from '../common/audit/audit-log.module';

@Module({
  imports: [PrismaModule, AuditLogModule],
  controllers: [StockController],
  providers: [StockService, ReservationsExpirerService],
  exports: [StockService],
})
export class StockModule {}
