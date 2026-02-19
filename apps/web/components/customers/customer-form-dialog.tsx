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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateCustomer, useUpdateCustomer, type CreateCustomerDto, type UpdateCustomerDto } from '@/lib/api/hooks/use-customer-mutations';
import { useSellers } from '@/lib/api/hooks/use-sellers';
import { useAuthStore } from '@/lib/store/auth-store';
import type { Customer } from '@/lib/api/hooks/use-customers';

interface CustomerFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
}

export function CustomerFormDialog({ open, onOpenChange, customer }: CustomerFormDialogProps) {
  const { user } = useAuthStore();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const isAdmin = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'OWNER';
  const { data: sellersData } = useSellers(isAdmin);

  const [formData, setFormData] = useState<CreateCustomerDto>({
    name: '',
    email: '',
    phone: '',
    taxId: '',
    city: '',
    address: '',
    instagram: '',
    web: '',
    assignedToId: undefined,
    notes: '',
    status: 'ACTIVE',
  });

  useEffect(() => {
    if (customer) {
      setFormData({
        name: customer.name,
        email: customer.email || '',
        phone: customer.phone || '',
        taxId: customer.taxId || '',
        city: customer.city || '',
        address: customer.address || '',
        instagram: customer.instagram || '',
        web: customer.web || '',
        assignedToId: customer.assignedToId || undefined,
        notes: customer.notes || '',
        status: customer.status,
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        taxId: '',
        city: '',
        address: '',
        instagram: '',
        web: '',
        assignedToId: undefined,
        notes: '',
        status: 'ACTIVE',
      });
    }
  }, [customer, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name.trim()) {
      return;
    }

    try {
      if (customer) {
        await updateCustomer.mutateAsync({ id: customer.id, dto: formData });
      } else {
        await createCustomer.mutateAsync(formData);
      }
      onOpenChange(false);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const isLoading = createCustomer.isPending || updateCustomer.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="text-xl">{customer ? 'Editar Cliente' : 'Nuevo Cliente'}</DialogTitle>
          <DialogDescription className="text-sm text-gray-600">
            {customer ? 'Actualiza la información del cliente' : 'Agrega un nuevo cliente a tu base de datos'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sm font-medium">
                  Nombre *
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone" className="text-sm font-medium">Teléfono</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="taxId" className="text-sm font-medium">CUIT/DNI</Label>
                <Input
                  id="taxId"
                  value={formData.taxId}
                  onChange={(e) => setFormData({ ...formData, taxId: e.target.value })}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="city" className="text-sm font-medium">Ciudad</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address" className="text-sm font-medium">Dirección</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  disabled={isLoading}
                  className="w-full"
                />
              </div>
            </div>
            {isAdmin && sellersData?.data && (
              <div className="space-y-2">
                <Label htmlFor="assignedToId">Vendedor Asignado</Label>
                <Select
                  value={formData.assignedToId || 'none'}
                  onValueChange={(value) => setFormData({ ...formData, assignedToId: value === 'none' ? undefined : value })}
                  disabled={isLoading}
                >
                  <SelectTrigger id="assignedToId">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin asignar</SelectItem>
                    {sellersData.data.map((seller) => (
                      <SelectItem key={seller.id} value={seller.id}>
                        {seller.name || seller.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="status">Estado</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value })}
                disabled={isLoading}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">Activo</SelectItem>
                  <SelectItem value="INACTIVE">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes" className="text-sm font-medium">
                Notas
              </Label>
              <textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                disabled={isLoading}
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
              />
            </div>
          </div>
          <DialogFooter className="pt-4 border-t">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !formData.name.trim()}>
              {isLoading ? 'Guardando...' : customer ? 'Actualizar' : 'Crear'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
