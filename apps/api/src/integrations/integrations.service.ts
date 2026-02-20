import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { IntegrationProvider, ConnectedAccountStatus } from '@remember-me/prisma';
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

}
