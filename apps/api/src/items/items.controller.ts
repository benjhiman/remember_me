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
import { ItemsService } from './items.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CreateItemDto } from './dto/create-item.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { ListItemsDto } from './dto/list-items.dto';
import { Role } from '@remember-me/prisma';

@Controller('items')
@UseGuards(JwtAuthGuard)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  async listItems(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: ListItemsDto,
  ) {
    return this.itemsService.listItems(organizationId, user.userId, query);
  }

  @Get(':id')
  async getItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.itemsService.getItem(organizationId, user.userId, id);
  }

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async createItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateItemDto,
  ) {
    return this.itemsService.createItem(organizationId, user.userId, dto);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async updateItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.itemsService.updateItem(organizationId, user.userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  @HttpCode(HttpStatus.OK)
  async deleteItem(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.itemsService.deleteItem(organizationId, user.userId, id);
  }
}
