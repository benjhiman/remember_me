'use client';

import { Suspense, useEffect, useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useOrgSettings } from '@/lib/api/hooks/use-org-settings';
import { useConversationsInfinite } from '@/lib/api/hooks/use-conversations-infinite';
import { EnterpriseChatListItem } from '@/components/inbox/enterprise-chat-list-item';
import { InboxHeader } from '@/components/inbox/inbox-header';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MessageSquare, Instagram, MessageCircle, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { perfMark, perfMeasureToNow } from '@/lib/utils/perf';
import { VirtualizedConversationList } from '@/components/inbox/virtualized-conversation-list';
import type { ConversationStatus } from '@/types/api';
import { Skeleton } from '@/components/ui/skeleton';

function InboxUnifiedInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { data: settings } = useOrgSettings(!!user);

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState<ConversationStatus | undefined>(undefined);
  const [providerFilter, setProviderFilter] = useState<'ALL' | 'WHATSAPP' | 'INSTAGRAM'>('ALL');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const assignedToId =
    user?.role === 'SELLER' && settings?.crm.inbox.sellerSeesOnlyAssigned ? user.id : undefined;

  const {
    data: whatsappData,
    isLoading: whatsappLoading,
    fetchNextPage: fetchNextWhatsApp,
    hasNextPage: hasNextWhatsApp,
    isFetchingNextPage: isFetchingNextWhatsApp,
  } = useConversationsInfinite({
    provider: 'WHATSAPP',
    q: debouncedQ || undefined,
    status,
    assignedToId,
    limit: 50,
    enabled: !!user && (providerFilter === 'ALL' || providerFilter === 'WHATSAPP'),
  });

  const {
    data: instagramData,
    isLoading: instagramLoading,
    fetchNextPage: fetchNextInstagram,
    hasNextPage: hasNextInstagram,
    isFetchingNextPage: isFetchingNextInstagram,
  } = useConversationsInfinite({
    provider: 'INSTAGRAM',
    q: debouncedQ || undefined,
    status,
    assignedToId,
    limit: 50,
    enabled: !!user && (providerFilter === 'ALL' || providerFilter === 'INSTAGRAM'),
  });

  const whatsappList = whatsappData
    ? { data: whatsappData.pages.flatMap((p: any) => p.data) }
    : undefined;
  const instagramList = instagramData
    ? { data: instagramData.pages.flatMap((p: any) => p.data) }
    : undefined;

  const allConversations = useMemo(() => {
    const all: Array<{ conversation: any; provider: 'WHATSAPP' | 'INSTAGRAM' }> = [];
    if (whatsappList?.data) {
      whatsappList.data.forEach((c) => all.push({ conversation: c, provider: 'WHATSAPP' }));
    }
    if (instagramList?.data) {
      instagramList.data.forEach((c) => all.push({ conversation: c, provider: 'INSTAGRAM' }));
    }
    // Sort by lastMessageAt descending
    all.sort((a, b) => {
      const aTime = new Date(a.conversation.lastMessageAt || 0).getTime();
      const bTime = new Date(b.conversation.lastMessageAt || 0).getTime();
      return bTime - aTime;
    });
    return all;
  }, [whatsappList?.data, instagramList?.data]);

  const isLoading = whatsappLoading || instagramLoading;

  useEffect(() => {
    perfMark('inbox-list-mount');
  }, []);

  useEffect(() => {
    if (allConversations.length > 0 && !isLoading) {
      perfMeasureToNow('inbox-list-data-loaded', 'inbox-list-mount');
    }
  }, [allConversations.length, isLoading]);

  // Auth is handled by RouteGuard in layout
  // No need to check here to avoid double redirects

  const handleSelectConversation = (id: string, provider: 'WHATSAPP' | 'INSTAGRAM') => {
    const href = provider === 'WHATSAPP' ? '/inbox/whatsapp' : '/inbox/instagram';
    router.push(`${href}?conversationId=${id}`);
  };

  return (
    <div className="flex flex-col h-full">
      <InboxHeader currentChannel="unified" />
      <div className="flex-1 flex flex-col bg-background">
        {/* Filters */}
        <div className="p-4 border-b bg-background space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar conversaciones..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
              }}
              className="flex-1"
            />
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant={providerFilter === 'ALL' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setProviderFilter('ALL')}
              className="h-8 text-xs"
            >
              <MessageCircle className="h-3 w-3 mr-1" />
              Todos
            </Button>
            <Button
              variant={providerFilter === 'WHATSAPP' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setProviderFilter('WHATSAPP')}
              className="h-8 text-xs"
            >
              <MessageSquare className="h-3 w-3 mr-1" />
              WhatsApp
            </Button>
            <Button
              variant={providerFilter === 'INSTAGRAM' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setProviderFilter('INSTAGRAM')}
              className="h-8 text-xs"
            >
              <Instagram className="h-3 w-3 mr-1" />
              Instagram
            </Button>
            {(['OPEN', 'PENDING', 'CLOSED'] as const).map((s) => (
              <Button
                key={s}
                variant={status === s ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setStatus(status === s ? undefined : s);
                }}
                className="h-8 text-xs capitalize"
              >
                {s.toLowerCase()}
              </Button>
            ))}
          </div>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-hidden">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : allConversations.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center p-8 text-center">
              <div className="mb-4">
                <MessageCircle className="h-12 w-12 text-muted-foreground/40 mx-auto" />
              </div>
              <h3 className="text-sm font-semibold text-foreground mb-1">No hay conversaciones</h3>
              <p className="text-xs text-muted-foreground max-w-xs">
                {q || status || providerFilter !== 'ALL'
                  ? 'No se encontraron conversaciones con los filtros aplicados.'
                  : 'Las conversaciones de todos los canales aparecerán aquí.'}
              </p>
            </div>
          ) : allConversations.length > 50 ? (
            <VirtualizedConversationList
              items={allConversations}
              renderItem={({ conversation, provider }, index) => (
                <div
                  key={`${provider}-${conversation.id}`}
                  className="hover:bg-muted/50 transition-colors cursor-pointer border-b"
                  onClick={() => handleSelectConversation(conversation.id, provider)}
                >
                  <div className="p-4 flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {provider === 'WHATSAPP' ? (
                        <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-white" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 flex items-center justify-center">
                          <Instagram className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold truncate">
                          {conversation.lead?.name || conversation.phone || conversation.handle || 'Sin nombre'}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            provider === 'WHATSAPP'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-purple-100 text-purple-800'
                          )}
                        >
                          {provider === 'WHATSAPP' ? 'WA' : 'IG'}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            conversation.status === 'OPEN'
                              ? 'bg-blue-100 text-blue-800'
                              : conversation.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          )}
                        >
                          {conversation.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conversation.lastMessage?.text || 'Sin mensajes'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-xs text-muted-foreground">
                      {conversation.lastMessageAt
                        ? new Date(conversation.lastMessageAt).toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </div>
                  </div>
                </div>
              )}
              estimateSize={() => 80}
              overscan={10}
            />
          ) : (
            <div className="divide-y overflow-y-auto h-full">
              {allConversations.map(({ conversation, provider }) => (
                <div
                  key={`${provider}-${conversation.id}`}
                  className="hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleSelectConversation(conversation.id, provider)}
                >
                  <div className="p-4 flex items-center gap-3">
                    <div className="flex-shrink-0">
                      {provider === 'WHATSAPP' ? (
                        <div className="h-10 w-10 rounded-full bg-green-500 flex items-center justify-center">
                          <MessageSquare className="h-5 w-5 text-white" />
                        </div>
                      ) : (
                        <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-600 flex items-center justify-center">
                          <Instagram className="h-5 w-5 text-white" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold truncate">
                          {conversation.lead?.name || conversation.phone || conversation.handle || 'Sin nombre'}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            provider === 'WHATSAPP'
                              ? 'bg-green-100 text-green-800'
                              : 'bg-purple-100 text-purple-800'
                          )}
                        >
                          {provider === 'WHATSAPP' ? 'WA' : 'IG'}
                        </span>
                        <span
                          className={cn(
                            'text-[10px] px-2 py-0.5 rounded-full font-medium',
                            conversation.status === 'OPEN'
                              ? 'bg-blue-100 text-blue-800'
                              : conversation.status === 'PENDING'
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-gray-100 text-gray-800'
                          )}
                        >
                          {conversation.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {conversation.lastMessage?.text || 'Sin mensajes'}
                      </p>
                    </div>
                    <div className="flex-shrink-0 text-xs text-muted-foreground">
                      {conversation.lastMessageAt
                        ? new Date(conversation.lastMessageAt).toLocaleTimeString('es-AR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InboxUnified() {
  return (
    <Suspense fallback={<div className="h-full flex items-center justify-center">Cargando...</div>}>
      <InboxUnifiedInner />
    </Suspense>
  );
}
