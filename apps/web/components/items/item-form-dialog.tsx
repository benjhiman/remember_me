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
import { useItemFolders } from '@/lib/api/hooks/use-item-folders';
import { Loader2 } from 'lucide-react';

interface ItemFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: Item | null;
  folderId?: string | null; // If provided, item will be assigned to this folder (from context)
  onSuccess?: () => void;
}

const STORAGE_OPTIONS = [64, 128, 256, 512, 1024, 2048];
const CONDITION_OPTIONS = [
  { value: 'NEW', label: 'NEW' },
  { value: 'USED', label: 'Usado' },
  { value: 'OEM', label: 'OEM' },
];

export function ItemFormDialog({ open, onOpenChange, item, folderId, onSuccess }: ItemFormDialogProps) {
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const { data: foldersData } = useItemFolders(!folderId && open); // Only fetch folders if not in folder context
  
  // Find default folder to preselect
  const defaultFolder = foldersData?.data?.find((f) => f.isDefault);
  
  const [formData, setFormData] = useState<CreateItemDto | UpdateItemDto>({
    brand: '',
    model: '',
    storageGb: 128,
    condition: 'NEW',
    color: '',
    sku: '',
    category: '',
    description: '',
    isActive: true,
    folderId: folderId || defaultFolder?.id || undefined, // Preselect default folder if available
  });
  const [folderError, setFolderError] = useState('');

  useEffect(() => {
    if (item) {
      setFormData({
        name: item.name,
        brand: item.brand || '',
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
      // Find default folder when dialog opens (if not in folder context)
      const defaultFolderOnOpen = foldersData?.data?.find((f) => f.isDefault);
      setFormData({
        brand: '',
        model: '',
        storageGb: 128,
        condition: 'NEW',
        color: '',
        sku: '',
        category: '',
        description: '',
        isActive: true,
        folderId: folderId || defaultFolderOnOpen?.id || undefined, // Preselect default folder
      });
      setFolderError('');
    }
  }, [item, open, folderId, foldersData]);

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
      
      // FolderId validation: if not in folder context, ensure one is selected
      // (Backend will auto-assign to default if not provided, but we validate for UX)
      const createData = formData as CreateItemDto;
      // Note: Backend will auto-assign to default folder if folderId is not provided
      // So we don't need to block submission, but we can show a warning if user explicitly wants to
      setFolderError('');
    } else {
      // Update mode: at least one field
      if (!formData.brand?.trim() && !formData.model?.trim() && !formData.color?.trim()) return;
    }

    try {
      if (item) {
        await updateItem.mutateAsync({ id: item.id, dto: formData as UpdateItemDto });
      } else {
        const createData = formData as CreateItemDto;
        // Ensure folderId is set (from context or form)
        await createItem.mutateAsync({
          ...createData,
          folderId: folderId || createData.folderId,
        });
      }
      onOpenChange(false);
      if (onSuccess) {
        onSuccess();
      }
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
        // Note: folderId is optional - backend will auto-assign to default if not provided
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
                  placeholder="APPLE"
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

            {/* Folder selection - only show when creating from root (not inside a folder) */}
            {!item && !folderId && (
              <div className="space-y-2">
                <Label htmlFor="folderId">
                  Carpeta <span className="text-muted-foreground">(opcional, por defecto: IPHONE)</span>
                </Label>
                <Select
                  value={(formData as CreateItemDto).folderId || ''}
                  onValueChange={(v) => {
                    setFormData({ ...formData, folderId: v } as CreateItemDto);
                    setFolderError('');
                  }}
                  disabled={isLoading}
                >
                  <SelectTrigger id="folderId">
                    <SelectValue placeholder="Se usará carpeta IPHONE por defecto" />
                  </SelectTrigger>
                  <SelectContent>
                    {foldersData?.data && foldersData.data.length > 0 ? (
                      foldersData.data.map((folder) => (
                        <SelectItem key={folder.id} value={folder.id}>
                          {folder.name} ({folder.count} {folder.count === 1 ? 'item' : 'items'})
                        </SelectItem>
                      ))
                    ) : (
                      <div className="px-2 py-1.5 text-sm text-muted-foreground">
                        No hay carpetas disponibles
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {folderError && <p className="text-sm text-destructive">{folderError}</p>}
                <p className="text-xs text-muted-foreground">
                  Si no seleccionás una carpeta, el item se asignará automáticamente a &quot;IPHONE&quot;.
                </p>
              </div>
            )}

            {/* Show folder name when inside a folder (read-only) */}
            {!item && folderId && foldersData?.data && (
              <div className="space-y-2">
                <Label>Carpeta</Label>
                <Input
                  value={foldersData.data.find((f) => f.id === folderId)?.name || 'Cargando...'}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-muted-foreground">
                  El item se asignará automáticamente a esta carpeta.
                </p>
              </div>
            )}
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
