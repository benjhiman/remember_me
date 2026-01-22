'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useLeads } from '@/lib/api/hooks/use-leads';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { getStatusBadgeColor, getStatusLabel, formatDate } from '@/lib/utils/lead-utils';
import { getErrorMessage } from '@/lib/utils/error-handler';
import { Permission, userCan } from '@/lib/auth/permissions';
import { Users } from 'lucide-react';
import type { LeadStatus } from '@/types/api';

export default function LeadsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
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

  // Auth is handled by RouteGuard in layout
  // No need to check here to avoid double redirects

  return (
    <div>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Leads</h1>
            <p className="text-muted-foreground">Gestión de leads y oportunidades</p>
          </div>
          <div className="flex gap-2">
            {userCan(user, Permission.VIEW_LEADS) && (
              <Button variant="outline" onClick={() => router.push('/leads/board')}>
                Board
              </Button>
            )}
            {userCan(user, Permission.EDIT_LEADS) && (
              <Button onClick={() => router.push('/leads/new')}>Crear Lead</Button>
            )}
          </div>
        </div>

        {/* Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Filtros</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">Búsqueda</label>
                <Input
                  placeholder="Nombre, email, teléfono..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Estado</label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={status || ''}
                  onChange={(e) => {
                    setStatus(e.target.value as LeadStatus | undefined);
                    setPage(1);
                  }}
                >
                  <option value="">Todos</option>
                  <option value="ACTIVE">Activo</option>
                  <option value="CONVERTED">Convertido</option>
                  <option value="LOST">Perdido</option>
                  <option value="ARCHIVED">Archivado</option>
                </select>
              </div>
              <div className="flex items-end">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStatus(undefined);
                    setSearch('');
                    setPage(1);
                  }}
                  className="w-full"
                >
                  Limpiar filtros
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
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
                  <p className="text-red-600 font-medium mb-2">
                    Error al cargar los leads
                  </p>
                  <p className="text-sm text-muted-foreground mb-4">
                    {(error as Error).message || 'No se pudo conectar con el servidor'}
                  </p>
                  <Button onClick={() => refetch()} variant="outline">
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
                      <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                      <h3 className="text-sm font-semibold text-foreground mb-1">
                        {search || status ? 'No hay leads con estos filtros' : 'No hay leads'}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-4">
                        {search || status
                          ? 'Intentá ajustar los filtros para ver más resultados.'
                          : 'Creá tu primer lead para empezar a gestionar oportunidades.'}
                      </p>
                      {userCan(user, Permission.EDIT_LEADS) && (
                        <Button onClick={() => router.push('/leads/new')}>Crear Lead</Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full crm-table">
                        <thead className="bg-muted/40 border-b">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Lead
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Estado
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Pipeline / Stage
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Origen
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Asignado
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                              Última actualización
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {data.data.map((lead) => (
                            <tr
                              key={lead.id}
                              className="hover:bg-gray-50 cursor-pointer transition-colors"
                              onClick={() => router.push(`/leads/${lead.id}`)}
                            >
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm font-medium text-foreground">{lead.name}</div>
                                {lead.email && (
                                  <div className="text-sm text-muted-foreground">{lead.email}</div>
                                )}
                                {lead.phone && (
                                  <div className="text-sm text-muted-foreground">{lead.phone}</div>
                                )}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(
                                    lead.status
                                  )}`}
                                >
                                  {getStatusLabel(lead.status)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-foreground">
                                  {lead.pipeline?.name || '—'}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {lead.stage?.name || '—'}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                {lead.source || '—'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                {lead.assignedTo?.name || '—'}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                {formatDate(lead.updatedAt)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    {data?.meta?.totalPages && data.meta.totalPages > 1 && (
                      <div className="p-4 border-t flex items-center justify-between bg-muted/30">
                        <div className="text-sm text-muted-foreground">
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
                            onClick={() =>
                              setPage((p) => Math.min(data.meta.totalPages, p + 1))
                            }
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
          </CardContent>
        </Card>
    </div>
  );
}
