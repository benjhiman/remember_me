import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    return this.usersService.getProfile(user.userId);
  }

  @Put('me')
  async updateProfile(@CurrentUser() user: any, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.userId, dto);
  }

  /**
   * Get users in current organization (from JWT token)
   * All authenticated users can access (needed for assignment dropdowns)
   */
  @Get()
  async getCurrentOrganizationUsers(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
  ) {
    return this.usersService.getCurrentOrganizationUsers(organizationId, user.userId);
  }

  @Get('organization/:organizationId')
  async getUsersInOrganization(
    @Param('organizationId') organizationId: string,
    @CurrentUser() user: any
  ) {
    return this.usersService.getUsersInOrganization(organizationId, user.userId);
  }
}
