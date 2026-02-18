'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { PageShell } from '@/components/layout/page-shell';
import { usePriceLists, useDeletePriceList } from '@/lib/api/hooks/use-price-lists';
import { CreatePriceListDialog } from '@/components/price-lists/create-price-list-dialog';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { FileText, Plus, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function InventoryPricelistPage() {
  const router = useRouter();
  const { data: priceListsData, isLoading } = usePriceLists();
  const deletePriceList = useDeletePriceList();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [priceListToDelete, setPriceListToDelete] = useState<string | null>(null);

  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Listas de Precios', href: '/inventory/pricelist' },
  ];

  const priceLists = priceListsData?.data || [];

  const handleDeleteClick = (e: React.MouseEvent, priceListId: string, priceListName: string) => {
    e.stopPropagation(); // Prevent card click
    setPriceListToDelete(priceListId);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!priceListToDelete) return;
    
    try {
      await deletePriceList.mutateAsync(priceListToDelete);
      setDeleteDialogOpen(false);
      setPriceListToDelete(null);
    } catch (error) {
      // Error handled by hook
      console.error('Error deleting price list:', error);
    }
  };

  if (isLoading) {
    return (
      <PageShell
        title="Listas de Precios"
        description="Personalizá los precios de tus productos con flexibilidad"
        breadcrumbs={breadcrumbs}
      >
        <div className="flex items-center justify-center p-12">
          <p className="text-muted-foreground">Cargando...</p>
        </div>
      </PageShell>
    );
  }

  if (priceLists.length === 0) {
    return (
      <PageShell
        title="Listas de Precios"
        description="Personalizá los precios de tus productos con flexibilidad"
        breadcrumbs={breadcrumbs}
      >
        <ZohoEmptyState
          title="Listas de Precios"
          headline="Personalizá los precios de tus productos con flexibilidad"
          description="Creá y administrá múltiples listas de precios para distintos tipos de clientes."
          primaryActionLabel="CREAR LISTA DE PRECIOS"
          onPrimaryAction={() => setCreateDialogOpen(true)}
          showDropdown
        />
        <CreatePriceListDialog
          open={createDialogOpen}
          onOpenChange={setCreateDialogOpen}
          onSuccess={(priceListId) => {
            // Use window.location for more reliable navigation after state changes
            window.location.href = `/inventory/pricelist/${priceListId}`;
          }}
        />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Listas de Precios"
      description="Personalizá los precios de tus productos con flexibilidad"
      breadcrumbs={breadcrumbs}
      actions={
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Crear Lista de Precios
        </Button>
      }
    >
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {priceLists.map((list) => (
          <Card
            key={list.id}
            className="cursor-pointer hover:shadow-md transition-shadow relative"
            onClick={() => router.push(`/inventory/pricelist/${list.id}`)}
          >
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-1">
                  <FileText className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">{list.name}</CardTitle>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                  onClick={(e) => handleDeleteClick(e, list.id, list.name)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                {list.itemCount} {list.itemCount === 1 ? 'item' : 'items'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Actualizada: {format(new Date(list.updatedAt), 'dd/MM/yyyy', { locale: es })}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
      
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lista de precios?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la lista de precios y todos sus precios asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePriceList.isPending}
            >
              {deletePriceList.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <CreatePriceListDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onSuccess={(priceListId) => {
          // Use window.location for more reliable navigation after state changes
          window.location.href = `/inventory/pricelist/${priceListId}`;
        }}
      />
    </PageShell>
  );
}
