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
import { Label } from '@/components/ui/label';
import { usePinFolder } from '@/lib/api/hooks/use-item-folders';
import { Loader2 } from 'lucide-react';

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFolderDialog({ open, onOpenChange }: CreateFolderDialogProps) {
  const [prefix, setPrefix] = useState('');
  const [error, setError] = useState('');
  const pinFolder = usePinFolder();

  useEffect(() => {
    if (!open) {
      setPrefix('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    const prefixTrimmed = prefix.trim().toUpperCase();
    if (!prefixTrimmed) {
      setError('El prefijo es requerido');
      return;
    }

    if (!/^[A-Z0-9]{2,8}$/.test(prefixTrimmed)) {
      setError('El prefijo debe tener entre 2 y 8 caracteres alfanuméricos');
      return;
    }

    try {
      await pinFolder.mutateAsync(prefixTrimmed);
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setPrefix(value);
    if (error) setError('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva carpeta</DialogTitle>
          <DialogDescription>
            Creá una carpeta para organizar items por prefijo de SKU (ej: IPH, IPAD, SAM).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="prefix">Prefijo</Label>
              <Input
                id="prefix"
                value={prefix}
                onChange={handleChange}
                placeholder="Ej: IPH, IPAD, SAM"
                maxLength={8}
                disabled={pinFolder.isPending}
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
              <p className="text-xs text-muted-foreground">
                Solo letras y números. Se convertirá a mayúsculas automáticamente.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pinFolder.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pinFolder.isPending || !prefix.trim()}>
              {pinFolder.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Creando...
                </>
              ) : (
                'Crear carpeta'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
