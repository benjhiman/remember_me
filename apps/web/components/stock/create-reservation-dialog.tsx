'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useItems } from '@/lib/api/hooks/use-items';
import { useCreateReservation } from '@/lib/api/hooks/use-stock-reservations';
import { Loader2, Search } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface CreateReservationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultItemId?: string;
}

export function CreateReservationDialog({
  open,
  onOpenChange,
  defaultItemId,
}: CreateReservationDialogProps) {
  const { toast } = useToast();
  const [itemSearch, setItemSearch] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string>(defaultItemId || '');
  const [quantity, setQuantity] = useState<number>(1);
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const createReservation = useCreateReservation();

  // Fetch items for selection
  const { data: itemsData, isLoading: itemsLoading } = useItems({
    q: itemSearch || undefined,
    limit: 50,
    enabled: open,
  });

  const items = useMemo(() => itemsData?.data || [], [itemsData?.data]);

  // Filter items based on search
  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return items;
    const searchLower = itemSearch.toLowerCase();
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(searchLower) ||
        item.sku?.toLowerCase().includes(searchLower) ||
        item.brand?.toLowerCase().includes(searchLower) ||
        item.model?.toLowerCase().includes(searchLower) ||
        item.color?.toLowerCase().includes(searchLower),
    );
  }, [items, itemSearch]);

  const selectedItem = items.find((item) => item.id === selectedItemId);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setItemSearch('');
      setSelectedItemId(defaultItemId || '');
      setQuantity(1);
      setCustomerName('');
      setNotes('');
      setExpiresAt('');
    } else if (defaultItemId) {
      setSelectedItemId(defaultItemId);
    }
  }, [open, defaultItemId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedItemId) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Debés seleccionar un item',
      });
      return;
    }

    if (quantity < 1) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'La cantidad debe ser al menos 1',
      });
      return;
    }

    try {
      await createReservation.mutateAsync({
        itemId: selectedItemId,
        quantity,
        customerName: customerName || undefined,
        notes: notes || undefined,
        expiresAt: expiresAt || undefined,
      });

      toast({
        title: 'Reserva creada',
        description: 'La reserva se creó correctamente',
      });

      onOpenChange(false);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error?.message || 'No se pudo crear la reserva',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear Reserva</DialogTitle>
          <DialogDescription>Reservá stock para un cliente</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Item Selection */}
          <div className="space-y-2">
            <Label htmlFor="item-search">Item *</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                id="item-search"
                placeholder="Buscar item por nombre, SKU, marca..."
                value={itemSearch}
                onChange={(e) => setItemSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {itemsLoading && (
              <div className="text-sm text-gray-500 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando items...
              </div>
            )}
            {!itemsLoading && filteredItems.length > 0 && (
              <div className="border border-gray-200 rounded-md max-h-48 overflow-y-auto">
                {filteredItems.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setSelectedItemId(item.id);
                      setItemSearch(item.name);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                      selectedItemId === item.id ? 'bg-blue-50 border-l-2 border-blue-500' : ''
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {item.brand && `${item.brand} `}
                      {item.model || item.name}
                      {item.storageGb && ` ${item.storageGb}GB`}
                      {item.color && ` ${item.color}`}
                    </div>
                    {item.sku && <div className="text-xs text-gray-500">SKU: {item.sku}</div>}
                  </button>
                ))}
              </div>
            )}
            {selectedItem && (
              <div className="text-sm text-gray-600 bg-gray-50 p-2 rounded">
                Seleccionado: {selectedItem.name}
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">Cantidad *</Label>
            <Input
              id="quantity"
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value, 10) || 1)}
              required
            />
          </div>

          {/* Customer Name */}
          <div className="space-y-2">
            <Label htmlFor="customer-name">Cliente (opcional)</Label>
            <Input
              id="customer-name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Nombre del cliente"
            />
          </div>

          {/* Expires At */}
          <div className="space-y-2">
            <Label htmlFor="expires-at">Expira (opcional)</Label>
            <Input
              id="expires-at"
              type="datetime-local"
              value={expiresAt}
              onChange={(e) => setExpiresAt(e.target.value)}
            />
            <p className="text-xs text-gray-500">
              Si no se especifica, expirará en 24 horas
            </p>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notas (opcional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notas adicionales sobre la reserva"
              rows={3}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createReservation.isPending}>
              {createReservation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear Reserva'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
