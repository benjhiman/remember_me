'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useLeads } from '@/lib/api/hooks/use-leads';
import { useStockReservations } from '@/lib/api/hooks/use-stock-reservations';
import type { Sale } from '@/types/sales';

const createSaleSchema = z.object({
  leadId: z.string().optional(),
  stockReservationIds: z.array(z.string()).min(1, 'Debe seleccionar al menos una reserva'),
  customerName: z.string().min(1, 'El nombre del cliente es requerido'),
  customerEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  discount: z.number().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
});

const updateSaleSchema = z.object({
  customerName: z.string().min(1, 'El nombre del cliente es requerido'),
  customerEmail: z.string().email('Email inválido').optional().or(z.literal('')),
  customerPhone: z.string().optional(),
  discount: z.number().optional(),
  notes: z.string().optional(),
});

type CreateSaleFormData = z.infer<typeof createSaleSchema>;
type UpdateSaleFormData = z.infer<typeof updateSaleSchema>;
type SaleFormData = CreateSaleFormData | UpdateSaleFormData;

interface SaleFormProps {
  sale?: Sale;
  onSubmit: (data: SaleFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SaleForm({ sale, onSubmit, onCancel, isLoading }: SaleFormProps) {
  const { data: leadsData } = useLeads({ limit: 50, enabled: true });
  const { data: reservationsData } = useStockReservations({ status: 'ACTIVE', limit: 100 });

  const [selectedReservations, setSelectedReservations] = useState<string[]>(
    sale?.stockReservations?.map((r) => r.id) || []
  );
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string>(sale?.leadId || '');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<SaleFormData>({
    resolver: zodResolver(sale ? updateSaleSchema : createSaleSchema),
    defaultValues: {
      leadId: sale?.leadId || '',
      stockReservationIds: sale?.stockReservations?.map((r) => r.id) || [],
      customerName: sale?.customerName || '',
      customerEmail: sale?.customerEmail || '',
      customerPhone: sale?.customerPhone || '',
      discount: sale?.discount ? parseFloat(sale.discount) : undefined,
      currency: sale?.currency || 'USD',
      notes: sale?.notes || '',
    },
  });

  useEffect(() => {
    setValue('stockReservationIds', selectedReservations);
  }, [selectedReservations, setValue]);

  useEffect(() => {
    setValue('leadId', selectedLeadId);
  }, [selectedLeadId, setValue]);

  const filteredLeads = leadsData?.data.filter(
    (lead) =>
      lead.name.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.email?.toLowerCase().includes(leadSearch.toLowerCase()) ||
      lead.phone?.includes(leadSearch)
  );

  const toggleReservation = (reservationId: string) => {
    setSelectedReservations((prev) =>
      prev.includes(reservationId)
        ? prev.filter((id) => id !== reservationId)
        : [...prev, reservationId]
    );
  };

  const handleFormSubmit = (data: SaleFormData) => {
    onSubmit({ ...data, stockReservationIds: selectedReservations, leadId: selectedLeadId || undefined });
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
      {/* Lead Selection */}
      <Card>
        <CardHeader>
          <CardTitle>Asociar Lead (Opcional)</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Buscar Lead</label>
            <Input
              placeholder="Buscar por nombre, email o teléfono..."
              value={leadSearch}
              onChange={(e) => setLeadSearch(e.target.value)}
            />
            {leadSearch && filteredLeads && filteredLeads.length > 0 && (
              <div className="mt-2 border rounded-lg max-h-40 overflow-y-auto">
                {filteredLeads.map((lead) => (
                  <div
                    key={lead.id}
                    className={`p-2 cursor-pointer hover:bg-gray-50 ${
                      selectedLeadId === lead.id ? 'bg-blue-50' : ''
                    }`}
                    onClick={() => {
                      setSelectedLeadId(lead.id);
                      setLeadSearch(lead.name);
                    }}
                  >
                    <div className="text-sm font-medium">{lead.name}</div>
                    {lead.email && <div className="text-xs text-gray-500">{lead.email}</div>}
                  </div>
                ))}
              </div>
            )}
            {selectedLeadId && (
              <div className="mt-2 text-sm text-gray-600">
                Lead seleccionado: {filteredLeads?.find((l) => l.id === selectedLeadId)?.name}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setSelectedLeadId('');
                    setLeadSearch('');
                  }}
                  className="ml-2"
                >
                  Quitar
                </Button>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-500">
            O ingresa el Lead ID manualmente:
          </div>
          <Input
            placeholder="lead-123 (opcional)"
            value={selectedLeadId}
            onChange={(e) => setSelectedLeadId(e.target.value)}
          />
        </CardContent>
      </Card>

      {/* Reservations Selection - Only for create */}
      {!sale && (
        <Card>
          <CardHeader>
            <CardTitle>
              Reservas de Stock <span className="text-red-500">*</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reservationsData?.data && reservationsData.data.length > 0 ? (
              <div className="space-y-2 max-h-60 overflow-y-auto border rounded-lg p-2">
                {reservationsData.data.map((reservation) => (
                  <div
                    key={reservation.id}
                    className={`p-2 border rounded cursor-pointer ${
                      selectedReservations.includes(reservation.id)
                        ? 'bg-blue-50 border-blue-300'
                        : 'hover:bg-gray-50'
                    }`}
                    onClick={() => toggleReservation(reservation.id)}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selectedReservations.includes(reservation.id)}
                        onChange={() => toggleReservation(reservation.id)}
                        className="cursor-pointer"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">
                          {reservation.stockItem?.model || 'N/A'}
                        </div>
                        <div className="text-xs text-gray-500">
                          Cantidad: {reservation.quantity} | {reservation.stockItem?.sku || 'Sin SKU'}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-gray-500">
                No hay reservas activas disponibles. Crea reservas desde{' '}
                <a href="/stock/reservations" className="text-blue-600 hover:underline">
                  /stock/reservations
                </a>
              </div>
            )}
            {!sale && selectedReservations.length === 0 && (
              <p className="text-sm text-red-500">Debe seleccionar al menos una reserva</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Show existing reservations in edit mode */}
      {sale && sale.stockReservations && sale.stockReservations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Reservas de Stock (No modificables)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sale.stockReservations.map((reservation) => (
                <div key={reservation.id} className="p-2 border rounded bg-gray-50">
                  <div className="text-sm font-medium">
                    {reservation.stockItem?.model || 'N/A'}
                  </div>
                  <div className="text-xs text-gray-500">
                    Cantidad: {reservation.quantity} | Estado: {reservation.status}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Customer Data */}
      <Card>
        <CardHeader>
          <CardTitle>Datos del Cliente</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <Input {...register('customerName')} placeholder="Nombre del cliente" />
            {errors.customerName && (
              <p className="text-sm text-red-500 mt-1">{errors.customerName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input type="email" {...register('customerEmail')} placeholder="email@ejemplo.com" />
            {errors.customerEmail && (
              <p className="text-sm text-red-500 mt-1">{errors.customerEmail.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Teléfono</label>
            <Input {...register('customerPhone')} placeholder="+1234567890" />
          </div>
        </CardContent>
      </Card>

      {/* Optional Fields */}
      <Card>
        <CardHeader>
          <CardTitle>Opcionales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Descuento</label>
            <Input
              type="number"
              step="0.01"
              {...register('discount', { valueAsNumber: true })}
              placeholder="0.00"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Moneda</label>
            <Input {...register('currency')} placeholder="USD" defaultValue="USD" />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Notas</label>
            <textarea
              className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
              {...register('notes')}
              placeholder="Notas adicionales..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button
          type="submit"
          disabled={isLoading || (!sale && selectedReservations.length === 0)}
        >
          {isLoading ? 'Guardando...' : sale ? 'Actualizar' : 'Crear Venta'}
        </Button>
      </div>
    </form>
  );
}
