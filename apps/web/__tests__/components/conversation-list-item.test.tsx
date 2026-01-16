import { render, screen } from '@testing-library/react';
import { ConversationListItem } from '@/components/inbox/conversation-list-item';
import type { Conversation } from '@/types/api';

describe('ConversationListItem', () => {
  const mockConversation: Conversation = {
    id: 'conv-1',
    organizationId: 'org-1',
    provider: 'WHATSAPP',
    status: 'OPEN',
    unreadCount: 3,
    slaStatus: 'WARNING',
    canReply: true,
    requiresTemplate: false,
    tags: [
      { id: 'tag-1', name: 'VIP', color: '#FF5733' },
      { id: 'tag-2', name: 'Urgente', color: '#FF0000' },
      { id: 'tag-3', name: 'Follow-up', color: '#00FF00' },
      { id: 'tag-4', name: 'Tag 4', color: '#0000FF' },
    ],
    lead: { id: 'lead-1', name: 'Test Lead' },
    lastMessageAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('renders conversation with all badges', () => {
    render(<ConversationListItem conversation={mockConversation} onClick={jest.fn()} />);

    expect(screen.getByText('Test Lead')).toBeInTheDocument();
    expect(screen.getByText('WA')).toBeInTheDocument(); // Provider badge
    expect(screen.getByText('open')).toBeInTheDocument(); // Status badge
    expect(screen.getByText('3')).toBeInTheDocument(); // Unread count
    expect(screen.getByText('SLA: WARNING')).toBeInTheDocument();
  });

  it('shows max 3 tags with +N indicator', () => {
    render(<ConversationListItem conversation={mockConversation} onClick={jest.fn()} />);

    expect(screen.getByText('VIP')).toBeInTheDocument();
    expect(screen.getByText('Urgente')).toBeInTheDocument();
    expect(screen.getByText('Follow-up')).toBeInTheDocument();
    expect(screen.getByText('+1')).toBeInTheDocument(); // 4th tag shown as +1
  });
});
