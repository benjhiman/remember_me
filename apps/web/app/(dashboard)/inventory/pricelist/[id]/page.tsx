'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageShell } from '@/components/layout/page-shell';
import { usePriceList } from '@/lib/api/hooks/use-price-lists';
import { useUpdatePriceListItem } from '@/lib/api/hooks/use-price-lists';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowLeft, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function PriceListDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const [priceListId, setPriceListId] = useState<string | null>(null);
  const router = useRouter();
  
  useEffect(() => {
    params.then((resolved) => {
      setPriceListId(resolved.id);
    });
  }, [params]);
  
  const { data: priceList, isLoading } = usePriceList(priceListId);
  const updatePriceListItem = useUpdatePriceListItem();
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');

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
        <Button variant="outline" onClick={() => router.push('/inventory/pricelist')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      }
    >
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead>SKU Base</TableHead>
              <TableHead className="text-right">Precio Base</TableHead>
              <TableHead className="text-right">Excepciones</TableHead>
              <TableHead className="text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceList.items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No hay items en esta lista.
                </TableCell>
              </TableRow>
            ) : (
              priceList.items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{item.displayName}</TableCell>
                  <TableCell className="text-muted-foreground">{item.baseSku || '-'}</TableCell>
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
                    {item.overrideCount > 0 ? (
                      <Badge variant="secondary">{item.overrideCount}</Badge>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {editingItemId === item.id ? null : (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleEditPrice(item.id, item.basePrice ?? null)}
                        >
                          {item.basePrice !== null && item.basePrice !== undefined ? 'Editar' : 'Agregar precio'}
                        </Button>
                        {item.overrideCount === 0 && (
                          <Button size="sm" variant="ghost" disabled title="Próximamente">
                            <Plus className="h-4 w-4 mr-1" />
                            Excepción
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </PageShell>
  );
}
