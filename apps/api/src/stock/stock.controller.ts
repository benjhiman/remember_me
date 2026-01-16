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
import { StockService } from './stock.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CreateStockItemDto } from './dto/create-stock-item.dto';
import { UpdateStockItemDto } from './dto/update-stock-item.dto';
import { ListStockItemsDto } from './dto/list-stock-items.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { Role } from '@remember-me/prisma';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class StockController {
  constructor(private readonly stockService: StockService) {}

  @Get('health')
  health() {
    return this.stockService.health();
  }

  // CRUD StockItem
  @Get()
  async listStockItems(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: ListStockItemsDto,
  ) {
    return this.stockService.listStockItems(organizationId, user.userId, query);
  }

  @Get(':id')
  async getStockItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.stockService.getStockItem(organizationId, user.userId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async createStockItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateStockItemDto,
  ) {
    return this.stockService.createStockItem(organizationId, user.userId, dto);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async updateStockItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateStockItemDto,
  ) {
    return this.stockService.updateStockItem(organizationId, user.userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteStockItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.stockService.deleteStockItem(organizationId, user.userId, id);
  }

  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async restoreStockItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.stockService.restoreStockItem(organizationId, user.userId, id);
  }

  // Stock adjustments
  @Post(':id/adjust')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async adjustStock(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.stockService.adjustStock(organizationId, user.userId, id, dto);
  }

  // Stock movements
  @Get(':id/movements')
  async listMovements(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockService.listMovements(
      organizationId,
      user.userId,
      id,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  // Reservations
  @Post('reservations')
  async createReservation(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateReservationDto,
  ) {
    return this.stockService.reserveStock(organizationId, user.userId, dto);
  }

  @Get('reservations')
  async listReservations(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query('itemId') itemId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.stockService.listReservations(
      organizationId,
      user.userId,
      itemId,
      status as any,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 50,
    );
  }

  @Get('reservations/:id')
  async getReservation(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.stockService.getReservation(organizationId, user.userId, id);
  }

  @Post('reservations/:id/release')
  async releaseReservation(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.stockService.releaseReservation(organizationId, user.userId, id);
  }

  @Post('reservations/:id/confirm')
  async confirmReservation(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.stockService.confirmReservation(organizationId, user.userId, id);
  }
}
