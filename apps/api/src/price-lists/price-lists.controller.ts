import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { PriceListsService } from './price-lists.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { Role } from '@remember-me/prisma';
import { CreatePriceListDto } from './dto/create-price-list.dto';
import { UpdatePriceListItemDto } from './dto/update-price-list-item.dto';
import { BulkUpdatePriceListItemsDto } from './dto/bulk-update-price-list-items.dto';

@Controller('price-lists')
@UseGuards(JwtAuthGuard)
export class PriceListsController {
  constructor(private readonly priceListsService: PriceListsService) {}

  @Get()
  async listPriceLists(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.priceListsService.listPriceLists(organizationId, user.userId);
  }

  @Get(':id')
  async getPriceList(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.priceListsService.getPriceList(organizationId, user.userId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async createPriceList(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreatePriceListDto,
  ) {
    return this.priceListsService.createPriceList(organizationId, user.userId, dto);
  }

  @Patch(':id/items/bulk')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async bulkUpdatePriceListItems(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') priceListId: string,
    @Body() dto: BulkUpdatePriceListItemsDto,
  ) {
    return this.priceListsService.bulkUpdatePriceListItems(organizationId, user.userId, priceListId, dto);
  }

  @Patch(':id/items/:itemId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async updatePriceListItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') priceListId: string,
    @Param('itemId') priceListItemId: string,
    @Body() dto: UpdatePriceListItemDto,
  ) {
    return this.priceListsService.updatePriceListItem(
      organizationId,
      user.userId,
      priceListId,
      priceListItemId,
      dto,
    );
  }
}
