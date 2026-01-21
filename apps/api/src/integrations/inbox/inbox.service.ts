import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  IntegrationProvider,
  ConversationStatus,
  MessageDirection,
  MessageStatus,
  Role,
  IntegrationJobType,
} from '@remember-me/prisma';
import { IntegrationQueueService } from '../jobs/queue/integration-queue.service';

@Injectable()
export class InboxService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationQueueService: IntegrationQueueService,
  ) {}

  /**
   * Sync MessageLog with Conversation (upsert)
   * Called when a message is created
   */
  async syncConversationFromMessage(
    organizationId: string,
    provider: IntegrationProvider,
    direction: MessageDirection,
    phone: string | null,
    handle: string | null,
    externalThreadId: string | null,
    messageCreatedAt: Date,
  ): Promise<string | null> {
    if (!phone && !handle) {
      return null; // Cannot create conversation without identifier
    }

    // Find or create conversation
    const conversation = await this.prisma.conversation.upsert({
      where: {
        organizationId_provider_phone: {
          organizationId,
          provider,
          phone: phone || '', // Use empty string if null for unique constraint
        },
      },
      create: {
        organizationId,
        provider,
        phone: phone || null,
        handle: handle || null,
        externalThreadId: externalThreadId || null,
        status: ConversationStatus.OPEN,
        lastMessageAt: messageCreatedAt,
        lastInboundAt: direction === MessageDirection.INBOUND ? messageCreatedAt : null,
        lastOutboundAt: direction === MessageDirection.OUTBOUND ? messageCreatedAt : null,
        unreadCount: direction === MessageDirection.INBOUND ? 1 : 0,
      },
      update: {
        lastMessageAt: messageCreatedAt,
        lastInboundAt:
          direction === MessageDirection.INBOUND
            ? messageCreatedAt
            : undefined,
        lastOutboundAt:
          direction === MessageDirection.OUTBOUND
            ? messageCreatedAt
            : undefined,
        unreadCount:
          direction === MessageDirection.INBOUND
            ? { increment: 1 }
            : undefined,
      },
    });

    // Try to link with Lead if phone matches
    if (phone && !conversation.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: {
          organizationId,
          phone,
          deletedAt: null,
        },
      });

      if (lead) {
        await this.prisma.conversation.update({
          where: { id: conversation.id },
          data: { leadId: lead.id },
        });
      }
    }

    return conversation.id;
  }

  /**
   * List conversations with filters
   */
  async listConversations(
    organizationId: string,
    filters: {
      userId?: string;
      userRole?: Role;
      provider?: IntegrationProvider;
      status?: ConversationStatus;
      assignedToId?: string;
      tagId?: string;
      q?: string; // Search by phone/handle/lead name
      page?: number;
      limit?: number;
    },
  ) {
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // Enforce SELLER can only see their assigned conversations
    if (filters.userRole === Role.SELLER && filters.userId) {
      filters.assignedToId = filters.userId;
    }

    const where: any = {
      organizationId,
      deletedAt: null,
    };

    if (filters.provider) {
      where.provider = filters.provider;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.assignedToId) {
      if (filters.assignedToId === 'unassigned') {
        where.assignedToId = null;
      } else {
        where.assignedToId = filters.assignedToId;
      }
    }

    if (filters.tagId) {
      where.tags = {
        some: {
          tagId: filters.tagId,
        },
      };
    }

    if (filters.q) {
      where.OR = [
        { phone: { contains: filters.q, mode: 'insensitive' } },
        { handle: { contains: filters.q, mode: 'insensitive' } },
        { lead: { name: { contains: filters.q, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.conversation.findMany({
        where,
        include: {
          lead: {
            select: {
              id: true,
              name: true,
              phone: true,
              stage: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
          assignedTo: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
            select: {
              text: true,
              direction: true,
            },
          },
        },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.conversation.count({ where }),
    ]);

    // Enrich with UX fields
    const enrichedData = await Promise.all(
      data.map(async (conv) => {
        const lastMessage = conv.messages[0];
        const previewText = lastMessage?.text
          ? lastMessage.text.substring(0, 100) + (lastMessage.text.length > 100 ? '...' : '')
          : null;
        const lastMessageDirection = lastMessage?.direction || null;

        // Calculate UX helpers
        const canReply = conv.status !== ConversationStatus.CLOSED;
        const requiresTemplate = this.requiresTemplate(conv.lastInboundAt, conv.lastOutboundAt);
        const slaStatus = this.calculateSlaStatus(conv.lastInboundAt, conv.lastOutboundAt);

        return {
          id: conv.id,
          organizationId: conv.organizationId,
          provider: conv.provider,
          externalThreadId: conv.externalThreadId,
          phone: conv.phone,
          handle: conv.handle,
          leadId: conv.leadId,
          lead: conv.lead
            ? {
                id: conv.lead.id,
                name: conv.lead.name,
                phone: conv.lead.phone,
                stage: conv.lead.stage,
              }
            : null,
          assignedToId: conv.assignedToId,
          assignedTo: conv.assignedTo,
          assignedUser: conv.assignedTo
            ? {
                id: conv.assignedTo.id,
                name: conv.assignedTo.name,
              }
            : null,
          status: conv.status,
          lastMessageAt: conv.lastMessageAt,
          lastInboundAt: conv.lastInboundAt,
          lastOutboundAt: conv.lastOutboundAt,
          lastReadAt: conv.lastReadAt,
          unreadCount: conv.unreadCount,
          previewText,
          lastMessageDirection,
          tags: conv.tags.map((link) => ({
            id: link.tag.id,
            name: link.tag.name,
            color: link.tag.color,
          })),
          // UX helpers
          canReply,
          requiresTemplate,
          slaStatus,
          createdAt: conv.createdAt,
          updatedAt: conv.updatedAt,
        };
      }),
    );

    return {
      data: enrichedData,
      total,
      page,
      limit,
    };
  }

  /**
   * Get conversation by ID
   */
  async getConversation(organizationId: string, conversationId: string) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        deletedAt: null,
      },
      include: {
        lead: {
          select: {
            id: true,
            name: true,
            phone: true,
            email: true,
            stage: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        tags: {
          include: {
            tag: true,
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            text: true,
            direction: true,
          },
        },
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const lastMessage = conversation.messages[0];
    const previewText = lastMessage?.text
      ? lastMessage.text.substring(0, 100) + (lastMessage.text.length > 100 ? '...' : '')
      : null;
    const lastMessageDirection = lastMessage?.direction || null;

    // Calculate UX helpers
    const canReply = conversation.status !== ConversationStatus.CLOSED;
    const requiresTemplate = this.requiresTemplate(conversation.lastInboundAt, conversation.lastOutboundAt);
    const slaStatus = this.calculateSlaStatus(conversation.lastInboundAt, conversation.lastOutboundAt);

    return {
      id: conversation.id,
      organizationId: conversation.organizationId,
      provider: conversation.provider,
      externalThreadId: conversation.externalThreadId,
      phone: conversation.phone,
      handle: conversation.handle,
      leadId: conversation.leadId,
      lead: conversation.lead
        ? {
            id: conversation.lead.id,
            name: conversation.lead.name,
            phone: conversation.lead.phone,
            email: conversation.lead.email,
            stage: conversation.lead.stage,
          }
        : null,
      assignedToId: conversation.assignedToId,
      assignedTo: conversation.assignedTo,
      assignedUser: conversation.assignedTo
        ? {
            id: conversation.assignedTo.id,
            name: conversation.assignedTo.name,
          }
        : null,
      status: conversation.status,
      lastMessageAt: conversation.lastMessageAt,
      lastInboundAt: conversation.lastInboundAt,
      lastOutboundAt: conversation.lastOutboundAt,
      lastReadAt: conversation.lastReadAt,
      unreadCount: conversation.unreadCount,
      previewText,
      lastMessageDirection,
      tags: conversation.tags.map((link) => ({
        id: link.tag.id,
        name: link.tag.name,
        color: link.tag.color,
      })),
      // UX helpers
      canReply,
      requiresTemplate,
      slaStatus,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    };
  }

  /**
   * Get messages for a conversation
   */
  async getConversationMessages(
    organizationId: string,
    conversationId: string,
    page: number = 1,
    limit: number = 50,
  ) {
    // Verify conversation exists and belongs to organization
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const skip = (page - 1) * limit;

    const where: any = {
      conversationId,
    };

    const [data, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      this.prisma.messageLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Assign conversation to user
   */
  async assignConversation(
    organizationId: string,
    conversationId: string,
    assignedToId: string,
    userId: string,
    userRole: Role,
  ) {
    // Only ADMIN/MANAGER/OWNER can assign
    const allowedRoles: Role[] = [Role.ADMIN, Role.MANAGER, Role.OWNER];
    if (!allowedRoles.includes(userRole)) {
      throw new ForbiddenException('Only admins and managers can assign conversations');
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    // Verify assigned user is member of organization
    const membership = await this.prisma.membership.findFirst({
      where: {
        userId: assignedToId,
        organizationId,
      },
    });

    if (!membership) {
      throw new ForbiddenException('User is not a member of this organization');
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { assignedToId },
      include: {
        assignedTo: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });
  }

  /**
   * Mark conversation as read
   */
  async markConversationRead(
    organizationId: string,
    conversationId: string,
    userId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: {
        unreadCount: 0,
        lastReadAt: new Date(),
      },
    });
  }

  /**
   * Update conversation status
   */
  async updateConversationStatus(
    organizationId: string,
    conversationId: string,
    status: ConversationStatus,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    return this.prisma.conversation.update({
      where: { id: conversationId },
      data: { status },
    });
  }

  /**
   * Add tag to conversation
   */
  async addTagToConversation(
    organizationId: string,
    conversationId: string,
    tagId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const tag = await this.prisma.conversationTag.findFirst({
      where: {
        id: tagId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    // Check if link already exists
    const existingLink = await this.prisma.conversationTagLink.findUnique({
      where: {
        conversationId_tagId: {
          conversationId,
          tagId,
        },
      },
    });

    if (existingLink) {
      return existingLink; // Already linked
    }

    return this.prisma.conversationTagLink.create({
      data: {
        conversationId,
        tagId,
      },
      include: {
        tag: true,
      },
    });
  }

  /**
   * Remove tag from conversation
   */
  async removeTagFromConversation(
    organizationId: string,
    conversationId: string,
    tagId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    const link = await this.prisma.conversationTagLink.findUnique({
      where: {
        conversationId_tagId: {
          conversationId,
          tagId,
        },
      },
    });

    if (!link) {
      throw new NotFoundException('Tag not linked to conversation');
    }

    return this.prisma.conversationTagLink.delete({
      where: {
        conversationId_tagId: {
          conversationId,
          tagId,
        },
      },
    });
  }

  /**
   * CRUD for ConversationTag
   */
  async listTags(organizationId: string) {
    return this.prisma.conversationTag.findMany({
      where: {
        organizationId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
    });
  }

  async getTag(organizationId: string, tagId: string) {
    const tag = await this.prisma.conversationTag.findFirst({
      where: {
        id: tagId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    return tag;
  }

  async createTag(
    organizationId: string,
    name: string,
    color?: string,
  ) {
    // Check if tag with same name exists
    const existing = await this.prisma.conversationTag.findUnique({
      where: {
        organizationId_name: {
          organizationId,
          name,
        },
      },
    });

    if (existing && !existing.deletedAt) {
      throw new BadRequestException('Tag with this name already exists');
    }

    if (existing && existing.deletedAt) {
      // Restore soft-deleted tag
      return this.prisma.conversationTag.update({
        where: { id: existing.id },
        data: {
          deletedAt: null,
          color: color || existing.color,
        },
      });
    }

    return this.prisma.conversationTag.create({
      data: {
        organizationId,
        name,
        color,
      },
    });
  }

  async updateTag(
    organizationId: string,
    tagId: string,
    name?: string,
    color?: string,
  ) {
    const tag = await this.getTag(organizationId, tagId);

    if (name && name !== tag.name) {
      // Check if new name conflicts
      const existing = await this.prisma.conversationTag.findUnique({
        where: {
          organizationId_name: {
            organizationId,
            name,
          },
        },
      });

      if (existing && existing.id !== tagId) {
        throw new BadRequestException('Tag with this name already exists');
      }
    }

    return this.prisma.conversationTag.update({
      where: { id: tagId },
      data: {
        ...(name && { name }),
        ...(color !== undefined && { color }),
      },
    });
  }

  async deleteTag(organizationId: string, tagId: string) {
    const tag = await this.getTag(organizationId, tagId);

    return this.prisma.conversationTag.update({
      where: { id: tagId },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  /**
   * Get inbox metrics
   */
  async getMetrics(
    organizationId: string,
    filters: {
      provider?: IntegrationProvider;
      from?: Date;
      to?: Date;
    },
  ) {
    const where: any = {
      organizationId,
      deletedAt: null,
    };

    if (filters.provider) {
      where.provider = filters.provider;
    }

    if (filters.from || filters.to) {
      where.lastMessageAt = {};
      if (filters.from) {
        where.lastMessageAt.gte = filters.from;
      }
      if (filters.to) {
        where.lastMessageAt.lte = filters.to;
      }
    }

    const [openCount, pendingCount, closedCount, unreadTotal, conversations] = await Promise.all([
      this.prisma.conversation.count({
        where: { ...where, status: ConversationStatus.OPEN },
      }),
      this.prisma.conversation.count({
        where: { ...where, status: ConversationStatus.PENDING },
      }),
      this.prisma.conversation.count({
        where: { ...where, status: ConversationStatus.CLOSED },
      }),
      this.prisma.conversation.aggregate({
        where,
        _sum: {
          unreadCount: true,
        },
      }),
      this.prisma.conversation.findMany({
        where: {
          ...where,
          lastInboundAt: { not: null },
          lastOutboundAt: { not: null },
        },
        select: {
          lastInboundAt: true,
          lastOutboundAt: true,
        },
      }),
    ]);

    // Calculate avgFirstResponseMs
    let avgFirstResponseMs = 0;
    if (conversations.length > 0) {
      const responseTimes = conversations
        .filter((c) => c.lastInboundAt && c.lastOutboundAt)
        .map((c) => {
          const inbound = c.lastInboundAt!;
          const outbound = c.lastOutboundAt!;
          // Find first outbound after inbound
          if (outbound > inbound) {
            return outbound.getTime() - inbound.getTime();
          }
          return null;
        })
        .filter((t): t is number => t !== null);

      if (responseTimes.length > 0) {
        avgFirstResponseMs = Math.round(
          responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length,
        );
      }
    }

    // Calculate SLA breaches (default 60 minutes)
    const slaMinutes = parseInt(process.env.INBOX_SLA_MINUTES || '60', 10);
    const slaMs = slaMinutes * 60 * 1000;

    const responseSlaBreaches = conversations.filter((c) => {
      if (!c.lastInboundAt || !c.lastOutboundAt) {
        return false;
      }
      const responseTime = c.lastOutboundAt.getTime() - c.lastInboundAt.getTime();
      return responseTime > slaMs;
    }).length;

    return {
      openCount,
      pendingCount,
      closedCount,
      unreadTotal: unreadTotal._sum.unreadCount || 0,
      avgFirstResponseMs,
      responseSlaBreaches,
    };
  }

  /**
   * Check if template is required (outside 24h window)
   */
  private requiresTemplate(lastInboundAt: Date | null, lastOutboundAt: Date | null): boolean {
    if (!lastInboundAt) {
      return false;
    }

    // If there's an outbound message after the last inbound, we're in conversation window
    if (lastOutboundAt && lastOutboundAt > lastInboundAt) {
      return false;
    }

    // Check if last inbound is more than 24h ago
    const now = new Date();
    const hoursSinceLastInbound = (now.getTime() - lastInboundAt.getTime()) / (1000 * 60 * 60);
    return hoursSinceLastInbound > 24;
  }

  /**
   * Calculate SLA status
   */
  private calculateSlaStatus(
    lastInboundAt: Date | null,
    lastOutboundAt: Date | null,
  ): 'OK' | 'WARNING' | 'BREACH' {
    if (!lastInboundAt) {
      return 'OK';
    }

    const slaMinutes = parseInt(process.env.INBOX_SLA_MINUTES || '60', 10);
    const slaMs = slaMinutes * 60 * 1000;
    const warningThreshold = slaMs * 0.7; // 70% of SLA

    // If there's an outbound after inbound, check response time
    if (lastOutboundAt && lastOutboundAt > lastInboundAt) {
      const responseTime = lastOutboundAt.getTime() - lastInboundAt.getTime();
      if (responseTime > slaMs) {
        return 'BREACH';
      }
      if (responseTime > warningThreshold) {
        return 'WARNING';
      }
      return 'OK';
    }

    // No response yet, check time since last inbound
    const now = new Date();
    const timeSinceInbound = now.getTime() - lastInboundAt.getTime();
    if (timeSinceInbound > slaMs) {
      return 'BREACH';
    }
    if (timeSinceInbound > warningThreshold) {
      return 'WARNING';
    }
    return 'OK';
  }

  /**
   * Send text message from conversation
   */
  async sendTextMessage(
    organizationId: string,
    conversationId: string,
    text: string | undefined,
    userId: string,
    mediaUrl?: string,
    mediaType?: 'image' | 'document',
    caption?: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.status === ConversationStatus.CLOSED) {
      throw new BadRequestException('Cannot send message to closed conversation');
    }

    if (!conversation.phone && !conversation.handle) {
      throw new BadRequestException('Conversation has no phone or handle');
    }

    // Validation: must have either text or mediaUrl
    if (!text && !mediaUrl) {
      throw new BadRequestException('Either text or mediaUrl must be provided');
    }

    // Instagram doesn't support attachments yet
    if (mediaUrl && conversation.provider === IntegrationProvider.INSTAGRAM) {
      throw new BadRequestException('Attachments are not supported for Instagram yet');
    }

    // Prepare job payload
    const jobPayload: any = {
      toPhone: conversation.phone || conversation.handle,
      leadId: conversation.leadId,
      organizationId,
    };

    if (text) {
      jobPayload.text = text;
    }

    if (mediaUrl) {
      jobPayload.mediaUrl = mediaUrl;
      jobPayload.mediaType = mediaType;
      if (caption) {
        jobPayload.caption = caption;
      }
    }

    // Enqueue job to send message
    const job = await this.integrationQueueService.enqueue({
      jobType: IntegrationJobType.SEND_MESSAGE,
      provider: conversation.provider,
      payload: jobPayload,
      organizationId,
    });

    // Create MessageLog with media metadata if present
    const messageLogMetaJson: any = {};
    if (mediaUrl) {
      messageLogMetaJson.mediaUrl = mediaUrl;
      messageLogMetaJson.mediaType = mediaType;
      if (caption) {
        messageLogMetaJson.caption = caption;
      }
    }

    // Return the job (will be processed async)
    // For immediate response, we could wait, but async is better for UX
    return {
      jobId: job.id,
      status: 'queued',
      message: 'Message queued for sending',
    };
  }

  /**
   * Send template message from conversation
   */
  async sendTemplateMessage(
    organizationId: string,
    conversationId: string,
    templateId: string,
    variables: Record<string, string>,
    userId: string,
  ) {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        organizationId,
        deletedAt: null,
      },
    });

    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.status === ConversationStatus.CLOSED) {
      throw new BadRequestException('Cannot send message to closed conversation');
    }

    if (!conversation.phone && !conversation.handle) {
      throw new BadRequestException('Conversation has no phone or handle');
    }

    // Verify template exists and is approved
    const template = await this.prisma.whatsAppTemplate.findFirst({
      where: {
        id: templateId,
        organizationId,
        status: 'APPROVED',
        deletedAt: null,
      },
    });

    if (!template) {
      throw new NotFoundException('Template not found or not approved');
    }

    // Enqueue job to send template
    const job = await this.integrationQueueService.enqueue({
      jobType: IntegrationJobType.SEND_MESSAGE_TEMPLATE,
      provider: conversation.provider,
      payload: {
        templateId,
        toPhone: conversation.phone || conversation.handle,
        variables,
        leadId: conversation.leadId,
        organizationId,
      },
      organizationId,
    });

    return {
      jobId: job.id,
      status: 'queued',
      message: 'Template message queued for sending',
    };
  }

  /**
   * Retry failed message
   * Creates a new IntegrationJob and MessageLog based on the failed message's metadata
   */
  async retryFailedMessage(
    organizationId: string,
    messageId: string,
    userId: string,
  ) {
    // Find the failed message
    const failedMessage = await this.prisma.messageLog.findFirst({
      where: {
        id: messageId,
        provider: { in: [IntegrationProvider.WHATSAPP, IntegrationProvider.INSTAGRAM] },
        direction: MessageDirection.OUTBOUND,
        status: MessageStatus.FAILED,
      },
      include: {
        conversation: true,
      },
    });

    if (!failedMessage) {
      throw new NotFoundException('Failed message not found or not in FAILED status');
    }

    // Verify conversation belongs to organization
    if (failedMessage.conversation?.organizationId !== organizationId) {
      throw new ForbiddenException('Message does not belong to your organization');
    }

    // Verify conversation still exists and is not closed
    const conversation = failedMessage.conversation;
    if (!conversation) {
      throw new NotFoundException('Conversation not found');
    }

    if (conversation.status === ConversationStatus.CLOSED) {
      throw new BadRequestException('Cannot retry message in closed conversation');
    }

    // Idempotency check: verify there's no existing retry in QUEUED or PROCESSING status
    const existingRetry = await this.prisma.messageLog.findFirst({
      where: {
        conversationId: conversation.id,
        direction: MessageDirection.OUTBOUND,
        status: { in: [MessageStatus.QUEUED, MessageStatus.SENT] }, // SENT means job is processing
        metaJson: {
          path: ['retryOf'],
          equals: messageId,
        },
      },
    });

    if (existingRetry) {
      throw new BadRequestException(
        'A retry for this message is already in progress. Please wait for it to complete.',
      );
    }

    // Determine job type from metadata
    const metaJson = (failedMessage.metaJson as any) || {};
    const isTemplate = !!metaJson.templateId;
    const jobType = isTemplate
      ? IntegrationJobType.SEND_MESSAGE_TEMPLATE
      : IntegrationJobType.SEND_MESSAGE;

    // Prepare job payload
    const jobPayload: any = {
      toPhone: failedMessage.to,
      leadId: conversation.leadId,
      organizationId,
    };

    if (isTemplate) {
      jobPayload.templateId = metaJson.templateId;
      jobPayload.variables = metaJson.variables || {};
    } else {
      jobPayload.text = failedMessage.text;
      // Include media if present
      if (metaJson.mediaUrl) {
        jobPayload.mediaUrl = metaJson.mediaUrl;
        jobPayload.mediaType = metaJson.mediaType;
        jobPayload.caption = metaJson.caption;
      }
    }

    // Create new IntegrationJob
    const job = await this.integrationQueueService.enqueue({
      jobType,
      provider: failedMessage.provider,
      payload: jobPayload,
      organizationId,
    });

    // Create new MessageLog (new attempt, not reusing the failed one)
    const newMessageLog = await this.prisma.messageLog.create({
      data: {
        provider: failedMessage.provider,
        direction: MessageDirection.OUTBOUND,
        to: failedMessage.to,
        from: failedMessage.from,
        text: failedMessage.text,
        status: MessageStatus.QUEUED,
        conversationId: conversation.id,
        metaJson: {
          ...metaJson,
          retryOf: messageId, // Track original failed message
          retryOfMessageLogId: messageId, // Explicit field for easier querying
          jobId: job.id,
        },
      },
    });

    // Update conversation lastMessageAt
    await this.prisma.conversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastOutboundAt: new Date(),
      },
    });

    return {
      messageLogId: newMessageLog.id,
      jobId: job.id,
      status: 'queued',
      message: 'Message retry queued for sending',
    };
  }
}
