import { Controller, Get, Post, Patch, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { WhatsAppAutomationsService } from './whatsapp-automations.service';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { Role, WhatsAppAutomationTrigger } from '@remember-me/prisma';
import { CreateAutomationRuleDto } from './dto/create-automation-rule.dto';
import { UpdateAutomationRuleDto } from './dto/update-automation-rule.dto';

@Controller('integrations/whatsapp/automations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class WhatsAppAutomationsController {
  constructor(private readonly automationsService: WhatsAppAutomationsService) {}

  @Get('rules')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async listRules(
    @CurrentOrganization() organizationId: string,
    @Query('trigger') trigger?: WhatsAppAutomationTrigger,
    @Query('enabled') enabled?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.automationsService.listRules(organizationId, {
      trigger,
      enabled: enabled === 'true' ? true : enabled === 'false' ? false : undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get('rules/:id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async getRule(
    @CurrentOrganization() organizationId: string,
    @Param('id') ruleId: string,
  ) {
    return this.automationsService.getRule(organizationId, ruleId);
  }

  @Post('rules')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async createRule(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateAutomationRuleDto,
  ) {
    return this.automationsService.createRule(organizationId, dto);
  }

  @Patch('rules/:id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async updateRule(
    @CurrentOrganization() organizationId: string,
    @Param('id') ruleId: string,
    @Body() dto: UpdateAutomationRuleDto,
  ) {
    return this.automationsService.updateRule(organizationId, ruleId, dto);
  }

  @Delete('rules/:id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async deleteRule(
    @CurrentOrganization() organizationId: string,
    @Param('id') ruleId: string,
  ) {
    return this.automationsService.deleteRule(organizationId, ruleId);
  }

  @Post('run-now')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async runNow(
    @CurrentOrganization() organizationId: string,
    @Body() body: { ruleId: string; phone: string; leadId?: string; saleId?: string },
  ) {
    return this.automationsService.runNow(organizationId, body.ruleId, {
      phone: body.phone,
      leadId: body.leadId,
      saleId: body.saleId,
    });
  }
}
