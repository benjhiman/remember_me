'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useConversation } from '@/lib/api/hooks/use-conversation';
import { useMessages } from '@/lib/api/hooks/use-messages';
import { useOrgUsers } from '@/lib/api/hooks/use-org-users';
import { api } from '@/lib/api/client';
import { Permission, userCan } from '@/lib/auth/permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { TagsPicker } from '@/components/inbox/tags-picker';
import { TemplatePicker } from '@/components/inbox/template-picker';
import { env } from '@/lib/config/env';
import type { ConversationStatus, MessageStatus } from '@/types/api';
import { useQueryClient } from '@tanstack/react-query';

export default function ConversationPage() {
  const router = useRouter();
  const params = useParams();
  const conversationId = params.conversationId as string;
  const { user } = useAuthStore();
  const queryClient = useQueryClient();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [isOpen, setIsOpen] = useState(true); // Track if conversation view is open
  const [mediaUrl, setMediaUrl] = useState('');
  const [mediaType, setMediaType] = useState<'image' | 'document'>('image');
  const [caption, setCaption] = useState('');
  const [beforeCursor, setBeforeCursor] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<any[]>([]);
  const [isAtBottom, setIsAtBottom] = useState(true);

  const { data: conversation, refetch: refetchConversation } = useConversation(conversationId, !!user);
  const { data: orgUsers = [], isLoading: isLoadingUsers } = useOrgUsers(!!user);
  
  // Smart polling: configurable via env vars
  const { data: messagesData, refetch: refetchMessages, isFetching: messagesFetching } = useMessages({
    conversationId,
    page: 1,
    limit: 50,
    before: beforeCursor,
    enabled: !!user && !!conversationId,
    refetchInterval: isOpen
      ? env.NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_OPEN
      : env.NEXT_PUBLIC_POLLING_INTERVAL_MESSAGES_CLOSED,
  });

  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const lastMessageId = useMemo(() => {
    const msgs = messages;
    return msgs.length ? msgs[msgs.length - 1]?.id : null;
  }, [messagesData?.data]);

  useEffect(() => {
    if (!messagesContainerRef.current) return;
    if (!isAtBottom) return;
    messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
  }, [lastMessageId]);

  useEffect(() => {
    if (!messagesData?.data) return;
    // Merge messages without duplicates, keeping ascending order
    setMessages((prev) => {
      const map = new Map<string, any>();
      const merged = [...messagesData.data, ...prev];
      for (const m of merged) map.set(m.id, m);
      const arr = Array.from(map.values());
      arr.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return arr;
    });
  }, [messagesData?.data]);

  const nextBefore = (messagesData as any)?.nextBefore as string | null | undefined;
  const canLoadOlder = !!nextBefore && messages.length > 0;

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  useEffect(() => {
    // Mark conversation as "open" when component mounts
    setIsOpen(true);
    return () => setIsOpen(false);
  }, []);

  const handleSendText = async () => {
    if ((!message.trim() && !mediaUrl.trim()) || !conversation?.canReply) return;
    if (conversation.requiresTemplate && conversation.provider === 'WHATSAPP' && !mediaUrl) {
      alert('Fuera de ventana de 24h. Debes usar una plantilla.');
      return;
    }

    if (mediaUrl && conversation.provider === 'INSTAGRAM') {
      alert('Los archivos adjuntos no están soportados para Instagram aún.');
      return;
    }

    setSending(true);
    try {
      const payload: any = {};
      if (message.trim()) payload.text = message;
      if (mediaUrl.trim()) {
        payload.mediaUrl = mediaUrl;
        payload.mediaType = mediaType;
        if (caption.trim()) payload.caption = caption;
      }

      await api.post(`/inbox/conversations/${conversationId}/send-text`, payload);
      setMessage('');
      setMediaUrl('');
      setCaption('');
      refetchMessages();
      refetchConversation();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleSendTemplate = async (templateId: string, variables?: Record<string, string>) => {
    setSending(true);
    try {
      await api.post(`/inbox/conversations/${conversationId}/send-template`, {
        templateId,
        variables,
      });
      refetchMessages();
      refetchConversation();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleAssign = async (userId: string) => {
    try {
      await api.patch(`/inbox/conversations/${conversationId}/assign`, { assignedToId: userId });
      refetchConversation();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleStatusChange = async (status: ConversationStatus) => {
    try {
      // SELLER can only change status on assigned conversations (backend enforced too)
      if (user?.role === 'SELLER' && conversation?.assignedToId !== user?.id) return;
      await api.patch(`/inbox/conversations/${conversationId}/status`, { status });
      refetchConversation();
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleMarkRead = async () => {
    try {
      await api.patch(`/inbox/conversations/${conversationId}/mark-read`);
      refetchConversation();
    } catch (error: any) {
      console.error('Error marking as read:', error);
    }
  };

  const handleRetryMessage = async (messageId: string) => {
    if (!confirm('¿Estás seguro de que quieres reintentar este mensaje?')) {
      return;
    }
    setSending(true);
    try {
      await api.post(`/inbox/messages/${messageId}/retry`);
      alert('Mensaje reintentado y en cola.');
      refetchMessages();
      refetchConversation();
    } catch (error: any) {
      alert(`Error al reintentar mensaje: ${error.message}`);
    } finally {
      setSending(false);
    }
  };

  const getStatusColor = (status?: MessageStatus) => {
    switch (status) {
      case 'SENT':
        return 'text-blue-600';
      case 'DELIVERED':
        return 'text-green-600';
      case 'READ':
        return 'text-purple-600';
      case 'FAILED':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  };

  const getStatusLabel = (status?: MessageStatus) => {
    switch (status) {
      case 'SENT':
        return 'Enviado';
      case 'DELIVERED':
        return 'Entregado';
      case 'READ':
        return 'Leído';
      case 'FAILED':
        return 'Fallido';
      case 'QUEUED':
        return 'En cola';
      default:
        return '';
    }
  };

  if (!user) {
    return null;
  }

  const canChangeStatus =
    user.role !== 'SELLER' || (conversation?.assignedToId && conversation.assignedToId === user.id);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-6">
        <Button variant="ghost" onClick={() => router.push('/inbox')} className="mb-4">
          ← Volver al inbox
        </Button>

        {conversation && (
          <Card className="mb-4 p-4">
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1">
                <h2 className="text-xl font-bold mb-2">
                  {conversation.lead?.name || conversation.phone || conversation.handle || 'Sin nombre'}
                </h2>
                <div className="flex items-center gap-2 text-sm text-gray-600 mb-2">
                  <span className="capitalize">{conversation.provider.toLowerCase()}</span>
                  <span>•</span>
                  <span className="capitalize">{conversation.status.toLowerCase()}</span>
                  {conversation.assignedUser && (
                    <>
                      <span>•</span>
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        👤 {conversation.assignedUser.name}
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="flex gap-2">
                {conversation.unreadCount > 0 && (
                  <Button onClick={handleMarkRead} size="sm" variant="outline">
                    Marcar leído ({conversation.unreadCount})
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Actions Row */}
            <div className="flex flex-wrap gap-2 items-center border-t pt-3">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium">Estado:</label>
                {canChangeStatus ? (
                  <select
                    value={conversation.status}
                    onChange={(e) => handleStatusChange(e.target.value as ConversationStatus)}
                    className="text-xs border rounded px-2 py-1"
                  >
                    <option value="OPEN">Abierto</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="CLOSED">Cerrado</option>
                  </select>
                ) : (
                  <span className="text-xs text-gray-500">Solo asignado</span>
                )}
              </div>

              {userCan(user, Permission.MANAGE_MEMBERS) && (
                <div className="flex items-center gap-2">
                  <label htmlFor="assign-select" className="text-xs font-medium">Asignar a:</label>
                  <select
                    id="assign-select"
                    value={conversation.assignedToId || ''}
                    onChange={(e) => handleAssign(e.target.value)}
                    className="text-xs border rounded px-2 py-1"
                    disabled={isLoadingUsers}
                  >
                    <option value="">Sin asignar</option>
                    {orgUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <TagsPicker
                conversationId={conversationId}
                currentTags={conversation.tags.map(t => ({ id: t.id, name: t.name, color: t.color }))}
                onTagAdded={() => refetchConversation()}
                onTagRemoved={() => refetchConversation()}
              />

              {conversation.provider === 'WHATSAPP' && (
                <TemplatePicker
                  provider={conversation.provider}
                  onSelect={handleSendTemplate}
                  disabled={sending}
                />
              )}
            </div>
          </Card>
        )}

        {/* Messages */}
        <Card
          ref={messagesContainerRef}
          className="mb-4 p-4"
          style={{ minHeight: '400px', maxHeight: '600px', overflowY: 'auto' }}
          onScroll={() => {
            const el = messagesContainerRef.current;
            if (!el) return;
            const threshold = 24;
            const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < threshold;
            setIsAtBottom(atBottom);
          }}
        >
          <div className="mb-4 flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (nextBefore) setBeforeCursor(nextBefore);
              }}
              disabled={!canLoadOlder || messagesFetching}
            >
              {messagesFetching ? 'Cargando…' : canLoadOlder ? 'Cargar anteriores' : 'No hay más'}
            </Button>
          </div>

          {messages.length === 0 ? (
            <div className="text-center text-gray-500 py-8">No hay mensajes</div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`mb-4 flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    msg.direction === 'OUTBOUND'
                      ? 'bg-blue-500 text-white'
                      : 'bg-gray-200 text-gray-900'
                  }`}
                >
                  <p>{msg.text || (msg.metaJson as any)?.caption || 'Mensaje con archivo adjunto'}</p>
                  {(msg.metaJson as any)?.mediaUrl && (
                    <div className="mt-2">
                      <a
                        href={(msg.metaJson as any).mediaUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm underline"
                      >
                        📎 Ver archivo adjunto ({(msg.metaJson as any).mediaType || 'archivo'})
                      </a>
                    </div>
                  )}
                  <div className={`text-xs mt-1 flex items-center gap-2 ${
                    msg.direction === 'OUTBOUND' ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    <span>{new Date(msg.createdAt).toLocaleString('es-ES')}</span>
                    {msg.status && (
                      <span className={getStatusColor(msg.status)}>
                        {getStatusLabel(msg.status)}
                      </span>
                    )}
                    {msg.direction === 'OUTBOUND' && msg.status === 'FAILED' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRetryMessage(msg.id)}
                        disabled={sending}
                        className="h-auto p-1 text-xs text-red-200 hover:text-red-100"
                      >
                        🔄 Reintentar
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </Card>

        {/* Send message */}
        {conversation && (
          <Card className="p-4">
            {conversation.requiresTemplate && conversation.provider === 'WHATSAPP' && (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                ⚠️ Fuera de ventana de 24h. Se requiere usar una plantilla.
              </div>
            )}
            {!conversation.canReply && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-800">
                ❌ Conversación cerrada. No se puede responder.
              </div>
            )}
            {conversation.provider === 'WHATSAPP' && (
              <div className="mb-2 space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="URL del archivo (imagen o documento)"
                    value={mediaUrl}
                    onChange={(e) => setMediaUrl(e.target.value)}
                    disabled={sending || !conversation.canReply}
                    className="flex-1"
                  />
                  <select
                    value={mediaType}
                    onChange={(e) => setMediaType(e.target.value as 'image' | 'document')}
                    disabled={sending || !conversation.canReply}
                    className="border rounded px-2"
                  >
                    <option value="image">Imagen</option>
                    <option value="document">Documento</option>
                  </select>
                </div>
                {mediaUrl && (
                  <Input
                    placeholder="Descripción (opcional)"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    disabled={sending || !conversation.canReply}
                  />
                )}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                placeholder={
                  conversation.requiresTemplate && conversation.provider === 'WHATSAPP' && !mediaUrl
                    ? 'Usa una plantilla para enviar...'
                    : 'Escribe un mensaje...'
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendText();
                  }
                }}
                disabled={
                  !conversation.canReply ||
                  sending ||
                  (conversation.requiresTemplate && conversation.provider === 'WHATSAPP' && !mediaUrl)
                }
              />
              <Button
                onClick={handleSendText}
                disabled={
                  !conversation.canReply ||
                  sending ||
                  (!message.trim() && !mediaUrl.trim()) ||
                  (conversation.requiresTemplate && conversation.provider === 'WHATSAPP' && !mediaUrl)
                }
              >
                {sending ? 'Enviando...' : 'Enviar'}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
