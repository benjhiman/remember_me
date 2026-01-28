'use client';

import { useState, useMemo } from 'react';
import { InboxThreadList } from '@/components/inbox/inbox-thread-list';
import { InboxConversation } from '@/components/inbox/inbox-conversation';
import { InboxEmptyState } from '@/components/inbox/inbox-empty-state';
import { threadsByChannel, messagesByThreadId, type Thread } from '@/lib/inbox/mock';

export default function InboxUnificadoPage() {
  const [selectedThreadId, setSelectedThreadId] = useState<string | undefined>(undefined);

  // Get unified threads (all channels mixed)
  const unifiedThreads = useMemo(() => {
    const allThreads: Thread[] = [];
    // Combine WhatsApp and Instagram threads
    allThreads.push(...threadsByChannel.whatsapp);
    allThreads.push(...threadsByChannel.instagram);
    // Sort by updatedAt descending (most recent first)
    allThreads.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
    return allThreads;
  }, []);

  const selectedThread = selectedThreadId ? unifiedThreads.find((t) => t.id === selectedThreadId) : undefined;
  const selectedMessages = selectedThreadId ? messagesByThreadId[selectedThreadId] || [] : [];

  const handleSendMessage = (text: string) => {
    // Mock: In a real implementation, this would send to the API
    console.log('Sending message:', text, 'to thread:', selectedThreadId);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Thread List */}
        <div className="w-80 flex-shrink-0">
          <InboxThreadList
            threads={unifiedThreads}
            selectedThreadId={selectedThreadId}
            onSelectThread={setSelectedThreadId}
          />
        </div>

        {/* Right: Conversation */}
        <div className="flex-1 flex flex-col">
          {selectedThread ? (
            <InboxConversation
              thread={selectedThread}
              messages={selectedMessages}
              onSendMessage={handleSendMessage}
            />
          ) : (
            <InboxEmptyState channel="unificado" />
          )}
        </div>
      </div>
    </div>
  );
}
