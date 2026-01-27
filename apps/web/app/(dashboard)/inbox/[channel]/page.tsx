'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useOrgStore } from '@/lib/store/org-store';
import { InboxThreadList } from '@/components/inbox/inbox-thread-list';
import { InboxConversation } from '@/components/inbox/inbox-conversation';
import { InboxEmptyState } from '@/components/inbox/inbox-empty-state';
import { Loader2 } from 'lucide-react';
import { threadsByChannel, messagesByThreadId, type Channel, type Thread, type Message } from '@/lib/inbox/mock';

export default function InboxChannelPage({ params }: { params: { channel: string } }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { currentOrganization, isLoading } = useOrgStore();

  const channel = (params.channel as Channel) || 'unificado';
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>(
    searchParams.get('thread') || undefined
  );

  // Update URL when thread is selected
  useEffect(() => {
    if (selectedThreadId) {
      const newUrl = `/inbox/${channel}${selectedThreadId ? `?thread=${selectedThreadId}` : ''}`;
      router.replace(newUrl, { scroll: false });
    }
  }, [selectedThreadId, channel, router]);

  // HARDENING: Don't render Inbox UI without active organization
  if (isLoading || !currentOrganization) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">Cargando organización...</div>
        </div>
      </div>
    );
  }

  // Validate channel
  const validChannels: Channel[] = ['whatsapp', 'instagram', 'unificado'];
  if (!validChannels.includes(channel)) {
    router.replace('/inbox/unificado');
    return null;
  }

  const threads = threadsByChannel[channel] || [];
  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const messages = selectedThreadId ? messagesByThreadId[selectedThreadId] || [] : [];

  const handleSelectThread = (threadId: string) => {
    setSelectedThreadId(threadId);
  };

  const handleSendMessage = (text: string) => {
    // Mock: Add message to thread
    // In real implementation, this would call an API
    console.log('Sending message:', { threadId: selectedThreadId, text });
    // For now, just log - API integration will come later
  };

  return (
    <div className="flex h-full">
      {/* Thread List - Left Column */}
      <div className="w-80 flex-shrink-0 border-r border-border">
        <InboxThreadList
          threads={threads}
          selectedThreadId={selectedThreadId}
          onSelectThread={handleSelectThread}
        />
      </div>

      {/* Conversation Panel - Right Column */}
      <div className="flex-1 min-w-0">
        {selectedThread && messages.length > 0 ? (
          <InboxConversation thread={selectedThread} messages={messages} onSendMessage={handleSendMessage} />
        ) : (
          <InboxEmptyState channel={channel} />
        )}
      </div>
    </div>
  );
}
