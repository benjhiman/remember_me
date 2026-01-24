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
import { PurchasesService } from './purchases.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { UpdatePurchaseDto } from './dto/update-purchase.dto';
import { TransitionPurchaseDto } from './dto/transition-purchase.dto';
import { ListPurchasesDto } from './dto/list-purchases.dto';

@Controller('purchases')
@UseGuards(JwtAuthGuard)
export class PurchasesController {
  constructor(private readonly purchasesService: PurchasesService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['purchases.read'])
  async listPurchases(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: ListPurchasesDto,
  ) {
    return this.purchasesService.listPurchases(organizationId, user.userId, query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['purchases.read'])
  async getPurchase(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.purchasesService.getPurchase(organizationId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['purchases.write'])
  async createPurchase(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreatePurchaseDto,
  ) {
    return this.purchasesService.createPurchase(organizationId, user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['purchases.write'])
  async updatePurchase(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdatePurchaseDto,
  ) {
    return this.purchasesService.updatePurchase(organizationId, id, user.userId, dto);
  }

  @Post(':id/transition')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['purchases.write'])
  async transitionPurchase(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: TransitionPurchaseDto,
  ) {
    return this.purchasesService.transitionPurchase(organizationId, id, user.userId, dto);
  }
}
