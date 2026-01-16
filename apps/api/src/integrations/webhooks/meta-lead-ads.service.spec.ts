import { Test, TestingModule } from '@nestjs/testing';
import { MetaLeadAdsService } from './meta-lead-ads.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { IntegrationProvider, WebhookEventStatus, LeadStatus } from '@remember-me/prisma';
import { BadRequestException } from '@nestjs/common';

describe('MetaLeadAdsService', () => {
  let service: MetaLeadAdsService;
  let prisma: PrismaService;

  const mockPrismaService = {
    connectedAccount: {
      findFirst: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    webhookEvent: {
      create: jest.fn(),
      update: jest.fn(),
    },
    lead: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    pipeline: {
      findFirst: jest.fn(),
    },
    stage: {
      findFirst: jest.fn(),
    },
    membership: {
      findFirst: jest.fn(),
    },
    note: {
      create: jest.fn(),
    },
    conversation: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('development'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetaLeadAdsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<MetaLeadAdsService>(MetaLeadAdsService);
    prisma = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  describe('processWebhook', () => {
    it('should throw BadRequestException when entry array is empty', async () => {
      const payload = {
        entry: [],
      };

      await expect(service.processWebhook(payload)).rejects.toThrow(BadRequestException);
    });

    it('should process leadgen event and create lead', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                adset_id: 'adset-101',
                campaign_id: 'campaign-202',
                form_id: 'form-303',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                  { name: 'email', values: ['john@example.com'] },
                  { name: 'phone_number', values: ['+1234567890'] },
                  { name: 'city', values: ['New York'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.lead.create.mockResolvedValue({
        id: 'lead-1',
        name: 'John Doe',
        email: 'john@example.com',
        phone: '+1234567890',
        tags: ['META_ADS'],
      });
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockPrismaService.webhookEvent.update.mockResolvedValue({ id: 'event-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.webhookEvent.create).toHaveBeenCalled();
      expect(mockPrismaService.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
            city: 'New York',
            source: 'meta_ads',
            tags: ['META_ADS'],
            customFields: expect.objectContaining({
              metaLeadgenId: 'leadgen-456',
              metaAdId: 'ad-789',
              metaCampaignId: 'campaign-202',
            }),
          }),
        }),
      );
      expect(mockPrismaService.note.create).toHaveBeenCalled();
    });

    it('should resolve organizationId from ConnectedAccount', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue({
        id: 'account-1',
        organizationId: 'org-2',
      });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.lead.create.mockResolvedValue({ id: 'lead-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockPrismaService.webhookEvent.update.mockResolvedValue({ id: 'event-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            organizationId: 'org-2',
          }),
        }),
      );
    });

    it('should skip duplicate leads', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([
        {
          id: 'existing-lead',
          customFields: { metaLeadgenId: 'leadgen-456' },
        },
      ]);

      await service.processWebhook(payload);

      expect(mockPrismaService.lead.create).not.toHaveBeenCalled();
    });

    it('should extract lead data from field_data correctly', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'first_name', values: ['John'] },
                  { name: 'last_name', values: ['Doe'] },
                  { name: 'email', values: ['john@example.com'] },
                  { name: 'phone_number', values: ['+1234567890'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.lead.create.mockResolvedValue({ id: 'lead-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockPrismaService.webhookEvent.update.mockResolvedValue({ id: 'event-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'John Doe',
            email: 'john@example.com',
            phone: '+1234567890',
          }),
        }),
      );
    });

    it('should add META_ADS tag automatically', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.lead.create.mockResolvedValue({ id: 'lead-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockPrismaService.webhookEvent.update.mockResolvedValue({ id: 'event-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: ['META_ADS'],
          }),
        }),
      );
    });

    it('should save source attribution in customFields', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                adset_id: 'adset-101',
                campaign_id: 'campaign-202',
                form_id: 'form-303',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.lead.create.mockResolvedValue({ id: 'lead-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockPrismaService.webhookEvent.update.mockResolvedValue({ id: 'event-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              metaLeadgenId: 'leadgen-456',
              metaAdId: 'ad-789',
              metaAdsetId: 'adset-101',
              metaCampaignId: 'campaign-202',
              metaFormId: 'form-303',
              metaPageId: 'page-123',
            }),
          }),
        }),
      );
    });

    it('should link lead with existing conversation if phone matches', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                  { name: 'phone_number', values: ['+1234567890'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.lead.create.mockResolvedValue({ id: 'lead-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        leadId: null,
      });
      mockPrismaService.conversation.update.mockResolvedValue({ id: 'conv-1', leadId: 'lead-1' });
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockPrismaService.webhookEvent.update.mockResolvedValue({ id: 'event-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { leadId: 'lead-1' },
      });
    });

    it('should not link conversation if it already has a leadId', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                  { name: 'phone_number', values: ['+1234567890'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.lead.create.mockResolvedValue({ id: 'lead-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue({
        id: 'conv-1',
        leadId: 'existing-lead-id',
      });
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockPrismaService.webhookEvent.update.mockResolvedValue({ id: 'event-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.conversation.update).not.toHaveBeenCalled();
    });

    it('should handle missing pipeline gracefully', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue(null);

      await service.processWebhook(payload);

      expect(mockPrismaService.lead.create).not.toHaveBeenCalled();
    });

    it('should handle missing stage gracefully', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue(null);

      await service.processWebhook(payload);

      expect(mockPrismaService.lead.create).not.toHaveBeenCalled();
    });

    it('should handle missing admin user gracefully', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.membership.findFirst.mockResolvedValue(null);

      await service.processWebhook(payload);

      expect(mockPrismaService.lead.create).not.toHaveBeenCalled();
    });

    it('should create note with campaign and ad information', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                campaign_id: 'campaign-202',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.lead.create.mockResolvedValue({ id: 'lead-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockPrismaService.webhookEvent.update.mockResolvedValue({ id: 'event-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.note.create).toHaveBeenCalled();
      const noteCall = mockPrismaService.note.create.mock.calls[0][0];
      expect(noteCall.data.content).toContain('Meta Ads');
      expect(noteCall.data.content).toContain('campaign-202');
      expect(noteCall.data.content).toContain('ad-789');
    });

    it('should store additional field_data in customFields', async () => {
      const payload = {
        entry: [
          {
            id: 'page-123',
            leadgen: [
              {
                id: 'leadgen-456',
                ad_id: 'ad-789',
                created_time: '2024-01-15T10:00:00Z',
                field_data: [
                  { name: 'full_name', values: ['John Doe'] },
                  { name: 'custom_field', values: ['custom_value'] },
                  { name: 'another_field', value: 'another_value' },
                ],
              },
            ],
          },
        ],
      };

      mockPrismaService.connectedAccount.findFirst.mockResolvedValue(null);
      mockPrismaService.organization.findFirst.mockResolvedValue({ id: 'org-1' });
      mockPrismaService.lead.findMany.mockResolvedValue([]);
      mockPrismaService.webhookEvent.create.mockResolvedValue({ id: 'event-1' });
      mockPrismaService.pipeline.findFirst.mockResolvedValue({ id: 'pipeline-1' });
      mockPrismaService.stage.findFirst.mockResolvedValue({ id: 'stage-1' });
      mockPrismaService.membership.findFirst.mockResolvedValue({ userId: 'user-1' });
      mockPrismaService.lead.create.mockResolvedValue({ id: 'lead-1' });
      mockPrismaService.conversation.findFirst.mockResolvedValue(null);
      mockPrismaService.note.create.mockResolvedValue({ id: 'note-1' });
      mockPrismaService.webhookEvent.update.mockResolvedValue({ id: 'event-1' });

      await service.processWebhook(payload);

      expect(mockPrismaService.lead.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            customFields: expect.objectContaining({
              meta_custom_field: 'custom_value',
              meta_another_field: 'another_value',
            }),
          }),
        }),
      );
    });
  });
});
