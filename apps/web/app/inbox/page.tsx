'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/store/auth-store';
import { Permission, userCan } from '@/lib/auth/permissions';
import { useConversations } from '@/lib/api/hooks/use-conversations';
import { ConversationListItem } from '@/components/inbox/conversation-list-item';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { env } from '@/lib/config/env';
import { cn } from '@/lib/utils/cn';
import type { IntegrationProvider, ConversationStatus } from '@/types/api';

export default function InboxPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  
  // Determine provider from pathname
  const providerFromPath = pathname.includes('/whatsapp') 
    ? 'WHATSAPP' as IntegrationProvider
    : pathname.includes('/instagram')
    ? 'INSTAGRAM' as IntegrationProvider
    : undefined;
  
  const [provider, setProvider] = useState<IntegrationProvider | undefined>(providerFromPath);
  const [status, setStatus] = useState<ConversationStatus | undefined>();
  const [search, setSearch] = useState('');
  const [assignmentFilter, setAssignmentFilter] = useState<'all' | 'mine' | 'unassigned'>('all');

  // Enforce SELLER sees only their chats
  useEffect(() => {
    if (user?.role === 'SELLER') {
      setAssignmentFilter('mine');
    }
  }, [user?.role]);

  const assignedToId =
    assignmentFilter === 'mine'
      ? user?.id
      : assignmentFilter === 'unassigned'
      ? 'unassigned'
      : undefined;

  const { data, isLoading, error } = useConversations({
    provider,
    status,
    assignedToId,
    q: search || undefined,
    page,
    limit: 20,
    enabled: !!user,
    refetchInterval: env.NEXT_PUBLIC_POLLING_INTERVAL_CONVERSATIONS,
  });

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }
    // Check permission
    if (!userCan(user, Permission.VIEW_INBOX)) {
      router.push('/forbidden');
      return;
    }
  }, [user, router]);

  // Sync provider with pathname
  useEffect(() => {
    const pathProvider = pathname.includes('/whatsapp') 
      ? 'WHATSAPP' as IntegrationProvider
      : pathname.includes('/instagram')
      ? 'INSTAGRAM' as IntegrationProvider
      : undefined;
    
    if (pathProvider !== provider) {
      setProvider(pathProvider);
    }
  }, [pathname, provider]);

  if (!user) {
    return null;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Inbox</h1>
        <p className="text-gray-600">Conversaciones unificadas de WhatsApp e Instagram</p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b">
        <nav className="flex gap-4">
          <Link
            href="/inbox"
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              !provider
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Todos
          </Link>
          <Link
            href="/inbox/whatsapp"
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              provider === 'WHATSAPP'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            WhatsApp
          </Link>
          <Link
            href="/inbox/instagram"
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              provider === 'INSTAGRAM'
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            )}
          >
            Instagram
          </Link>
        </nav>
      </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Búsqueda</label>
              <Input
                placeholder="Teléfono, handle, nombre..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Asignación</label>
              {user?.role === 'SELLER' ? (
                <div className="h-10 rounded-md border border-input bg-gray-50 px-3 py-2 text-sm text-gray-700 flex items-center">
                  Mis chats
                </div>
              ) : (
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={assignmentFilter}
                  onChange={(e) => {
                    setAssignmentFilter(e.target.value as any);
                    setPage(1);
                  }}
                >
                  <option value="all">Todos</option>
                  <option value="mine">Mis chats</option>
                  <option value="unassigned">Sin asignar</option>
                </select>
              )}
            </div>
            {/* Provider filter removed - using tabs instead */}
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={status || ''}
                onChange={(e) => {
                  setStatus(e.target.value as ConversationStatus | undefined);
                  setPage(1);
                }}
              >
                <option value="">Todos</option>
                <option value="OPEN">Abierto</option>
                <option value="PENDING">Pendiente</option>
                <option value="CLOSED">Cerrado</option>
              </select>
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setStatus(undefined);
                  setSearch('');
                  setAssignmentFilter(user?.role === 'SELLER' ? 'mine' : 'all');
                  setPage(1);
                }}
                className="w-full"
              >
                Limpiar filtros
              </Button>
            </div>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-lg shadow">
          {isLoading && (
            <div className="p-8 text-center text-gray-500">Cargando conversaciones...</div>
          )}
          {error && (
            <div className="p-8 text-center text-red-500">
              Error: {(error as Error).message}
            </div>
          )}
          {data && (
            <>
              {data.data.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No hay conversaciones que coincidan con los filtros
                </div>
              ) : (
                <>
                  {data.data.map((conv) => (
                    <ConversationListItem
                      key={conv.id}
                      conversation={conv}
                      onClick={() => router.push(`/inbox/${conv.id}`)}
                    />
                  ))}
                  {/* Pagination */}
                  {data.meta.totalPages > 1 && (
                    <div className="p-4 border-t flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Mostrando {data.data.length} de {data.meta.total} conversaciones
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                          disabled={page === data.meta.totalPages}
                        >
                          Siguiente
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </>
          )}
        </div>
    </div>
  );
}
