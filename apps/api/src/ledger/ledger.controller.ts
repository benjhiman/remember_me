import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { PermissionsGuard } from '../common/guards/permissions.guard';
import { RequirePermissions } from '../common/decorators/require-permissions.decorator';
import { Permission } from '../auth/permissions';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CreateLedgerAccountDto } from './dto/create-ledger-account.dto';
import { ListLedgerAccountsDto } from './dto/list-ledger-accounts.dto';

@Controller('ledger/accounts')
@UseGuards(JwtAuthGuard)
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['ledger.read'])
  async listAccounts(
    @CurrentOrganization() organizationId: string,
    @Query() query: ListLedgerAccountsDto,
  ) {
    return this.ledgerService.listAccounts(organizationId, query);
  }

  @Get(':id')
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['ledger.read'])
  async getAccount(
    @CurrentOrganization() organizationId: string,
    @Param('id') id: string,
  ) {
    return this.ledgerService.getAccount(organizationId, id);
  }

  @Post()
  @UseGuards(PermissionsGuard)
  @RequirePermissions(Permission['ledger.write'])
  async createAccount(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateLedgerAccountDto,
  ) {
    return this.ledgerService.createAccount(organizationId, dto);
  }
}
