import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ConversationPage from '@/app/inbox/[conversationId]/page';
import { useAuthStore } from '@/lib/store/auth-store';
import { useConversation } from '@/lib/api/hooks/use-conversation';
import { useMessages } from '@/lib/api/hooks/use-messages';
import { useOrgUsers } from '@/lib/api/hooks/use-org-users';
import { api } from '@/lib/api/client';
import { Conversation, Message, User } from '@/types/api';

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
  }),
  useParams: () => ({
    conversationId: 'conv-1',
  }),
}));
jest.mock('@/lib/store/auth-store', () => ({
  useAuthStore: () => ({
    user: { id: 'user-1', organizationId: 'org-1', name: 'Test User' },
  }),
}));
jest.mock('@/lib/api/hooks/use-conversation');
jest.mock('@/lib/api/hooks/use-messages');
jest.mock('@/lib/api/hooks/use-org-users');
jest.mock('@/lib/api/client');

describe('ConversationPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
        },
      },
    });
    jest.clearAllMocks();
  });

  const mockConversation: Conversation = {
    id: 'conv-1',
    organizationId: 'org-1',
    provider: 'WHATSAPP',
    status: 'OPEN',
    lastMessageAt: new Date().toISOString(),
    unreadCount: 0,
    previewText: 'Hello there!',
    lastMessageDirection: 'INBOUND',
    assignedUser: { id: 'user-1', name: 'Test User' },
    lead: { id: 'lead-1', name: 'Test Lead', stage: { id: 'stage-1', name: 'New' } },
    tags: [{ id: 'tag-1', name: 'VIP', color: '#FF0000', organizationId: 'org-1', createdAt: new Date().toISOString() }],
    canReply: true,
    requiresTemplate: false,
    slaStatus: 'OK',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const mockMessages: Message[] = [
    {
      id: 'msg-1',
      conversationId: 'conv-1',
      direction: 'INBOUND',
      from: '+1234567890',
      to: '+0987654321',
      text: 'Hi!',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      provider: 'WHATSAPP',
    },
  ];

  const mockOrgUsers: User[] = [
    { id: 'user-1', email: 'user1@example.com', name: 'User 1', role: 'ADMIN', joinedAt: new Date().toISOString(), avatar: null },
    { id: 'user-2', email: 'user2@example.com', name: 'User 2', role: 'SELLER', joinedAt: new Date().toISOString(), avatar: null },
  ];

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  it('renders conversation details and messages', async () => {
    (useConversation as jest.Mock).mockReturnValue({
      data: mockConversation,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useMessages as jest.Mock).mockReturnValue({
      data: { data: mockMessages, meta: { total: 1, page: 1, limit: 50, totalPages: 1 } },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useOrgUsers as jest.Mock).mockReturnValue({
      data: mockOrgUsers,
      isLoading: false,
      error: null,
    });
    (api.get as jest.Mock).mockResolvedValue({ data: [] }); // For tags picker

    render(
      <Wrapper>
        <ConversationPage />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Test Lead')).toBeInTheDocument();
      expect(screen.getByText('Hi!')).toBeInTheDocument();
    });
  });

  it('renders users in assign dropdown', async () => {
    (useConversation as jest.Mock).mockReturnValue({
      data: mockConversation,
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useMessages as jest.Mock).mockReturnValue({
      data: { data: mockMessages, meta: { total: 1, page: 1, limit: 50, totalPages: 1 } },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useOrgUsers as jest.Mock).mockReturnValue({
      data: mockOrgUsers,
      isLoading: false,
      error: null,
    });
    (api.get as jest.Mock).mockResolvedValue({ data: [] }); // For tags picker

    render(
      <Wrapper>
        <ConversationPage />
      </Wrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('Sin asignar')).toBeInTheDocument();
      expect(screen.getByText('User 1 (ADMIN)')).toBeInTheDocument();
      expect(screen.getByText('User 2 (SELLER)')).toBeInTheDocument();
    });
  });

  it('assigns user and refreshes conversation', async () => {
    const refetchConversationMock = jest.fn();
    (useConversation as jest.Mock).mockReturnValue({
      data: mockConversation,
      isLoading: false,
      error: null,
      refetch: refetchConversationMock,
    });
    (useMessages as jest.Mock).mockReturnValue({
      data: { data: mockMessages, meta: { total: 1, page: 1, limit: 50, totalPages: 1 } },
      isLoading: false,
      error: null,
      refetch: jest.fn(),
    });
    (useOrgUsers as jest.Mock).mockReturnValue({
      data: mockOrgUsers,
      isLoading: false,
      error: null,
    });
    (api.patch as jest.Mock).mockResolvedValue({});
    (api.get as jest.Mock).mockResolvedValue({ data: [] }); // For tags picker

    render(
      <Wrapper>
        <ConversationPage />
      </Wrapper>
    );

    await waitFor(() => expect(screen.getByText('Sin asignar')).toBeInTheDocument());

    const select = screen.getByLabelText('Asignar a:');
    fireEvent.change(select, { target: { value: 'user-2' } });

    await waitFor(() => {
      expect(api.patch).toHaveBeenCalledWith('/inbox/conversations/conv-1/assign', {
        assignedToId: 'user-2',
      });
      expect(refetchConversationMock).toHaveBeenCalled();
    });
  });
});
