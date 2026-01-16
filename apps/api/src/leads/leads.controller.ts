import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { LeadsService } from './leads.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { CurrentOrganization } from '../common/decorators/current-organization.decorator';
import { CreatePipelineDto } from './dto/create-pipeline.dto';
import { CreateStageDto } from './dto/create-stage.dto';
import { ReorderStagesDto } from './dto/reorder-stages.dto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { ListLeadsDto } from './dto/list-leads.dto';
import { CreateNoteDto } from './dto/create-note.dto';
import { CreateTaskDto } from './dto/create-task.dto';
import { UpdateTaskDto } from './dto/update-task.dto';
import { AssignLeadDto } from './dto/assign-lead.dto';
import { Role } from '@remember-me/prisma';

@Controller('leads')
@UseGuards(JwtAuthGuard)
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get('health')
  health() {
    return this.leadsService.health();
  }

  // Pipelines
  @Get('pipelines')
  async getPipelines(@CurrentOrganization() organizationId: string, @CurrentUser() user: any) {
    return this.leadsService.getPipelines(organizationId, user.userId);
  }

  @Post('pipelines')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async createPipeline(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreatePipelineDto,
  ) {
    return this.leadsService.createPipeline(organizationId, user.userId, dto);
  }

  // Stages
  @Post('stages')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async createStage(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateStageDto,
  ) {
    return this.leadsService.createStage(organizationId, user.userId, dto);
  }

  @Patch('stages/reorder')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async reorderStages(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: ReorderStagesDto,
  ) {
    return this.leadsService.reorderStages(organizationId, user.userId, dto);
  }

  // Leads
  @Get()
  async listLeads(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Query() query: ListLeadsDto,
  ) {
    return this.leadsService.listLeads(organizationId, user.userId, query);
  }

  @Get(':id')
  async getLead(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.leadsService.getLead(organizationId, user.userId, id);
  }

  @Post()
  async createLead(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateLeadDto,
  ) {
    return this.leadsService.createLead(organizationId, user.userId, dto);
  }

  @Put(':id')
  async updateLead(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.updateLead(organizationId, user.userId, id, dto);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async deleteLead(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.leadsService.deleteLead(organizationId, user.userId, id);
  }

  @Patch(':id/restore')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async restoreLead(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.leadsService.restoreLead(organizationId, user.userId, id);
  }

  @Post(':id/assign')
  async assignLead(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
    @Body() dto: AssignLeadDto,
  ) {
    return this.leadsService.assignLead(organizationId, user.userId, id, dto);
  }

  // Notes
  @Get(':id/notes')
  async getLeadNotes(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.leadsService.getLeadNotes(organizationId, user.userId, id);
  }

  @Post('notes')
  async createNote(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateNoteDto,
  ) {
    return this.leadsService.createNote(organizationId, user.userId, dto);
  }

  // Tasks
  @Get(':id/tasks')
  async getLeadTasks(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('id') id: string,
  ) {
    return this.leadsService.getLeadTasks(organizationId, user.userId, id);
  }

  @Post('tasks')
  async createTask(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Body() dto: CreateTaskDto,
  ) {
    return this.leadsService.createTask(organizationId, user.userId, dto);
  }

  @Patch('tasks/:taskId')
  async updateTask(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: any,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.leadsService.updateTask(organizationId, user.userId, taskId, dto);
  }
}
