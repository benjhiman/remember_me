import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { SellersService } from './sellers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@remember-me/prisma';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { InviteSellerDto } from './dto/invite-seller.dto';
import { UpdateCommissionDto } from './dto/update-commission.dto';

@Controller('sellers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async getSellers(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.sellersService.getSellers(organizationId, user.userId);
  }

  @Get('stats')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async getSellersStats(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.sellersService.getSellersStats(organizationId, user.userId);
  }

  @Get(':id/overview')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async getSellerOverview(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.sellersService.getSellerOverview(organizationId, user.userId, id);
  }

  @Get(':id/invoices')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async getSellerInvoices(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.sellersService.getSellerInvoices(organizationId, user.userId, id);
  }

  @Post('invite')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async inviteSeller(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: InviteSellerDto,
  ) {
    return this.sellersService.inviteSeller(organizationId, user.userId, dto);
  }

  @Get(':id/commission')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async getCommissionConfig(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.sellersService.getCommissionConfig(organizationId, user.userId, id);
  }

  @Put(':id/commission')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async updateCommissionConfig(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCommissionDto,
  ) {
    return this.sellersService.updateCommissionConfig(
      organizationId,
      user.userId,
      id,
      dto,
    );
  }
}
