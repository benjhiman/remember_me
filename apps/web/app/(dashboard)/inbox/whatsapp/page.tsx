'use client';

import { Suspense, useEffect, useMemo, useRef, useState, useCallback, memo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useOrgSettings } from '@/lib/api/hooks/use-org-settings';
import { useConversationsInfinite } from '@/lib/api/hooks/use-conversations-infinite';
import { useConversation } from '@/lib/api/hooks/use-conversation';
import { useMessages } from '@/lib/api/hooks/use-messages';
import { useOrgUsers } from '@/lib/api/hooks/use-org-users';
import { api } from '@/lib/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EnterpriseChatListItem } from '@/components/inbox/enterprise-chat-list-item';
import { groupByDay, formatTimeHHMM } from '@/lib/utils/inbox-format';
import { cn } from '@/lib/utils/cn';
import { perfMark, perfMeasureToNow } from '@/lib/utils/perf';
import { VirtualizedConversationList } from '@/components/inbox/virtualized-conversation-list';
import type { ConversationStatus, Message } from '@/types/api';
import { InboxHeader } from '@/components/inbox/inbox-header';
import { MessageSquare } from 'lucide-react';
import Image from 'next/image';

function InboxWhatsAppInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();
  const { data: settings } = useOrgSettings(!!user);

  const canManage = user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const canSellerReassign = !!settings?.crm.permissions.sellerCanReassignConversation;
  const canSellerChangeStatus = !!settings?.crm.permissions.sellerCanChangeConversationStatus;

  const conversationId = searchParams.get('conversationId') || '';

  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [status, setStatus] = useState<ConversationStatus | undefined>(undefined);
  const [leftWidth, setLeftWidth] = useState<number>(380);
  const resizingRef = useRef(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!resizingRef.current) return;
      const min = 320;
      const max = 520;
      setLeftWidth((prev) => {
        const next = Math.min(max, Math.max(min, e.clientX - 24));
        return Number.isFinite(next) ? next : prev;
      });
    };
    const onUp = () => {
      resizingRef.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const assignedToId =
    user?.role === 'SELLER' && settings?.crm.inbox.sellerSeesOnlyAssigned ? user.id : undefined;

  const {
    data: convListData,
    isLoading: listLoading,
    fetchNextPage: fetchNextConversations,
    hasNextPage: hasNextConversations,
    isFetchingNextPage: isFetchingNextConversations,
  } = useConversationsInfinite({
    provider: 'WHATSAPP',
    q: debouncedQ || undefined,
    status,
    assignedToId,
    limit: 50,
    enabled: !!user,
  });

  const convList = convListData
    ? { data: convListData.pages.flatMap((p) => p.data) }
    : undefined;

  useEffect(() => {
    perfMark('inbox-whatsapp-mount');
  }, []);

  useEffect(() => {
    if (convList && !listLoading) {
      perfMeasureToNow('inbox-whatsapp-data-loaded', 'inbox-whatsapp-mount');
    }
  }, [convList, listLoading]);

  const { data: conversation, refetch: refetchConversation } = useConversation(conversationId, !!user && !!conversationId);
  const { data: orgUsers = [] } = useOrgUsers(!!user);

  const [beforeCursor, setBeforeCursor] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const { data: messagesData, isFetching } = useMessages({
    conversationId,
    page: 1,
    limit: 60,
    before: beforeCursor,
    enabled: !!user && !!conversationId,
  });

  useEffect(() => {
    if (!messagesData?.data) return;
    setMessages((prev) => {
      const map = new Map<string, Message>();
      const merged = [...messagesData.data, ...prev];
      for (const m of merged) map.set(m.id, m);
      const arr = Array.from(map.values());
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return arr;
    });
  }, [messagesData?.data]);

  const nextBefore = (messagesData as any)?.nextBefore as string | null | undefined;

  useEffect(() => {
    if (!containerRef.current) return;
    if (!isAtBottom) return;
    containerRef.current.scrollTop = containerRef.current.scrollHeight;
  }, [messages.length, isAtBottom]);

  // Auth is handled by RouteGuard in layout
  // No need to check here to avoid double redirects

  const [draft, setDraft] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canSend =
    !!conversation &&
    conversation.canReply &&
    (user?.role !== 'SELLER' || conversation.assignedToId === user.id);

  const onSend = useCallback(async () => {
    if (!draft.trim() || !conversationId) return;
    await api.post(`/inbox/conversations/${conversationId}/send-text`, { text: draft.trim() });
    setDraft('');
    setBeforeCursor(undefined);
    setMessages([]);
    setIsAtBottom(true);
  }, [draft, conversationId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl+F → focus search
      if ((e.metaKey || e.ctrlKey) && e.key === 'f') {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      // Esc → close conversation
      if (e.key === 'Escape' && conversationId) {
        const params = new URLSearchParams(searchParams.toString());
        params.delete('conversationId');
        router.push(`/inbox/whatsapp?${params.toString()}`);
      }
      // Cmd/Ctrl+Enter → send
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && canSend && draft.trim()) {
        e.preventDefault();
        onSend();
      }
      // ↑ → edit draft (UX only, no actual message editing)
      if (e.key === 'ArrowUp' && !draft && textareaRef.current === document.activeElement) {
        e.preventDefault();
        // Could implement draft history here
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [conversationId, canSend, draft, searchParams, router, onSend]);

  const canChangeStatus =
    !!conversation &&
    (user?.role !== 'SELLER'
      ? true
      : !!conversation.assignedToId && conversation.assignedToId === user.id && canSellerChangeStatus);

  const canReassign =
    !!conversation &&
    (canManage || (user?.role === 'SELLER' && canSellerReassign && conversation.assignedToId === user.id));

  const onSelectConversation = useCallback(
    (id: string) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('conversationId', id);
      router.push(`/inbox/whatsapp?${params.toString()}`);
    },
    [searchParams, router],
  );

  const handleLoadMore = useCallback(() => {
    fetchNextConversations();
  }, [fetchNextConversations]);

  const renderConversationItem = useCallback(
    (conversation: any) => (
      <EnterpriseChatListItem
        key={conversation.id}
        conversation={conversation}
        provider="WHATSAPP"
        selected={conversation.id === conversationId}
        onClick={() => onSelectConversation(conversation.id)}
      />
    ),
    [conversationId, onSelectConversation],
  );

  const onAssign = async (assignedToId: string) => {
    await api.patch(`/inbox/conversations/${conversationId}/assign`, { assignedToId });
    refetchConversation();
  };

  const onStatus = async (status: ConversationStatus) => {
    await api.patch(`/inbox/conversations/${conversationId}/status`, { status });
    refetchConversation();
  };

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  const headerName =
    conversation?.lead?.name || conversation?.phone || conversation?.handle || 'WhatsApp';

  return (
    <div className="flex flex-col h-full">
      <InboxHeader currentChannel="whatsapp" />
      <div className="flex-1 flex overflow-hidden bg-[#F0F2F5]">
        {/* LEFT: chat list */}
        <div
          className="border-r bg-background flex flex-col"
          style={{ width: leftWidth }}
        >
          <div className="p-3 border-b">
            <div className="text-sm font-semibold">WhatsApp</div>
            <div className="mt-2 flex gap-2">
              <Input
                ref={searchInputRef}
                placeholder="Buscar chats… (⌘F)"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                }}
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(['OPEN', 'PENDING', 'CLOSED'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  className={cn(
                    'text-[11px] font-semibold px-3 py-1 rounded-full border transition-colors',
                    status === s ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-background hover:bg-muted border-border text-muted-foreground',
                  )}
                  onClick={() => {
                    setStatus(status === s ? undefined : (s as any));
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 overflow-hidden">
            {listLoading ? (
              <div className="p-4 space-y-3">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="h-16 bg-muted/30 rounded-lg animate-pulse" />
                ))}
              </div>
            ) : convList?.data && convList.data.length > 0 ? (
              convList.data.length > 50 ? (
                <VirtualizedConversationList
                  items={convList.data}
                  renderItem={renderConversationItem}
                  estimateSize={() => 80}
                  overscan={10}
                  onLoadMore={handleLoadMore}
                  hasMore={hasNextConversations}
                  isLoadingMore={isFetchingNextConversations}
                />
              ) : (
                <div className="overflow-y-auto h-full">
                  {convList.data.map((c) => (
                    <EnterpriseChatListItem
                      key={c.id}
                      conversation={c}
                      provider="WHATSAPP"
                      selected={c.id === conversationId}
                      onClick={() => onSelectConversation(c.id)}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center">
                <div className="mb-4">
                  <MessageSquare className="h-12 w-12 text-muted-foreground/40 mx-auto" />
                </div>
                <h3 className="text-sm font-semibold text-foreground mb-1">No hay conversaciones</h3>
                <p className="text-xs text-muted-foreground max-w-xs">
                  {q || status
                    ? 'No se encontraron conversaciones con los filtros aplicados.'
                    : 'Las conversaciones de WhatsApp aparecerán aquí cuando lleguen mensajes.'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Resizer */}
        <div
          className="hidden lg:block w-1 cursor-col-resize bg-border/60 hover:bg-border"
          onMouseDown={() => {
            resizingRef.current = true;
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
          }}
        />

        {/* CENTER: chat */}
        <div className="flex-1 flex flex-col bg-[#ECE5DD] min-w-0">
          {/* Header */}
          <div className="bg-background border-b px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-emerald-600 text-white flex items-center justify-center font-semibold">
                {(headerName || '•').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{headerName}</div>
                <div className="text-xs text-muted-foreground truncate">{conversation?.phone || conversation?.handle || ''}</div>
              </div>
            </div>
            {conversation ? (
              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={conversation.status}
                  onChange={(e) => onStatus(e.target.value as ConversationStatus)}
                  disabled={!canChangeStatus}
                  title={!canChangeStatus ? 'Sin permiso' : 'Cambiar status'}
                >
                  <option value="OPEN">OPEN</option>
                  <option value="PENDING">PENDING</option>
                  <option value="CLOSED">CLOSED</option>
                </select>
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={conversation.assignedToId || ''}
                  onChange={(e) => onAssign(e.target.value)}
                  disabled={!canReassign}
                  title={!canReassign ? 'Sin permiso' : 'Asignar'}
                >
                  <option value="">Sin asignar</option>
                  {orgUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.role})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">Seleccioná un chat</div>
            )}
          </div>

          {/* Body */}
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto px-4 py-4"
            onScroll={() => {
              const el = containerRef.current;
              if (!el) return;
              const threshold = 24;
              const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
              setIsAtBottom(atBottom);
            }}
          >
            {conversationId && (
              <div className="mb-4 flex justify-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => nextBefore && setBeforeCursor(nextBefore)}
                  disabled={!nextBefore || isFetching}
                >
                  {isFetching ? 'Cargando…' : nextBefore ? 'Cargar mensajes anteriores' : 'No hay más'}
                </Button>
              </div>
            )}

            {!conversationId ? (
              <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#ECE5DD]">
                <div className="mb-6">
                  <div className="flex items-center justify-center mx-auto mb-4">
                    <Image
                      src="/icons/whatsapp-empty.png"
                      alt="WhatsApp"
                      width={96}
                      height={96}
                      className="w-24 h-24"
                    />
                  </div>
                </div>
                <h3 className="text-2xl font-semibold text-foreground mb-2">WhatsApp</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  Seleccioná una conversación de la lista para empezar a chatear.
                </p>
                <p className="text-xs text-muted-foreground mt-4">
                  Usá los filtros arriba para buscar conversaciones específicas.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {grouped.map((g) => (
                  <div key={g.day}>
                    <div className="flex justify-center mb-3">
                      <span className="text-[11px] px-3 py-1 rounded-full bg-white/70 border text-muted-foreground">
                        {g.day}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {g.items.map((m) => {
                        const outbound = m.direction === 'OUTBOUND';
                        return (
                          <div key={m.id} className={cn('flex', outbound ? 'justify-end' : 'justify-start')}>
                            <div
                              className={cn(
                                'max-w-[76%] rounded-2xl px-3 py-2 shadow-sm border text-sm leading-relaxed',
                                outbound
                                  ? 'bg-[#DCF8C6] border-[#cfe7b7]'
                                  : 'bg-white border-border',
                              )}
                            >
                              <div className="whitespace-pre-wrap">{m.text || (m.metaJson as any)?.caption || ''}</div>
                              <div className="mt-1 text-[10px] text-muted-foreground flex justify-end">
                                {formatTimeHHMM(new Date(m.createdAt))}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="bg-background border-t p-3">
            <div className="flex items-center gap-2">
              <textarea
                ref={textareaRef}
                className="flex-1 min-h-[40px] max-h-28 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring transition-colors"
                placeholder={canSend ? 'Escribí un mensaje… (Enter para enviar, Shift+Enter para nueva línea)' : 'No se puede responder'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (canSend) onSend();
                  }
                }}
                disabled={!conversationId || !canSend}
              />
              <Button onClick={onSend} disabled={!conversationId || !canSend || !draft.trim()}>
                Enviar
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InboxWhatsApp() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-140px)] rounded-xl border bg-background" />}>
      <InboxWhatsAppInner />
    </Suspense>
  );
}
