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
import { Instagram } from 'lucide-react';
import type { ConversationStatus, Message } from '@/types/api';

function InboxInstagramInner() {
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
  const [page, setPage] = useState(1);
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

  const { data: convList, isLoading: listLoading } = useConversations({
    provider: 'INSTAGRAM',
    q: debouncedQ || undefined,
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
  const canSend =
    !!conversation &&
    conversation.canReply &&
    (user?.role !== 'SELLER' || conversation.assignedToId === user.id);

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
    router.push(`/inbox/instagram?${params.toString()}`);
  };

  const onAssign = async (assignedToId: string) => {
    await api.patch(`/inbox/conversations/${conversationId}/assign`, { assignedToId });
    refetchConversation();
  };

  const onStatus = async (status: ConversationStatus) => {
    await api.patch(`/inbox/conversations/${conversationId}/status`, { status });
    refetchConversation();
  };

  const grouped = useMemo(() => groupByDay(messages), [messages]);
  const headerName = conversation?.handle || conversation?.lead?.name || 'Instagram';

  return (
    <div className="h-[calc(100vh-140px)] rounded-xl border bg-background overflow-hidden">
      <div className="flex h-full">
        {/* LEFT */}
        <div className="border-r bg-background flex flex-col" style={{ width: leftWidth }}>
          <div className="p-3 border-b">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Instagram className="h-4 w-4" /> Instagram
            </div>
            <div className="mt-2">
              <Input
                placeholder="Buscar…"
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(1);
                }}
              />
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
                  provider="INSTAGRAM"
                  selected={c.id === conversationId}
                  onClick={() => onSelectConversation(c.id)}
                />
              ))
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

        {/* RIGHT */}
        <div className="flex flex-col h-full bg-white">
          <div className="bg-background border-b px-4 py-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-fuchsia-500 to-amber-500 text-white flex items-center justify-center font-semibold">
                {(headerName || '•').slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0">
                <div className="truncate font-semibold">{headerName}</div>
                <div className="text-xs text-muted-foreground truncate">Instagram DM</div>
              </div>
            </div>
            {conversation ? (
              <div className="flex items-center gap-2">
                <select
                  className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={conversation.status}
                  onChange={(e) => onStatus(e.target.value as ConversationStatus)}
                  disabled={!canChangeStatus}
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
                      <span className="text-[11px] px-3 py-1 rounded-full bg-muted border text-muted-foreground">
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
                                'max-w-[76%] rounded-2xl px-3 py-2 border text-sm leading-relaxed',
                                outbound
                                  ? 'bg-sky-600 text-white border-sky-600'
                                  : 'bg-gray-100 text-gray-900 border-gray-200',
                              )}
                            >
                              <div className="whitespace-pre-wrap">{m.text || ''}</div>
                              <div className={cn('mt-1 text-[10px] flex justify-end', outbound ? 'text-sky-100' : 'text-gray-500')}>
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

          <div className="bg-background border-t p-3">
            <div className="flex items-center gap-2">
              <textarea
                className="flex-1 min-h-[40px] max-h-28 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                placeholder={canSend ? 'Mensaje…' : 'No se puede responder'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    if (!conversationId || !canSend || !draft.trim()) return;
                    api.post(`/inbox/conversations/${conversationId}/send-text`, { text: draft.trim() }).then(() => setDraft(''));
                  }
                }}
                disabled={!conversationId || !canSend}
              />
              <Button
                onClick={() => {
                  if (!conversationId || !canSend || !draft.trim()) return;
                  api.post(`/inbox/conversations/${conversationId}/send-text`, { text: draft.trim() }).then(() => setDraft(''));
                }}
                disabled={!conversationId || !canSend || !draft.trim()}
              >
                Enviar
              </Button>
            </div>
            <div className="text-[11px] text-muted-foreground mt-2">
              Adjuntos no disponibles en Instagram (actual).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InboxInstagram() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-140px)] rounded-xl border bg-background" />}>
      <InboxInstagramInner />
    </Suspense>
  );
}
