import { Controller, Get, UseGuards } from '@nestjs/common';
import { SellersService } from './sellers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { OwnerOnlyGuard } from '../common/guards/owner-only.guard';
import { OwnerOnly } from '../common/decorators/owner-only.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';

@Controller('sellers')
@UseGuards(JwtAuthGuard, OwnerOnlyGuard)
export class SellersController {
  constructor(private readonly sellersService: SellersService) {}

  @Get()
  @OwnerOnly()
  async getSellers(@CurrentOrganization() organizationId: string) {
    return this.sellersService.getSellers(organizationId);
  }
}
