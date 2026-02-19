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
import { CustomersService } from './customers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';

@Controller('customers')
@UseGuards(JwtAuthGuard)
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['customers.read'])
  async listCustomers(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: ListCustomersDto,
  ) {
    return this.customersService.listCustomers(organizationId, user.userId, query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['customers.read'])
  async getCustomer(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.customersService.getCustomer(organizationId, user.userId, id);
  }

  @Get(':id/invoices')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['customers.read'])
  async getCustomerInvoices(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.customersService.getCustomerInvoices(organizationId, user.userId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['customers.write'])
  async createCustomer(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.createCustomer(organizationId, user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['customers.write'])
  async updateCustomer(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.updateCustomer(organizationId, id, user.userId, dto);
  }
}
