import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationProvider, ConnectedAccountStatus, MessageDirection } from '@remember-me/prisma';
import { IntegrationQueueService } from './jobs/queue/integration-queue.service';
import { IntegrationJobType } from '@remember-me/prisma';

@Injectable()
export class IntegrationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly integrationQueueService: IntegrationQueueService,
  ) {}

  async listConnectedAccounts(organizationId: string) {
    return this.prisma.connectedAccount.findMany({
      where: {
        organizationId,
      },
      include: {
        oauthTokens: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async connectAccount(
    organizationId: string,
    provider: IntegrationProvider,
    externalAccountId: string,
    displayName?: string,
  ) {
    // STUB: Create connected account without real OAuth flow
    // TODO: Implement real OAuth flow for each provider
    return this.prisma.connectedAccount.create({
      data: {
        organizationId,
        provider,
        externalAccountId,
        displayName: displayName || `${provider} Account`,
        status: ConnectedAccountStatus.CONNECTED,
      },
      include: {
        oauthTokens: true,
      },
    });
  }

  async disconnectAccount(organizationId: string, accountId: string) {
    const account = await this.prisma.connectedAccount.findFirst({
      where: {
        id: accountId,
        organizationId,
      },
    });

    if (!account) {
      throw new NotFoundException('Connected account not found');
    }

    return this.prisma.connectedAccount.update({
      where: { id: accountId },
      data: {
        status: ConnectedAccountStatus.DISCONNECTED,
      },
    });
  }

  async sendWhatsAppMessage(
    organizationId: string,
    toPhone: string,
    text: string,
    leadId?: string,
  ) {
    // Enqueue SEND_MESSAGE job
    const job = await this.integrationQueueService.enqueue({
      jobType: IntegrationJobType.SEND_MESSAGE,
      provider: IntegrationProvider.WHATSAPP,
      payload: {
        toPhone,
        text,
        leadId,
        organizationId,
      },
      organizationId,
    });

    return {
      jobId: job.id,
      status: job.status,
      message: 'Message queued for sending',
    };
  }

  async listMessages(
    organizationId: string,
    leadId?: string,
    page: number = 1,
    limit: number = 20,
  ) {
    const skip = (page - 1) * limit;

    const where: any = {
      provider: IntegrationProvider.WHATSAPP,
    };

    // If leadId provided, filter by lead's phone
    if (leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: {
          id: leadId,
          organizationId,
          deletedAt: null,
        },
      });

      if (lead && lead.phone) {
        where.OR = [
          { from: lead.phone },
          { to: lead.phone },
        ];
      } else {
        // Lead not found or no phone, return empty
        return {
          data: [],
          total: 0,
          page,
          limit,
        };
      }
    }

    const [data, total] = await Promise.all([
      this.prisma.messageLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
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
}
