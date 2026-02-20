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
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { StockItemIdPipe } from './pipes/stock-item-id.pipe';
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
import { CreateStockEntryDto } from './dto/create-stock-entry.dto';
import { BulkStockAddDto } from './dto/bulk-stock-add.dto';
import { StockSummaryDto } from './dto/stock-summary.dto';
import { StockMovementsDto } from './dto/stock-movements.dto';
import { SellerStockViewDto } from './dto/seller-stock-view.dto';
import { Idempotent } from '../common/idempotency/idempotent.decorator';
import { Role } from '@remember-me/prisma';

@Controller('stock')
@UseGuards(JwtAuthGuard)
export class StockController {
  private readonly logger = new Logger(StockController.name);

  constructor(private readonly stockService: StockService) {
    // Log on controller instantiation to confirm it's being created
    this.logger.log('StockController instantiated');
  }

  @Get('health')
  health() {
    return this.stockService.health();
  }

  @Get('ping')
  ping() {
    this.logger.log('[ping] StockController is mounted and reachable');
    return { ok: true, controller: 'StockController', timestamp: new Date().toISOString() };
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

  @Get('seller-view')
  async getSellerStockView(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: SellerStockViewDto,
  ) {
    // CRITICAL: This log MUST appear if the handler is reached
    this.logger.log(`[seller-view] HIT - organizationId: ${organizationId || 'MISSING'}, userId: ${user?.userId || 'MISSING'}`);
    
    if (!organizationId) {
      this.logger.warn('[seller-view] Missing organizationId - returning 404');
      throw new NotFoundException('Organization not found');
    }
    if (!user?.userId) {
      this.logger.warn('[seller-view] Missing userId - returning 404');
      throw new NotFoundException('User not found');
    }
    
    try {
      const result = await this.stockService.getSellerStockView(organizationId, user.userId, query || {});
      this.logger.log(`[seller-view] Success - returning ${result?.length || 0} sections`);
      return result;
    } catch (error) {
      this.logger.error(`[seller-view] Service error: ${error instanceof Error ? error.message : String(error)}`, error instanceof Error ? error.stack : undefined);
      throw error;
    }
  }

  @Get('movements')
  async getStockMovements(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: StockMovementsDto,
  ) {
    return this.stockService.getStockMovements(organizationId, user.userId, query);
  }

  @Get('movements/:id')
  async getStockMovementDetail(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.stockService.getStockMovementDetail(organizationId, user.userId, id);
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

  // Bulk stock add
  @Post('bulk-add')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async bulkAddStock(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: BulkStockAddDto,
  ) {
    return this.stockService.bulkAddStock(organizationId, user.userId, dto);
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
    @Param('id', StockItemIdPipe) id: string,
  ) {
    // StockItemIdPipe will reject reserved route names like "seller-view" before reaching here
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
    @Param('id', StockItemIdPipe) id: string,
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
    @Param('id', StockItemIdPipe) id: string,
  ) {
    await this.stockService.deleteStockItem(organizationId, user.userId, id);
  }

  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async restoreStockItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id', StockItemIdPipe) id: string,
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
    @Param('id', StockItemIdPipe) id: string,
    @Body() dto: AdjustStockDto,
  ) {
    return this.stockService.adjustStock(organizationId, user.userId, id, dto);
  }

  // Stock movements (legacy - by stock item ID) - must come after @Get(':id')
  @Get(':id/movements')
  async listMovements(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id', StockItemIdPipe) id: string,
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
