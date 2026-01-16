import {
  Controller,
  Get,
  Query,
  UseGuards,
  ParseEnumPipe,
  ParseBoolPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { AttributionService } from './attribution.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { DashboardFiltersDto } from './dto/dashboard-filters.dto';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(
    private readonly dashboardService: DashboardService,
    private readonly attributionService: AttributionService,
  ) {}

  @Get('health')
  health() {
    return this.dashboardService.health();
  }

  @Get('overview')
  async getOverview(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() filters: DashboardFiltersDto,
  ) {
    return this.dashboardService.getOverview(organizationId, user.userId, filters);
  }

  @Get('leads')
  async getLeadsDashboard(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() filters: DashboardFiltersDto,
  ) {
    return this.dashboardService.getLeadsDashboard(organizationId, user.userId, filters);
  }

  @Get('sales')
  async getSalesDashboard(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() filters: DashboardFiltersDto,
  ) {
    return this.dashboardService.getSalesDashboard(organizationId, user.userId, filters);
  }

  @Get('stock')
  async getStockDashboard(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() filters: DashboardFiltersDto,
  ) {
    return this.dashboardService.getStockDashboard(organizationId, user.userId, filters);
  }

  @Get('attribution/meta')
  async getMetaAttribution(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('groupBy', new DefaultValuePipe('campaign'), new ParseEnumPipe(['campaign', 'adset', 'ad']))
    groupBy: 'campaign' | 'adset' | 'ad' = 'campaign',
    @Query('includeZeroRevenue', new DefaultValuePipe(false), new ParseBoolPipe({ optional: true }))
    includeZeroRevenue: boolean = false,
  ) {
    return this.attributionService.getMetaAttributionMetrics(organizationId, {
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
      groupBy,
      includeZeroRevenue,
    });
  }
}
