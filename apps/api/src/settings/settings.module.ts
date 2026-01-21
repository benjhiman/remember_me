import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OrgSettingsService } from './org-settings.service';
import { SettingsController } from './settings.controller';

@Module({
  imports: [PrismaModule],
  providers: [OrgSettingsService],
  controllers: [SettingsController],
  exports: [OrgSettingsService],
})
export class SettingsModule {}

