import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import InboxPage from '@/app/inbox/page';
import { useConversations } from '@/lib/api/hooks/use-conversations';
import { api } from '@/lib/api/client';

jest.mock('@/lib/api/hooks/use-conversations');
jest.mock('@/lib/api/client');
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
  }),
}));
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', organizationId: 'org-1' },
  }),
}));

describe('InboxPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    jest.clearAllMocks();
  });

  it('renders conversation list with filters', async () => {
    (useConversations as jest.Mock).mockReturnValue({
      data: {
        data: [
          {
            id: 'conv-1',
            organizationId: 'org-1',
            provider: 'WHATSAPP',
            status: 'OPEN',
            unreadCount: 2,
            slaStatus: 'OK',
            tags: [],
            lead: { id: 'lead-1', name: 'Test Lead' },
            lastMessageAt: new Date().toISOString(),
            canReply: true,
            requiresTemplate: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        ],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      },
      isLoading: false,
      error: null,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const Wrapper = wrapper;
    render(
      <Wrapper>
        <InboxPage />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Inbox')).toBeInTheDocument();
      expect(screen.getByText('Test Lead')).toBeInTheDocument();
    });
  });

  it('renders empty state when no conversations', async () => {
    (useConversations as jest.Mock).mockReturnValue({
      data: { data: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      isLoading: false,
      error: null,
    });

    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children);

    const Wrapper = wrapper;
    render(
      <Wrapper>
        <InboxPage />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/No hay conversaciones/)).toBeInTheDocument();
    });
  });
});
