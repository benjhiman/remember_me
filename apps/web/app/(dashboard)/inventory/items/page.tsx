'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/lib/store/auth-store';
import { useItems } from '@/lib/api/hooks/use-items';
import { useItemFolders, useDeleteFolder } from '@/lib/api/hooks/use-item-folders';
import { usePermissions } from '@/lib/auth/use-permissions';
import { useDeleteItem } from '@/lib/api/hooks/use-item-mutations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/utils/lead-utils';
import { perfMark, perfMeasureToNow } from '@/lib/utils/perf';
import { Plus, Search, Edit, Trash2, RefreshCw, Hash, Folder, ArrowLeft, List, Grid } from 'lucide-react';
import { conditionLabel } from '@/lib/items/condition-label';
import { ItemFormDialog } from '@/components/items/item-form-dialog';
import { ItemsFoldersGrid } from '@/components/items/items-folders-grid';
import { CreateFolderDialog } from '@/components/items/create-folder-dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
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
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [deletingItem, setDeletingItem] = useState<Item | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [showBulkDeleteConfirm, setShowBulkDeleteConfirm] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'grid'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('itemsViewMode');
      return (saved === 'list' || saved === 'grid') ? saved : 'grid';
    }
    return 'grid';
  });

  // Get folderId from URL params
  const folderId = searchParams.get('folderId') ?? null;

  const deleteItem = useDeleteItem();
  const deleteFolder = useDeleteFolder();

  // Fetch folders (only when not in folder mode)
  const { data: foldersData, isLoading: isLoadingFolders, error: foldersError } = useItemFolders(!folderId && !!user);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Build query for items: if folderId exists, filter by folder
  const itemsQuery = useMemo(() => {
    return debouncedSearch || undefined;
  }, [debouncedSearch]);

  const { data, isLoading, error, refetch } = useItems({
    page,
    limit: 20,
    q: itemsQuery,
    folderId: folderId || undefined,
    enabled: !!user && !!folderId, // Only fetch items when in folder mode
  });

  useEffect(() => {
    perfMark('items-page-mount');
  }, []);

  useEffect(() => {
    if (data && !isLoading) {
      perfMeasureToNow('items-page-data-loaded', 'items-page-mount');
    }
  }, [data, isLoading]);

  // Clear selection when data changes
  useEffect(() => {
    if (data) {
      const currentIds = new Set(data.data.map((item) => item.id));
      const newSelected = new Set(Array.from(selectedIds).filter((id) => currentIds.has(id)));
      if (newSelected.size !== selectedIds.size) {
        setSelectedIds(newSelected);
      }
    }
  }, [data, selectedIds]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      if (folderId) {
        await queryClient.invalidateQueries({ queryKey: ['items'] });
        await refetch();
      } else {
        await queryClient.invalidateQueries({ queryKey: ['item-folders'] });
      }
      toast({
        title: 'Actualizado',
        description: 'Los datos se actualizaron correctamente',
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

  const handleOpenFolder = (folderId: string) => {
    router.push(`/inventory/items?folderId=${encodeURIComponent(folderId)}`);
  };

  const handleViewModeChange = (mode: 'list' | 'grid') => {
    setViewMode(mode);
    if (typeof window !== 'undefined') {
      localStorage.setItem('itemsViewMode', mode);
    }
  };

  const handleBackToFolders = () => {
    router.push('/inventory/items');
    setSearch('');
    setDebouncedSearch('');
    setPage(1);
  };

  const handleOpenCreateFolder = () => {
    const canWrite =
      can('stock.write') ||
      can('inventory.write') ||
      ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role ?? '');

    if (!canWrite) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tenés permiso para crear carpetas. Pedile a un admin que te habilite.',
      });
      return;
    }
    setIsCreateFolderOpen(true);
  };

  const handleDeleteFolder = (folderId: string) => {
    const canWrite =
      can('stock.write') ||
      can('inventory.write') ||
      ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role ?? '');

    if (!canWrite) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tenés permiso para eliminar carpetas. Pedile a un admin que te habilite.',
      });
      return;
    }
    deleteFolder.mutate(folderId);
  };

  // Filter folders by search (when in folders mode)
  const filteredFolders = useMemo(() => {
    if (!foldersData?.data) return [];
    if (!search.trim()) return foldersData.data;
    const searchLower = search.toLowerCase();
    return foldersData.data.filter((folder) => folder.name.toLowerCase().includes(searchLower));
  }, [foldersData, search]);

  // Get folder name for breadcrumb
  const currentFolder = useMemo(() => {
    if (!folderId || !foldersData?.data) return null;
    return foldersData.data.find((f) => f.id === folderId);
  }, [folderId, foldersData]);

  const handleDelete = async () => {
    if (!deletingItem) return;
    try {
      await deleteItem.mutateAsync(deletingItem.id);
      setDeletingItem(null);
      await queryClient.invalidateQueries({ queryKey: ['item-folders'] });
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

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;

    const canWrite =
      can('stock.write') ||
      can('inventory.write') ||
      ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role ?? '');

    if (!canWrite) {
      toast({
        variant: 'destructive',
        title: 'Sin permisos',
        description: 'No tenés permiso para eliminar items. Pedile a un admin que te habilite.',
      });
      return;
    }

    setShowBulkDeleteConfirm(true);
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.size === 0) return;

    setIsBulkDeleting(true);
    const idsArray = Array.from(selectedIds);
    const results = await Promise.allSettled(
      idsArray.map((id) => deleteItem.mutateAsync(id))
    );

    const succeeded = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    setSelectedIds(new Set());
    setShowBulkDeleteConfirm(false);
    setIsBulkDeleting(false);

    if (succeeded > 0) {
      await queryClient.invalidateQueries({ queryKey: ['items'] });
      await queryClient.invalidateQueries({ queryKey: ['item-folders'] });
      toast({
        title: 'Items eliminados',
        description: `${succeeded} item${succeeded > 1 ? 's' : ''} eliminado${succeeded > 1 ? 's' : ''} correctamente.`,
      });
    }

    if (failed > 0) {
      toast({
        variant: 'destructive',
        title: 'Error al eliminar',
        description: `No se pudieron eliminar ${failed} item${failed > 1 ? 's' : ''}.`,
      });
    }
  };

  const isAllSelected = data && data.data.length > 0 && data.data.every((item) => selectedIds.has(item.id));
  const isSomeSelected = selectedIds.size > 0 && !isAllSelected;

  const handleSelectAll = () => {
    if (!data) return;
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(data.data.map((item) => item.id)));
    }
  };

  const handleSelectItem = (itemId: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(itemId)) {
      newSelected.delete(itemId);
    } else {
      newSelected.add(itemId);
    }
    setSelectedIds(newSelected);
  };

  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory/stock' },
    { label: 'Items', href: '/inventory/items' },
    ...(currentFolder ? [{ label: currentFolder.name, href: `/inventory/items?folderId=${folderId}` }] : []),
  ];

  const actions = (
    <div className="flex items-center gap-2">
      {folderId && (
        <Button size="sm" variant="outline" onClick={handleBackToFolders}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Volver a carpetas
        </Button>
      )}
      <Button
        size="sm"
        variant="outline"
        onClick={handleRefresh}
        disabled={isRefreshing}
      >
        <RefreshCw className={`h-4 w-4 mr-1.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        Actualizar
      </Button>
      {!folderId && (
        <>
          <Button size="sm" variant="outline" onClick={handleOpenCreateFolder}>
            <Folder className="h-4 w-4 mr-1.5" />
            Nueva carpeta
          </Button>
          <div className="flex items-center gap-1 border rounded-md p-1">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => handleViewModeChange('grid')}
              className="h-8 px-2"
            >
              <Grid className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => handleViewModeChange('list')}
              className="h-8 px-2"
            >
              <List className="h-4 w-4" />
            </Button>
          </div>
        </>
      )}
      {selectedIds.size > 0 && folderId && (
        <Button
          size="sm"
          variant="destructive"
          onClick={handleBulkDelete}
          disabled={isBulkDeleting}
        >
          <Trash2 className="h-4 w-4 mr-1.5" />
          {isBulkDeleting ? 'Eliminando...' : `Eliminar seleccionados (${selectedIds.size})`}
        </Button>
      )}
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
            placeholder={
              folderId
                ? 'Buscar por nombre, SKU, categoría o marca...'
                : 'Buscar carpetas por nombre...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>
      {currentFolder && (
        <Badge variant="secondary" className="text-sm">
          Carpeta: {currentFolder.name}
        </Badge>
      )}
    </div>
  );

  // Render folders view (when no folderId)
  if (!folderId) {
    return (
      <>
        <PageShell
          title="Items"
          description="Gestiona tu catálogo de productos"
          breadcrumbs={breadcrumbs}
          actions={actions}
          toolbar={toolbar}
        >
          {isLoadingFolders && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {[...Array(10)].map((_, i) => (
                <Skeleton key={i} className="h-32 w-full" />
              ))}
            </div>
          )}

          {foldersError && (
            <div className="p-8 text-center">
              <div className="max-w-md mx-auto">
                <p className="text-red-600 font-medium mb-2">Error al cargar las carpetas</p>
                <p className="text-sm text-gray-600 mb-4">
                  {(foldersError as Error).message || 'No se pudo conectar con el servidor'}
                </p>
                <Button onClick={handleRefresh} variant="outline" size="sm">
                  Reintentar
                </Button>
              </div>
            </div>
          )}

          {!isLoadingFolders && !foldersError && filteredFolders.length === 0 && (
            <div className="p-12 text-center">
              <div className="max-w-sm mx-auto">
                <Folder className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-sm font-semibold text-gray-900 mb-1">No hay carpetas</h3>
                <p className="text-xs text-gray-600 mb-4">
                  {search.trim()
                    ? 'No se encontraron carpetas con ese nombre.'
                    : 'Creá una carpeta para organizar tus items.'}
                </p>
                {!search.trim() && (
                  <Button onClick={handleOpenCreateFolder} size="sm">
                    <Folder className="h-4 w-4 mr-1.5" />
                    Crear carpeta
                  </Button>
                )}
              </div>
            </div>
          )}

          {!isLoadingFolders && filteredFolders.length > 0 && (
            <ItemsFoldersGrid
              folders={filteredFolders}
              onOpen={handleOpenFolder}
              onDelete={handleDeleteFolder}
              canDelete={
                can('stock.write') ||
                can('inventory.write') ||
                ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role ?? '')
              }
              viewMode={viewMode}
            />
          )}
        </PageShell>
        <CreateFolderDialog open={isCreateFolderOpen} onOpenChange={setIsCreateFolderOpen} />
        <ItemFormDialog
          open={isCreateOpen}
          onOpenChange={(open) => {
            setIsCreateOpen(open);
            if (!open) {
              queryClient.invalidateQueries({ queryKey: ['item-folders'] });
            }
          }}
          folderId={folderId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['item-folders'] });
            queryClient.invalidateQueries({ queryKey: ['items'] });
          }}
        />
      </>
    );
  }

  // Render table view (when folderId exists)
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
                    {debouncedSearch ? 'Crear nuevo item' : 'Crear primer item'}
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b border-gray-200">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                          <Checkbox
                            checked={isAllSelected}
                            onCheckedChange={handleSelectAll}
                            aria-label="Seleccionar todos"
                          />
                        </th>
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
                        return (
                          <tr key={item.id} className="hover:bg-gray-50">
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Checkbox
                                checked={selectedIds.has(item.id)}
                                onCheckedChange={() => handleSelectItem(item.id)}
                                aria-label={`Seleccionar ${item.model || item.name}`}
                              />
                            </td>
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
                              <div className="text-sm text-gray-600">{conditionLabel(item.condition)}</div>
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
                                {(can('stock.write') || can('inventory.write') || ['OWNER', 'ADMIN', 'MANAGER'].includes(user?.role ?? '')) && (
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

      <ItemFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        folderId={folderId}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['items'] });
          queryClient.invalidateQueries({ queryKey: ['item-folders'] });
        }}
      />
      <ItemFormDialog
        open={!!editingItem}
        onOpenChange={(open) => !open && setEditingItem(null)}
        item={editingItem}
        onSuccess={() => {
          queryClient.invalidateQueries({ queryKey: ['items'] });
          queryClient.invalidateQueries({ queryKey: ['item-folders'] });
        }}
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

      <AlertDialog open={showBulkDeleteConfirm} onOpenChange={setShowBulkDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar items seleccionados</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que querés eliminar {selectedIds.size} item{selectedIds.size > 1 ? 's' : ''}? Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmBulkDelete}
              disabled={isBulkDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isBulkDeleting ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
