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
import { useCreateFolder } from '@/lib/api/hooks/use-item-folders';
import { Loader2 } from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';

interface CreateFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateFolderDialog({ open, onOpenChange }: CreateFolderDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [error, setError] = useState('');
  const createFolder = useCreateFolder();

  useEffect(() => {
    if (!open) {
      setName('');
      setDescription('');
      setError('');
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate
    const nameTrimmed = name.trim();
    if (!nameTrimmed) {
      setError('El nombre de la carpeta es requerido');
      return;
    }

    if (nameTrimmed.length < 1) {
      setError('El nombre debe tener al menos 1 carácter');
      return;
    }

    try {
      await createFolder.mutateAsync({
        name: nameTrimmed,
        description: description.trim() || undefined,
      });
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nueva carpeta</DialogTitle>
          <DialogDescription>
            Creá una carpeta para organizar tus items (ej: iPhone, iPad, Samsung).
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre de la carpeta</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                placeholder="Ej: iPhone, iPad, Samsung"
                disabled={createFolder.isPending}
                autoFocus
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Descripción (opcional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción de la carpeta..."
                rows={3}
                disabled={createFolder.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createFolder.isPending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={createFolder.isPending || !name.trim()}>
              {createFolder.isPending ? (
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
