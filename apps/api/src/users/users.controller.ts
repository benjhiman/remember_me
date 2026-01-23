import { Controller, Get, Put, Body, Param, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { getPermissionsForRole } from '../auth/permissions';
import { PrismaService } from '../prisma/prisma.service';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('me')
  async getProfile(@CurrentUser() user: any, @CurrentOrganization() organizationId: string) {
    const profile = await this.usersService.getProfile(user.userId);
    
    // Get organization info
    const organization = await this.prisma.organization.findUnique({
      where: { id: organizationId },
      select: { id: true, name: true, slug: true },
    });

    // Get membership to get role
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: user.userId,
        organizationId: organizationId,
      },
      select: { role: true },
    });

    const role = membership?.role || user.role;
    const permissions = getPermissionsForRole(role);

    return {
      user: {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        avatar: profile.avatar,
      },
      organization: organization
        ? {
            id: organization.id,
            name: organization.name,
            slug: organization.slug,
          }
        : null,
      role,
      permissions,
    };
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
