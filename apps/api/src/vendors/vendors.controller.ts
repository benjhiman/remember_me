import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { UpdateVendorDto } from './dto/update-vendor.dto';
import { ListVendorsDto } from './dto/list-vendors.dto';

@Controller('vendors')
@UseGuards(JwtAuthGuard)
export class VendorsController {
  constructor(private readonly vendorsService: VendorsService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['vendors.read'])
  async listVendors(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: ListVendorsDto,
  ) {
    return this.vendorsService.listVendors(organizationId, user.userId, query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['vendors.read'])
  async getVendor(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.vendorsService.getVendor(organizationId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['vendors.write'])
  async createVendor(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateVendorDto,
  ) {
    return this.vendorsService.createVendor(organizationId, user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['vendors.write'])
  async updateVendor(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateVendorDto,
  ) {
    return this.vendorsService.updateVendor(organizationId, id, user.userId, dto);
  }
}
