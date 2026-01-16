import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { WhatsAppTemplatesService } from './whatsapp-templates.service';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, WhatsAppTemplateStatus, WhatsAppTemplateCategory } from '@remember-me/prisma';
import { CreateWhatsAppTemplateDto } from './dto/create-whatsapp-template.dto';
import { UpdateWhatsAppTemplateDto } from './dto/update-whatsapp-template.dto';
import { SendTemplateDto } from './dto/send-template.dto';

@Controller('integrations/whatsapp/templates')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsAppTemplatesController {
  constructor(private readonly templatesService: WhatsAppTemplatesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async listTemplates(
    @CurrentOrganization() organizationId: string,
    @Query('status') status?: WhatsAppTemplateStatus,
    @Query('category') category?: WhatsAppTemplateCategory,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.templatesService.listTemplates(organizationId, {
      status,
      category,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async getTemplate(
    @CurrentOrganization() organizationId: string,
    @Param('id') templateId: string,
  ) {
    return this.templatesService.getTemplate(organizationId, templateId);
  }

  @Post()
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async createTemplate(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateWhatsAppTemplateDto,
  ) {
    return this.templatesService.createTemplate(organizationId, dto);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async updateTemplate(
    @CurrentOrganization() organizationId: string,
    @Param('id') templateId: string,
    @Body() dto: UpdateWhatsAppTemplateDto,
  ) {
    return this.templatesService.updateTemplate(organizationId, templateId, dto);
  }

  @Delete(':id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async deleteTemplate(
    @CurrentOrganization() organizationId: string,
    @Param('id') templateId: string,
  ) {
    return this.templatesService.deleteTemplate(organizationId, templateId);
  }

  @Post('send')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async sendTemplate(
    @CurrentOrganization() organizationId: string,
    @Body() dto: SendTemplateDto,
  ) {
    return this.templatesService.sendTemplate(
      organizationId,
      dto.toPhone,
      dto.templateId,
      dto.variables,
      dto.leadId,
    );
  }
}
