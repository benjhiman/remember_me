import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';
import { AddMemberDto } from './dto/add-member.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { InviteUserDto } from './dto/invite-user.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Role } from '@remember-me/prisma';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Post()
  async create(@CurrentUser() user: any, @Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(user.userId, dto);
  }

  @Get()
  async findMyOrganizations(@CurrentUser() user: any) {
    return this.organizationsService.findMyOrganizations(user.userId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.organizationsService.findOne(id, user.userId);
  }

  @Put(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async update(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateOrganizationDto
  ) {
    return this.organizationsService.update(id, user.userId, dto);
  }

  @Get(':id/members')
  async getMembers(@Param('id') id: string, @CurrentUser() user: any) {
    return this.organizationsService.getMembers(id, user.userId);
  }

  @Post(':id/members')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async addMember(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: AddMemberDto
  ) {
    return this.organizationsService.addMember(id, user.userId, dto);
  }

  @Put(':id/members/:memberId/role')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async updateMemberRole(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any,
    @Body() dto: UpdateMemberRoleDto
  ) {
    return this.organizationsService.updateMemberRole(id, memberId, user.userId, dto);
  }

  @Delete(':id/members/:memberId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN)
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @CurrentUser() user: any
  ) {
    return this.organizationsService.removeMember(id, memberId, user.userId);
  }

  @Post(':id/invite')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async inviteUser(
    @Param('id') id: string,
    @CurrentUser() user: any,
    @Body() dto: InviteUserDto
  ) {
    return this.organizationsService.inviteUser(id, user.userId, dto);
  }

  @Get(':id/invitations')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async getInvitations(@Param('id') id: string, @CurrentUser() user: any) {
    return this.organizationsService.getInvitations(id, user.userId);
  }

  @Delete(':id/invitations/:invitationId')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER)
  async cancelInvitation(
    @Param('id') id: string,
    @Param('invitationId') invitationId: string,
    @CurrentUser() user: any
  ) {
    return this.organizationsService.cancelInvitation(id, invitationId, user.userId);
  }
}
