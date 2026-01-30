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
import { CreateStockEntryDto } from './dto/create-stock-entry.dto';
import { StockSummaryDto } from './dto/stock-summary.dto';
import { StockMovementsDto } from './dto/stock-movements.dto';
import { ListReservationsDto } from './dto/list-reservations.dto';
import { ExtendReservationDto } from './dto/extend-reservation.dto';
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

  // Stock summary and movements (MUST come before @Get(':id') to avoid route conflicts)
  @Get('summary')
  async getStockSummary(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: StockSummaryDto,
  ) {
    return this.stockService.getStockSummary(organizationId, user.userId, query);
  }

  @Get('movements')
  async getStockMovements(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: StockMovementsDto,
  ) {
    return this.stockService.getStockMovements(organizationId, user.userId, query);
  }

  // Reservations (MUST come before @Get(':id') to avoid route conflicts)
  @Get('reservations')
  async listReservations(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: ListReservationsDto,
  ) {
    return this.stockService.listReservations(organizationId, user.userId, query);
  }

  @Post('reservations')
  async createReservation(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateReservationDto,
  ) {
    return this.stockService.reserveStock(organizationId, user.userId, dto);
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

  @Post('reservations/:id/extend')
  async extendReservation(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: ExtendReservationDto,
  ) {
    return this.stockService.extendReservation(organizationId, user.userId, id, dto.hours || 24);
  }

  @Post('reservations/:id/confirm')
  async confirmReservation(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.stockService.confirmReservation(organizationId, user.userId, id);
  }

  // Stock entries
  @Post('entries')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async createStockEntry(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateStockEntryDto,
  ) {
    return this.stockService.createStockEntry(organizationId, user.userId, dto);
  }

  // CRUD StockItem (dynamic routes must come after specific routes)
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

  // Stock movements (legacy - by stock item ID) - must come after @Get(':id')
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
}
