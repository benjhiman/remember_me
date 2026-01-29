'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { useItems } from '@/lib/api/hooks/use-items';
import { usePermissions } from '@/lib/auth/use-permissions';
import { useDeleteItem } from '@/lib/api/hooks/use-item-mutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils/lead-utils';
import { perfMark, perfMeasureToNow } from '@/lib/utils/perf';
import { Plus, Search, Edit, Trash2, RefreshCw, Hash } from 'lucide-react';
import { ItemFormDialog } from '@/components/items/item-form-dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/components/ui/use-toast';
import type { Item } from '@/lib/api/hooks/use-items';

export default function InventoryItemsPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const deleteItem = useDeleteItem();

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, error, refetch } = useItems({
    page,
    limit: 20,
    q: debouncedSearch || undefined,
    enabled: !!user,
  });

  useEffect(() => {
    perfMark('items-page-mount');
  }, []);

  useEffect(() => {
    if (data && !isLoading) {
      perfMeasureToNow('items-page-data-loaded', 'items-page-mount');
    }
  }, [data, isLoading]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ['items'] });
      await refetch();
      toast({
        title: 'Actualizado',
        description: 'Los items se actualizaron correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la lista',
        variant: 'destructive',
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteItem.mutateAsync(deletingItem.id);
      setDeletingItem(null);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleOpenCreate = () => {
    // Check permissions: use 'stock.write' (backend permission) or fallback to role check
    const canWrite =
      can('stock.write') ||
      can('inventory.write') || // Legacy fallback
      ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role ?? '');

    if (!canWrite) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tenés permiso para crear items. Pedile a un admin que te habilite.',
      });
      return;
    }
    setIsCreateOpen(true);
  };

  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory/stock' },
    { label: 'Items', href: '/inventory/items' },
  ];

  const actions = (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={handleRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        Actualizar
      </Button>
      <Button size="sm" onClick={handleOpenCreate}>
        <Plus className="h-4 w-4 mr-1.5" />
        Nuevo Item
      </Button>
    </div>
  );

  const toolbar = (
    <div className="flex items-center gap-3">
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar por nombre, SKU, categoría o marca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
    </div>
  );

  return (
    <>
      <PageShell
        title="Items"
        description="Gestiona tu catálogo de productos"
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
              <p className="text-red-600 font-medium mb-2">Error al cargar los items</p>
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
                  <Hash className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {debouncedSearch ? 'No hay items con estos filtros' : 'No hay items'}
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">
                    {debouncedSearch
                      ? 'Intentá ajustar los filtros para ver más resultados.'
                      : 'Creá tu primer item para empezar a gestionar tu catálogo.'}
                  </p>
                  <Button onClick={handleOpenCreate} size="sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Crear primer item
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Modelo
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Almacenamiento
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Condición
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Color
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Marca
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
                      {data.data.map((item) => {
                        const getConditionLabel = (condition: string | null) => {
                          switch (condition) {
                            case 'NEW':
                              return 'Nuevo';
                            case 'USED':
                              return 'Usado';
                            case 'REFURBISHED':
                              return 'Reacondicionado';
                            case 'OEM':
                              return 'OEM';
                            default:
                              return condition || '-';
                          }
                        };
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {item.model || item.name}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-600">
                                {item.storageGb ? `${item.storageGb} GB` : '-'}
                              </div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-600">{getConditionLabel(item.condition)}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-600">{item.color || '-'}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="text-sm text-gray-600">{item.brand || '-'}</div>
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                              {formatDate(item.updatedAt)}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                              <div className="flex items-center justify-end gap-2">
                                {can('inventory.write') && (
                                  <>
                                    <button
                                      onClick={() => setEditingItem(item)}
                                      className="text-blue-600 hover:text-blue-900"
                                      title="Editar"
                                    >
                                      <Edit className="h-4 w-4" />
                                    </button>
                                    <button
                                      onClick={() => setDeletingItem(item)}
                                      className="text-red-600 hover:text-red-900"
                                      title="Eliminar"
                                    >
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {data.meta.total > data.meta.limit && (
                  <div className="mt-4 flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Mostrando {((page - 1) * data.meta.limit) + 1} - {Math.min(page * data.meta.limit, data.meta.total)} de {data.meta.total}
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
                        disabled={page * data.meta.limit >= data.meta.total}
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

      <ItemFormDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
      <ItemFormDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
      />

      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar item?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El item será eliminado permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteItem.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteItem.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteItem.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
