import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { InboxService } from './inbox.service';
import { CurrentOrganization } from '../../common/decorators/current-organization.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { RateLimit } from '../../common/rate-limit/rate-limit.decorator';
import { RateLimitGuard } from '../../common/rate-limit/rate-limit.guard';
import {
  IntegrationProvider,
  ConversationStatus,
  Role,
} from '@remember-me/prisma';
import { CreateTagDto } from './dto/create-tag.dto';
import { UpdateTagDto } from './dto/update-tag.dto';
import { SendTextDto } from './dto/send-text.dto';

@Controller('inbox')
@UseGuards(JwtAuthGuard, RolesGuard)
export class InboxController {
  constructor(private readonly inboxService: InboxService) {}

  @Get('conversations')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async listConversations(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: { id: string; role: Role },
    @Query('provider') provider?: IntegrationProvider,
    @Query('status') status?: ConversationStatus,
    @Query('assignedToId') assignedToId?: string,
    @Query('tag') tagId?: string,
    @Query('q') q?: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '20',
  ) {
    return this.inboxService.listConversations(organizationId, {
      userId: user.id,
      userRole: user.role,
      provider,
      status,
      assignedToId,
      tagId,
      q,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get('conversations/:id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async getConversation(
    @CurrentOrganization() organizationId: string,
    @Param('id') conversationId: string,
  ) {
    return this.inboxService.getConversation(organizationId, conversationId);
  }

  @Get('conversations/:id/messages')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async getConversationMessages(
    @CurrentOrganization() organizationId: string,
    @Param('id') conversationId: string,
    @Query('page') page: string = '1',
    @Query('limit') limit: string = '50',
  ) {
    return this.inboxService.getConversationMessages(
      organizationId,
      conversationId,
      parseInt(page, 10),
      parseInt(limit, 10),
    );
  }

  @Patch('conversations/:id/assign')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async assignConversation(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: { id: string; role: Role },
    @Param('id') conversationId: string,
    @Body() body: { assignedToId: string },
  ) {
    return this.inboxService.assignConversation(
      organizationId,
      conversationId,
      body.assignedToId,
      user.id,
      user.role,
    );
  }

  @Patch('conversations/:id/mark-read')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async markConversationRead(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
  ) {
    return this.inboxService.markConversationRead(
      organizationId,
      conversationId,
      user.id,
    );
  }

  @Patch('conversations/:id/status')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async updateConversationStatus(
    @CurrentOrganization() organizationId: string,
    @Param('id') conversationId: string,
    @Body() body: { status: ConversationStatus },
  ) {
    return this.inboxService.updateConversationStatus(
      organizationId,
      conversationId,
      body.status,
    );
  }

  @Post('conversations/:id/tags/:tagId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async addTagToConversation(
    @CurrentOrganization() organizationId: string,
    @Param('id') conversationId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.inboxService.addTagToConversation(
      organizationId,
      conversationId,
      tagId,
    );
  }

  @Delete('conversations/:id/tags/:tagId')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async removeTagFromConversation(
    @CurrentOrganization() organizationId: string,
    @Param('id') conversationId: string,
    @Param('tagId') tagId: string,
  ) {
    return this.inboxService.removeTagFromConversation(
      organizationId,
      conversationId,
      tagId,
    );
  }

  @Get('tags')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async listTags(@CurrentOrganization() organizationId: string) {
    return this.inboxService.listTags(organizationId);
  }

  @Get('tags/:id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async getTag(
    @CurrentOrganization() organizationId: string,
    @Param('id') tagId: string,
  ) {
    return this.inboxService.getTag(organizationId, tagId);
  }

  @Post('tags')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async createTag(
    @CurrentOrganization() organizationId: string,
    @Body() dto: CreateTagDto,
  ) {
    return this.inboxService.createTag(organizationId, dto.name, dto.color);
  }

  @Patch('tags/:id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async updateTag(
    @CurrentOrganization() organizationId: string,
    @Param('id') tagId: string,
    @Body() dto: UpdateTagDto,
  ) {
    return this.inboxService.updateTag(
      organizationId,
      tagId,
      dto.name,
      dto.color,
    );
  }

  @Delete('tags/:id')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  async deleteTag(
    @CurrentOrganization() organizationId: string,
    @Param('id') tagId: string,
  ) {
    return this.inboxService.deleteTag(organizationId, tagId);
  }

  @Get('metrics')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  async getMetrics(
    @CurrentOrganization() organizationId: string,
    @Query('provider') provider?: IntegrationProvider,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.inboxService.getMetrics(organizationId, {
      provider,
      from: from ? new Date(from) : undefined,
      to: to ? new Date(to) : undefined,
    });
  }

  @Post('conversations/:id/send-text')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  @UseGuards(RateLimitGuard)
  @RateLimit({ action: 'inbox.send_text', limit: 60, windowSec: 60, skipIfDisabled: true })
  async sendTextMessage(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Body() body: SendTextDto,
  ) {
    return this.inboxService.sendTextMessage(
      organizationId,
      conversationId,
      body.text,
      user.id,
      body.mediaUrl,
      body.mediaType,
      body.caption,
    );
  }

  @Post('conversations/:id/send-template')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER, Role.SELLER)
  @UseGuards(RateLimitGuard)
  @RateLimit({ action: 'inbox.send_template', limit: 20, windowSec: 60, skipIfDisabled: true })
  async sendTemplateMessage(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: { id: string },
    @Param('id') conversationId: string,
    @Body() body: { templateId: string; variables: Record<string, string> },
  ) {
    return this.inboxService.sendTemplateMessage(
      organizationId,
      conversationId,
      body.templateId,
      body.variables || {},
      user.id,
    );
  }

  @Post('messages/:id/retry')
  @Roles(Role.ADMIN, Role.MANAGER, Role.OWNER)
  @UseGuards(RateLimitGuard)
  @RateLimit({ action: 'inbox.retry', limit: 10, windowSec: 60, skipIfDisabled: true })
  async retryFailedMessage(
    @CurrentOrganization() organizationId: string,
    @CurrentUser() user: { id: string },
    @Param('id') messageId: string,
  ) {
    return this.inboxService.retryFailedMessage(organizationId, messageId, user.id);
  }
}
