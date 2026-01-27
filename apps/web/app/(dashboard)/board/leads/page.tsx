'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useLeads } from '@/lib/api/hooks/use-leads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { getStatusBadgeColor, getStatusLabel, formatDate } from '@/lib/utils/lead-utils';
import { getErrorMessage } from '@/lib/utils/error-handler';
import { Permission, userCan } from '@/lib/auth/permissions';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Users, Search, Filter, Plus } from 'lucide-react';
import type { LeadStatus } from '@/types/api';

export default function BoardLeadsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<LeadStatus | undefined>();

  const { data, isLoading, error, refetch } = useLeads({
    page,
    limit: 20,
    q: search || undefined,
    status,
    enabled: !!user,
  });

  const breadcrumbs = [
    { label: 'Home', href: '/dashboard' },
    { label: 'Board', href: '/board' },
    { label: 'Leads', href: '/board/leads' },
  ];

  const actions = (
    <>
      {userCan(user, Permission.VIEW_LEADS) && (
        <Button variant="outline" size="sm" onClick={() => router.push('/board')}>
          Board
        </Button>
      )}
      {can('leads.write') && (
        <Button size="sm" onClick={() => router.push('/board/leads/new')}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo Lead
        </Button>
      )}
    </>
  );

  const toolbar = (
    <div className="flex items-center gap-3">
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar leads..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>
      <select
        className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        value={status || ''}
        onChange={(e) => {
          setStatus(e.target.value as LeadStatus | undefined);
          setPage(1);
        }}
      >
        <option value="">Todos los estados</option>
        <option value="ACTIVE">Activo</option>
        <option value="CONVERTED">Convertido</option>
        <option value="LOST">Perdido</option>
        <option value="ARCHIVED">Archivado</option>
      </select>
      {(search || status) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatus(undefined);
            setSearch('');
            setPage(1);
          }}
          className="h-9"
        >
          Limpiar
        </Button>
      )}
    </div>
  );

  return (
    <PageShell
      title="Leads"
      description="Gestión de leads y oportunidades"
      breadcrumbs={breadcrumbs}
      actions={actions}
      toolbar={toolbar}
    >
      {/* Table Container */}
      <div className="zoho-card">
        {isLoading && (
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <div className="max-w-md mx-auto">
              <p className="text-red-600 font-medium mb-2">Error al cargar los leads</p>
              <p className="text-sm text-gray-600 mb-4">
                {(error as Error).message || 'No se pudo conectar con el servidor'}
              </p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {data && (
          <>
            {data.data.length === 0 ? (
              <div className="p-12 text-center">
                <div className="max-w-sm mx-auto">
                  <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {search || status ? 'No hay leads con estos filtros' : 'No hay leads'}
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">
                    {search || status
                      ? 'Intentá ajustar los filtros para ver más resultados.'
                      : 'Creá tu primer lead para empezar a gestionar oportunidades.'}
                  </p>
                  {userCan(user, Permission.EDIT_LEADS) && (
                    <Button onClick={() => router.push('/board/leads/new')} size="sm">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Crear Lead
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="zoho-table">
                    <thead>
                      <tr>
                        <th>Lead</th>
                        <th>Estado</th>
                        <th>Pipeline / Stage</th>
                        <th>Origen</th>
                        <th>Asignado</th>
                        <th>Última actualización</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((lead) => (
                        <tr
                          key={lead.id}
                          className="cursor-pointer"
                          onClick={() => router.push(`/board/leads/${lead.id}`)}
                        >
                          <td>
                            <div className="text-sm font-medium text-gray-900">{lead.name}</div>
                            {lead.email && (
                              <div className="text-xs text-gray-500">{lead.email}</div>
                            )}
                            {lead.phone && (
                              <div className="text-xs text-gray-500">{lead.phone}</div>
                            )}
                          </td>
                          <td>
                            <span
                              className={`inline-flex px-2 py-0.5 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                                lead.status
                              )}`}
                            >
                              {getStatusLabel(lead.status)}
                            </span>
                          </td>
                          <td>
                            <div className="text-sm text-gray-900">
                              {lead.pipeline?.name || '—'}
                            </div>
                            <div className="text-xs text-gray-500">
                              {lead.stage?.name || '—'}
                            </div>
                          </td>
                          <td className="text-sm text-gray-600">{lead.source || '—'}</td>
                          <td className="text-sm text-gray-600">{lead.assignedTo?.name || '—'}</td>
                          <td className="text-sm text-gray-600">{formatDate(lead.updatedAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data?.meta?.totalPages && data.meta.totalPages > 1 && (
                  <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="text-sm text-gray-600">
                      Mostrando {data?.data?.length ?? 0} de {data?.meta?.total ?? 0} leads
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
    </PageShell>
  );
}
