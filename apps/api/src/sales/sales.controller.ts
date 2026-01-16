import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { SalesService } from './sales.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CreateSaleDto } from './dto/create-sale.dto';
import { UpdateSaleDto } from './dto/update-sale.dto';
import { ListSalesDto } from './dto/list-sales.dto';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { Role } from '@remember-me/prisma';

@Controller('sales')
@UseGuards(JwtAuthGuard)
export class SalesController {
  constructor(private readonly salesService: SalesService) {}

  @Get('health')
  health() {
    return this.salesService.health();
  }

  @Get()
  async listSales(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: ListSalesDto,
  ) {
    return this.salesService.listSales(organizationId, user.userId, query);
  }

  @Get(':id')
  async getSale(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.salesService.getSale(organizationId, user.userId, id);
  }

  @Post()
  @Idempotent()
  async createSale(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateSaleDto,
  ) {
    return this.salesService.createSale(organizationId, user.userId, dto);
  }

  @Patch(':id')
  async updateSale(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateSaleDto,
  ) {
    return this.salesService.updateSale(organizationId, user.userId, id, dto);
  }

  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 10, ttl: 60000 } }) // 10 requests per minute per user
  @Patch(':id/pay')
  @Idempotent()
  async paySale(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.salesService.paySale(organizationId, user.userId, id);
  }

  @Patch(':id/cancel')
  async cancelSale(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.salesService.cancelSale(organizationId, user.userId, id);
  }

  @Patch(':id/ship')
  async shipSale(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.salesService.shipSale(organizationId, user.userId, id);
  }

  @Patch(':id/deliver')
  async deliverSale(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.salesService.deliverSale(organizationId, user.userId, id);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteSale(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.salesService.deleteSale(organizationId, user.userId, id);
  }

  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async restoreSale(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.salesService.restoreSale(organizationId, user.userId, id);
  }
}
