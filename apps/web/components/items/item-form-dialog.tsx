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
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { useCreateItem, useUpdateItem, type CreateItemDto, type UpdateItemDto } from '@/lib/api/hooks/use-item-mutations';
import type { Item } from '@/lib/api/hooks/use-items';
import { Loader2 } from 'lucide-react';

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
}

const STORAGE_OPTIONS = [64, 128, 256, 512, 1024, 2048];
const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'Nuevo' },
  { value: 'USED', label: 'Usado' },
  { value: 'REFURBISHED', label: 'Reacondicionado' },
  { value: 'OEM', label: 'OEM' },
];

export function ItemFormDialog({ open, onOpenChange, item }: ItemFormDialogProps) {
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const [formData, setFormData] = useState<CreateItemDto | UpdateItemDto>({
    brand: 'Apple',
    model: '',
    storageGb: 128,
    condition: 'NEW',
    color: '',
    sku: '',
    category: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        brand: item.brand || 'Apple',
        model: item.model || '',
        storageGb: item.storageGb || 128,
        condition: item.condition || 'NEW',
        color: item.color || '',
        sku: item.sku || '',
        category: item.category || '',
        description: item.description || '',
        isActive: item.isActive,
      });
    } else {
      setFormData({
        brand: 'Apple',
        model: '',
        storageGb: 128,
        condition: 'NEW',
        color: '',
        sku: '',
        category: '',
        description: '',
        isActive: true,
      });
    }
  }, [item, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validation
    if (!item) {
      // Create mode: all required fields
      if (!formData.brand?.trim() || formData.brand.length < 2) return;
      if (!formData.model?.trim() || formData.model.length < 2) return;
      if (!formData.storageGb || formData.storageGb < 1) return;
      if (!formData.condition) return;
      if (!formData.color?.trim() || formData.color.length < 2) return;
    } else {
      // Update mode: at least one field
      if (!formData.brand?.trim() && !formData.model?.trim() && !formData.color?.trim()) return;
    }

    try {
      if (item) {
        await updateItem.mutateAsync({ id: item.id, dto: formData as UpdateItemDto });
      } else {
        await createItem.mutateAsync(formData as CreateItemDto);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = createItem.isPending || updateItem.isPending;

  const canSubmit = item
    ? true // Update: at least one field changed
    : !!(
        formData.brand?.trim() &&
        formData.brand.length >= 2 &&
        formData.model?.trim() &&
        formData.model.length >= 2 &&
        formData.storageGb &&
        formData.storageGb >= 1 &&
        formData.condition &&
        formData.color?.trim() &&
        formData.color.length >= 2
      );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar Item' : 'Nuevo Item'}</DialogTitle>
          <DialogDescription>
            {item ? 'Actualiza la información del item' : 'Agrega un nuevo item a tu catálogo'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="brand">
                  Marca * {!item && <span className="text-muted-foreground">(ej: Apple)</span>}
                </Label>
                <Input
                  id="brand"
                  value={formData.brand || ''}
                  onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                  required={!item}
                  minLength={2}
                  disabled={isLoading}
                  placeholder="Apple"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">
                  Modelo * {!item && <span className="text-muted-foreground">(ej: iPhone 15 Pro)</span>}
                </Label>
                <Input
                  id="model"
                  value={formData.model || ''}
                  onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                  required={!item}
                  minLength={2}
                  disabled={isLoading}
                  placeholder="iPhone 15 Pro"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="storageGb">
                  Almacenamiento (GB) * {!item && <span className="text-muted-foreground">(ej: 128)</span>}
                </Label>
                <Select
                  value={formData.storageGb?.toString() || '128'}
                  onValueChange={(v) => setFormData({ ...formData, storageGb: parseInt(v, 10) })}
                  disabled={isLoading}
                >
                  <SelectTrigger id="storageGb">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STORAGE_OPTIONS.map((gb) => (
                      <SelectItem key={gb} value={gb.toString()}>
                        {gb} GB
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="condition">Condición *</Label>
                <Select
                  value={formData.condition || 'NEW'}
                  onValueChange={(v) => setFormData({ ...formData, condition: v as any })}
                  disabled={isLoading}
                >
                  <SelectTrigger id="condition">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITION_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="color">
                Color * {!item && <span className="text-muted-foreground">(ej: Natural Titanium)</span>}
              </Label>
              <Input
                id="color"
                value={formData.color || ''}
                onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                required={!item}
                minLength={2}
                disabled={isLoading}
                placeholder="Natural Titanium"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku || ''}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Categoría</Label>
                <Input
                  id="category"
                  value={formData.category || ''}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  disabled={isLoading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                value={formData.description || ''}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                disabled={isLoading}
                placeholder="Descripción adicional del item..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !canSubmit}>
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : item ? (
                'Actualizar'
              ) : (
                'Crear'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
