import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { Role } from '@remember-me/prisma';
import { OrgSettingsService } from './org-settings.service';
import {
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PermissionsDto {
  @IsOptional() @IsBoolean()
  sellerCanChangeConversationStatus?: boolean;

  @IsOptional() @IsBoolean()
  sellerCanReassignConversation?: boolean;

  @IsOptional() @IsBoolean()
  sellerCanEditSales?: boolean;

  @IsOptional() @IsBoolean()
  sellerCanEditLeads?: boolean;

  @IsOptional() @IsBoolean()
  sellerCanMoveKanban?: boolean;
}

class InboxDto {
  @IsOptional() @IsBoolean()
  sellerSeesOnlyAssigned?: boolean;

  @IsOptional() @IsIn(['OPEN', 'PENDING', 'CLOSED'])
  defaultConversationStatus?: 'OPEN' | 'PENDING' | 'CLOSED';

  @IsOptional() @IsBoolean()
  autoAssignOnReply?: boolean;
}

class UiDto {
  @IsOptional() @IsIn(['comfortable', 'compact'])
  density?: 'comfortable' | 'compact';

  @IsOptional() @IsIn(['light', 'dark'])
  theme?: 'light' | 'dark';

  @IsOptional() @IsIn(['blue', 'violet', 'green'])
  accentColor?: 'blue' | 'violet' | 'green';
}

class CrmDto {
  @IsOptional()
  @ValidateNested()
  @Type(() => PermissionsDto)
  permissions?: PermissionsDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => InboxDto)
  inbox?: InboxDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => UiDto)
  ui?: UiDto;
}

class UpdateSettingsDto {
  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => CrmDto)
  crm?: CrmDto;
}

@Controller('settings')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SettingsController {
  constructor(private readonly orgSettings: OrgSettingsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OWNER)
  async getSettings(@CurrentOrganization() organizationId: string) {
    return this.orgSettings.getSettings(organizationId);
  }

  @Put()
  @Roles(Role.ADMIN, Role.OWNER)
  async updateSettings(
    @CurrentOrganization() organizationId: string,
    @Body() body: UpdateSettingsDto,
  ) {
    return this.orgSettings.updateSettings(organizationId, body as any);
  }
}

