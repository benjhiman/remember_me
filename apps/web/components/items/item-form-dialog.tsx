'use client';

import { useState, useEffect } from 'react';
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
import { useCreateItem, useUpdateItem, type CreateItemDto, type UpdateItemDto } from '@/lib/api/hooks/use-item-mutations';
import type { Item } from '@/lib/api/hooks/use-items';

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
}

export function ItemFormDialog({ open, onOpenChange, item }: ItemFormDialogProps) {
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const [formData, setFormData] = useState<CreateItemDto>({
    name: '',
    sku: '',
    category: '',
    brand: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        sku: item.sku || '',
        category: item.category || '',
        brand: item.brand || '',
        description: item.description || '',
        isActive: item.isActive,
      });
    } else {
      setFormData({
        name: '',
        sku: '',
        category: '',
        brand: '',
        description: '',
        isActive: true,
      });
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim() || formData.name.length < 2) {
      return;
    }

    try {
      if (item) {
        await updateItem.mutateAsync({ id: item.id, dto: formData });
      } else {
        await createItem.mutateAsync(formData);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = createItem.isPending || updateItem.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Item' : 'Nuevo Item'}</DialogTitle>
          <DialogDescription>
            {item ? 'Actualiza la información del item' : 'Agrega un nuevo item a tu catálogo'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Nombre *
              </label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
                minLength={2}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="sku" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                SKU
              </label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="category" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Categoría
              </label>
              <Input
                id="category"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="brand" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Marca
              </label>
              <Input
                id="brand"
                value={formData.brand}
                onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="description" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Descripción
              </label>
              <textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                disabled={isLoading}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim() || formData.name.length < 2}>
              {isLoading ? 'Guardando...' : item ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
