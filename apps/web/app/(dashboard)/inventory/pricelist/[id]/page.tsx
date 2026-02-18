'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { usePriceList, useUpdatePriceListItem, useDeletePriceList } from '@/lib/api/hooks/use-price-lists';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
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
import { ArrowLeft, Plus, FileText, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { PriceListItem } from '@/lib/api/hooks/use-price-lists';
import { GenerateWhatsAppListDialog } from '@/components/price-lists/generate-whatsapp-list-dialog';

export default function PriceListDetailPage({ params }: { params: Promise<{ id: string }> | { id: string } }) {
  const [priceListId, setPriceListId] = useState<string | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    // Handle both Promise and direct object cases
    if (params instanceof Promise) {
      params.then((resolved) => {
        setPriceListId(resolved.id);
      }).catch((error) => {
        console.error('Error resolving params:', error);
      });
    } else {
      setPriceListId(params.id);
    }
  }, [params]);
  
  const { data: priceList, isLoading } = usePriceList(priceListId);
  const updatePriceListItem = useUpdatePriceListItem();
  const deletePriceList = useDeletePriceList();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');
  const [generateDialogOpen, setGenerateDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Listas de Precios', href: '/inventory/pricelist' },
    { label: priceList?.name || 'Cargando...', href: `#` },
  ];

  const handleEditPrice = (itemId: string, currentPrice: number | null) => {
    setEditingItemId(itemId);
    setEditPrice(currentPrice?.toString() || '');
  };

  const handleSavePrice = async (itemId: string) => {
    const priceValue = editPrice.trim() === '' ? null : parseFloat(editPrice);
    if (priceValue !== null && (isNaN(priceValue) || priceValue < 0)) {
      return;
    }

    if (!priceListId) return;
    
    try {
      await updatePriceListItem.mutateAsync({
        priceListId: priceListId,
        priceListItemId: itemId,
        basePrice: priceValue,
      });
      setEditingItemId(null);
      setEditPrice('');
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setEditPrice('');
  };

  const handleDelete = async () => {
    if (!priceListId) return;
    
    try {
      await deletePriceList.mutateAsync(priceListId);
      router.push('/inventory/pricelist');
    } catch (error) {
      // Error handled by hook
    }
  };

  // Group items by condition
  const groupedItems = useMemo(() => {
    if (!priceList) return {};

    const groups: Record<string, PriceListItem[]> = {
      NEW: [],
      USED: [],
      OEM: [],
      UNKNOWN: [],
    };

    priceList.items.forEach((item) => {
      const condition = item.condition || 'UNKNOWN';
      if (groups[condition]) {
        groups[condition].push(item);
      } else {
        groups.UNKNOWN.push(item);
      }
    });

    // Sort each group by displayName
    Object.keys(groups).forEach((key) => {
      groups[key].sort((a, b) => a.displayName.localeCompare(b.displayName));
    });

    return groups;
  }, [priceList]);

  const conditionLabels: Record<string, string> = {
    NEW: 'Nuevos',
    USED: 'Usados',
    OEM: 'OEM',
    UNKNOWN: 'Otros',
  };

  const conditionOrder = ['NEW', 'USED', 'OEM', 'UNKNOWN'];

  if (isLoading) {
    return (
      <PageShell
        title="Cargando..."
        description=""
        breadcrumbs={breadcrumbs}
      >
        <div className="flex items-center justify-center p-12">
          <p className="text-muted-foreground">Cargando lista de precios...</p>
        </div>
      </PageShell>
    );
  }

  if (!priceList) {
    return (
      <PageShell
        title="Lista no encontrada"
        description=""
        breadcrumbs={breadcrumbs}
      >
        <div className="flex items-center justify-center p-12">
          <p className="text-muted-foreground">La lista de precios no existe.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={priceList.name}
      description={`${priceList.items.length} ${priceList.items.length === 1 ? 'item' : 'items'}`}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setGenerateDialogOpen(true)}>
            <FileText className="h-4 w-4 mr-2" />
            Generar Lista
          </Button>
          <Button variant="outline" onClick={() => router.push('/inventory/pricelist')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </div>
      }
    >
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead className="text-right">Precio Base</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceList.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                  No hay items en esta lista.
                </TableCell>
              </TableRow>
            ) : (
              conditionOrder.map((condition) => {
                const conditionItems = groupedItems[condition] || [];
                if (conditionItems.length === 0) return null;

                return (
                  <React.Fragment key={condition}>
                    {/* Condition Header */}
                    <TableRow className="bg-muted/50">
                      <TableCell colSpan={3} className="font-semibold text-sm">
                        {conditionLabels[condition]} ({conditionItems.length})
                      </TableCell>
                    </TableRow>
                    {/* Items in this condition */}
                    {conditionItems.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.displayName}</TableCell>
                        <TableCell className="text-right">
                          {editingItemId === item.id ? (
                            <div className="flex items-center justify-end gap-2">
                              <Input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editPrice}
                                onChange={(e) => setEditPrice(e.target.value)}
                                className="w-32"
                                placeholder="0.00"
                                autoFocus
                              />
                              <Button
                                size="sm"
                                onClick={() => handleSavePrice(item.id)}
                                disabled={updatePriceListItem.isPending}
                              >
                                Guardar
                              </Button>
                              <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <span className="font-medium">
                              {item.basePrice !== null && item.basePrice !== undefined
                                ? `$${item.basePrice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                : '-'}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingItemId === item.id ? null : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditPrice(item.id, item.basePrice ?? null)}
                            >
                              {item.basePrice !== null && item.basePrice !== undefined ? 'Editar' : 'Agregar precio'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </React.Fragment>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <GenerateWhatsAppListDialog
        open={generateDialogOpen}
        onOpenChange={setGenerateDialogOpen}
        priceListName={priceList.name}
        items={priceList.items}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lista de precios?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará la lista &quot;{priceList.name}&quot; y todos sus precios asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deletePriceList.isPending}
            >
              {deletePriceList.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </PageShell>
  );
}
