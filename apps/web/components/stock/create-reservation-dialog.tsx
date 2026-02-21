'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

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
  // TODO: Implementar diálogo de creación de reserva
  // Por ahora, solo muestra un placeholder para evitar errores de build
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crear Reserva</DialogTitle>
          <DialogDescription>
            Funcionalidad en desarrollo. Próximamente podrás crear reservas desde aquí.
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

export default CreateReservationDialog;
