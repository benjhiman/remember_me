'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { useVendors } from '@/lib/api/hooks/use-vendors';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils/lead-utils';
import { perfMark, perfMeasureToNow } from '@/lib/utils/perf';
import { Plus, Search, Edit, Building2 } from 'lucide-react';
import { VendorFormDialog } from '@/components/vendors/vendor-form-dialog';
import type { Vendor } from '@/lib/api/hooks/use-vendors';

export default function VendorsPage() {
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingVendor, setEditingVendor] = useState<Vendor | null>(null);

  const { data, isLoading, error, refetch } = useVendors({
    page,
    limit: 20,
    q: search || undefined,
    status: statusFilter,
    enabled: !!user,
  });

  useEffect(() => {
    perfMark('vendors-page-mount');
  }, []);

  useEffect(() => {
    if (data && !isLoading) {
      perfMeasureToNow('vendors-page-data-loaded', 'vendors-page-mount');
    }
  }, [data, isLoading]);

  const breadcrumbs = [
    { label: 'Ventas', href: '/sales' },
    { label: 'Proveedores', href: '/sales/vendors' },
  ];

  const actions = (
    <>
      {can('vendors.write') && (
        <Button size="sm" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nuevo Proveedor
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
            placeholder="Buscar por nombre o email..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>
      <select
        value={statusFilter || ''}
        onChange={(e) => {
          setStatusFilter(e.target.value || undefined);
          setPage(1);
        }}
        className="px-3 py-1.5 text-sm border rounded-md bg-white"
      >
        <option value="">Todos los estados</option>
        <option value="ACTIVE">Activo</option>
        <option value="INACTIVE">Inactivo</option>
      </select>
    </div>
  );

  return (
    <>
      <PageShell
        title="Proveedores"
        description="Gestiona tu base de proveedores"
        breadcrumbs={breadcrumbs}
        actions={actions}
        toolbar={toolbar}
      >
        {isLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <div className="max-w-md mx-auto">
              <p className="text-red-600 font-medium mb-2">Error al cargar los proveedores</p>
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
            {data.items.length === 0 ? (
              <div className="p-12 text-center">
                <div className="max-w-sm mx-auto">
                  <Building2 className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {search || statusFilter ? 'No hay proveedores con estos filtros' : 'No hay proveedores'}
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">
                    {search || statusFilter
                      ? 'Intentá ajustar los filtros para ver más resultados.'
                      : 'Creá tu primer proveedor para empezar a gestionar contactos.'}
                  </p>
                  {can('vendors.write') && (
                    <Button onClick={() => setIsCreateOpen(true)} size="sm">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Nuevo Proveedor
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Nombre
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Teléfono
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Estado
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actualizado
                        </th>
                        <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {data.items.map((vendor) => (
                        <tr key={vendor.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{vendor.name}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{vendor.email || '-'}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="text-sm text-gray-600">{vendor.phone || '-'}</div>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span
                              className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                vendor.status === 'ACTIVE'
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {vendor.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                            {formatDate(vendor.updatedAt)}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                            {can('vendors.write') && (
                              <button
                                onClick={() => setEditingVendor(vendor)}
                                className="text-blue-600 hover:text-blue-900"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {data.total > data.limit && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Mostrando {((page - 1) * data.limit) + 1} - {Math.min(page * data.limit, data.total)} de {data.total}
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
                        onClick={() => setPage((p) => p + 1)}
                        disabled={page * data.limit >= data.total}
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
      </PageShell>

      <VendorFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <VendorFormDialog
        open={!!editingVendor}
        onOpenChange={(open) => !open && setEditingVendor(null)}
        vendor={editingVendor}
      />
    </>
  );
}
