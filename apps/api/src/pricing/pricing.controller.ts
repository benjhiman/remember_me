import {
  Controller,
  Get,
  Post,
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
import { PricingService } from './pricing.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CreatePricingRuleDto } from './dto/create-pricing-rule.dto';
import { UpdatePricingRuleDto } from './dto/update-pricing-rule.dto';
import { ListPricingRulesDto } from './dto/list-pricing-rules.dto';
import { ComputePriceDto } from './dto/compute-price.dto';
import { ComputeBulkDto } from './dto/compute-bulk.dto';
import { ComputeSaleDto } from './dto/compute-sale.dto';
import { Role } from '@remember-me/prisma';

@Controller('pricing')
@UseGuards(JwtAuthGuard)
export class PricingController {
  constructor(private readonly pricingService: PricingService) {}

  @Get('health')
  health() {
    return this.pricingService.health();
  }

  @Get('rules')
  async listRules(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: ListPricingRulesDto,
  ) {
    return this.pricingService.listRules(organizationId, user.userId, query);
  }

  @Get('rules/:id')
  async getRule(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.pricingService.getRule(organizationId, user.userId, id);
  }

  @Post('rules')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async createRule(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreatePricingRuleDto,
  ) {
    return this.pricingService.createRule(organizationId, user.userId, dto);
  }

  @Patch('rules/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async updateRule(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdatePricingRuleDto,
  ) {
    return this.pricingService.updateRule(organizationId, user.userId, id, dto);
  }

  @Delete('rules/:id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRule(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    await this.pricingService.deleteRule(organizationId, user.userId, id);
  }

  @Patch('rules/:id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async restoreRule(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.pricingService.restoreRule(organizationId, user.userId, id);
  }

  @Post('compute')
  async computePrice(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: ComputePriceDto,
  ) {
    return this.pricingService.computePriceForItem(organizationId, user.userId, dto);
  }

  @Post('compute-bulk')
  async computeBulk(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: ComputeBulkDto,
  ) {
    return this.pricingService.computeBulk(organizationId, user.userId, dto);
  }

  @Post('compute-sale')
  async computeSale(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: ComputeSaleDto,
  ) {
    return this.pricingService.computeSale(organizationId, user.userId, dto);
  }
}
