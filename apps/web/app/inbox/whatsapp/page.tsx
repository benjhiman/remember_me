'use client';

import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useOrgSettings } from '@/lib/api/hooks/use-org-settings';
import { useConversations } from '@/lib/api/hooks/use-conversations';
import { useConversation } from '@/lib/api/hooks/use-conversation';
import { useMessages } from '@/lib/api/hooks/use-messages';
import { useOrgUsers } from '@/lib/api/hooks/use-org-users';
import { api } from '@/lib/api/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { EnterpriseChatListItem } from '@/components/inbox/enterprise-chat-list-item';
import { groupByDay, formatTimeHHMM } from '@/lib/utils/inbox-format';
import { cn } from '@/lib/utils/cn';
import type { ConversationStatus, Message } from '@/types/api';

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
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(t);
  }, [q]);

  const assignedToId =
    user?.role === 'SELLER' && settings?.crm.inbox.sellerSeesOnlyAssigned ? user.id : undefined;

  const { data: convList, isLoading: listLoading } = useConversations({
    provider: 'WHATSAPP',
    q: debouncedQ || undefined,
    status,
    assignedToId,
    page,
    limit: 30,
    enabled: !!user,
  });

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

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  const [draft, setDraft] = useState('');
  const canSend = !!conversation && conversation.canReply;

  const canChangeStatus =
    !!conversation &&
    (user?.role !== 'SELLER'
      ? true
      : !!conversation.assignedToId && conversation.assignedToId === user.id && canSellerChangeStatus);

  const canReassign =
    !!conversation &&
    (canManage || (user?.role === 'SELLER' && canSellerReassign && conversation.assignedToId === user.id));

  const onSelectConversation = (id: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('conversationId', id);
    router.push(`/inbox/whatsapp?${params.toString()}`);
  };

  const onAssign = async (assignedToId: string) => {
    await api.patch(`/inbox/conversations/${conversationId}/assign`, { assignedToId });
    refetchConversation();
  };

  const onStatus = async (status: ConversationStatus) => {
    await api.patch(`/inbox/conversations/${conversationId}/status`, { status });
    refetchConversation();
  };

  const onSend = async () => {
    if (!draft.trim() || !conversationId) return;
    await api.post(`/inbox/conversations/${conversationId}/send-text`, { text: draft.trim() });
    setDraft('');
  };

  const grouped = useMemo(() => groupByDay(messages), [messages]);

  const headerName =
    conversation?.lead?.name || conversation?.phone || conversation?.handle || 'WhatsApp';

  return (
    <div className="h-[calc(100vh-140px)] rounded-xl border bg-background overflow-hidden">
      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] h-full">
        {/* LEFT: chat list */}
        <div className="border-r bg-background flex flex-col">
          <div className="p-3 border-b">
            <div className="text-sm font-semibold">WhatsApp</div>
            <div className="mt-2 flex gap-2">
              <Input
                placeholder="Buscar chats…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div className="mt-2 flex gap-2">
              <select
                className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                value={status || ''}
                onChange={(e) => setStatus((e.target.value || undefined) as any)}
              >
                <option value="">Todos</option>
                <option value="OPEN">OPEN</option>
                <option value="PENDING">PENDING</option>
                <option value="CLOSED">CLOSED</option>
              </select>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {listLoading ? (
              <div className="p-4 text-sm text-muted-foreground">Cargando…</div>
            ) : (
              (convList?.data || []).map((c) => (
                <EnterpriseChatListItem
                  key={c.id}
                  conversation={c}
                  provider="WHATSAPP"
                  selected={c.id === conversationId}
                  onClick={() => onSelectConversation(c.id)}
                />
              ))
            )}
          </div>
        </div>

        {/* RIGHT: chat */}
        <div className="flex flex-col h-full bg-[#ECE5DD]">
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
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                Seleccioná una conversación.
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
              <Input
                placeholder={canSend ? 'Escribí un mensaje…' : 'No se puede responder'}
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
