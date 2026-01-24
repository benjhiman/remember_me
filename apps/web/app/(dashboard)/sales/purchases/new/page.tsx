'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useCreatePurchase } from '@/lib/api/hooks/use-purchase-mutations';
import { useVendors } from '@/lib/api/hooks/use-vendors';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { formatCurrency } from '@/lib/utils/purchase-utils';
import { Plus, Trash2, X } from 'lucide-react';

const purchaseLineSchema = z.object({
  description: z.string().min(1, 'Descripción requerida'),
  quantity: z.number().int().min(1, 'Cantidad debe ser al menos 1'),
  unitPriceCents: z.number().int().min(0, 'Precio debe ser >= 0'),
  sku: z.string().optional(),
});

const purchaseSchema = z.object({
  vendorId: z.string().min(1, 'Proveedor requerido'),
  notes: z.string().optional(),
  lines: z.array(purchaseLineSchema).min(1, 'Debe tener al menos una línea'),
});

type PurchaseFormData = z.infer<typeof purchaseSchema>;

export default function NewPurchasePage() {
  const router = useRouter();
  const { can } = usePermissions();
  const createPurchase = useCreatePurchase();
  const { data: vendorsData } = useVendors({ limit: 100, enabled: true });

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      vendorId: '',
      notes: '',
      lines: [{ description: '', quantity: 1, unitPriceCents: 0, sku: '' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: 'lines',
  });

  const lines = watch('lines');

  // Calculate totals
  const subtotalCents = lines.reduce(
    (sum, line) => sum + (line.quantity || 0) * (line.unitPriceCents || 0),
    0,
  );
  const taxCents = 0; // Placeholder
  const totalCents = subtotalCents + taxCents;

  const onSubmit = async (data: PurchaseFormData) => {
    try {
      const purchase = await createPurchase.mutateAsync({
        vendorId: data.vendorId,
        notes: data.notes,
        lines: data.lines.map((line) => ({
          description: line.description,
          quantity: line.quantity,
          unitPriceCents: line.unitPriceCents,
          sku: line.sku || undefined,
        })),
      });
      router.push(`/sales/purchases/${(purchase as any).id}`);
    } catch (error) {
      // Error handled by mutation
    }
  };

  const breadcrumbs = [
    { label: 'Ventas', href: '/sales' },
    { label: 'Purchases', href: '/sales/purchases' },
    { label: 'Nueva Compra', href: '#' },
  ];

  if (!can('purchases.write')) {
    return (
      <PageShell title="Sin permisos" breadcrumbs={breadcrumbs}>
        <div className="p-8 text-center">
          <p className="text-red-600 font-medium">No tenés permisos para crear compras.</p>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Nueva Compra"
      description="Crear una nueva orden de compra"
      breadcrumbs={breadcrumbs}
      actions={
        <Button variant="outline" size="sm" onClick={() => router.back()}>
          <X className="h-4 w-4 mr-1.5" />
          Cancelar
        </Button>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Vendor Selection */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Proveedor</h3>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Proveedor <span className="text-red-500">*</span>
            </label>
            <select
              {...register('vendorId')}
              className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Seleccionar proveedor...</option>
              {vendorsData?.items.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.name}
                </option>
              ))}
            </select>
            {errors.vendorId && (
              <p className="text-sm text-red-500 mt-1">{errors.vendorId.message}</p>
            )}
          </div>
        </div>

        {/* Lines Editor */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Líneas de Compra</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => append({ description: '', quantity: 1, unitPriceCents: 0, sku: '' })}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Agregar Línea
            </Button>
          </div>

          <div className="space-y-4">
            {fields.map((field, index) => (
              <div key={field.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-700">Línea {index + 1}</span>
                  {fields.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => remove(index)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Descripción <span className="text-red-500">*</span>
                    </label>
                    <Input
                      {...register(`lines.${index}.description`)}
                      placeholder="Descripción del item"
                      className="text-sm"
                    />
                    {errors.lines?.[index]?.description && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.lines[index]?.description?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Cantidad <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      {...register(`lines.${index}.quantity`, { valueAsNumber: true })}
                      placeholder="1"
                      min="1"
                      className="text-sm"
                    />
                    {errors.lines?.[index]?.quantity && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.lines[index]?.quantity?.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Precio Unit. (centavos) <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="number"
                      {...register(`lines.${index}.unitPriceCents`, { valueAsNumber: true })}
                      placeholder="0"
                      min="0"
                      className="text-sm"
                    />
                    {errors.lines?.[index]?.unitPriceCents && (
                      <p className="text-xs text-red-500 mt-1">
                        {errors.lines[index]?.unitPriceCents?.message}
                      </p>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">SKU (opcional)</label>
                  <Input
                    {...register(`lines.${index}.sku`)}
                    placeholder="SKU del item"
                    className="text-sm"
                  />
                </div>

                {/* Line Total */}
                <div className="text-right text-sm text-gray-600">
                  Total línea:{' '}
                  <span className="font-medium">
                    {formatCurrency(
                      (lines[index]?.quantity || 0) * (lines[index]?.unitPriceCents || 0),
                    )}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {errors.lines && typeof errors.lines === 'object' && 'message' in errors.lines && (
            <p className="text-sm text-red-500 mt-2">{errors.lines.message as string}</p>
          )}
        </div>

        {/* Notes */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">Notas</h3>
          <textarea
            {...register('notes')}
            placeholder="Notas adicionales (opcional)"
            className="w-full min-h-[100px] rounded-md border border-input bg-background px-3 py-2 text-sm"
          />
        </div>

        {/* Totals Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-end">
            <div className="w-64 space-y-2">
              <div className="flex justify-between text-sm text-gray-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(subtotalCents)}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Impuestos:</span>
                <span>{formatCurrency(taxCents)}</span>
              </div>
              <div className="flex justify-between text-base font-semibold text-gray-900 pt-2 border-t border-gray-200">
                <span>Total:</span>
                <span>{formatCurrency(totalCents)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createPurchase.isPending}>
            {createPurchase.isPending ? 'Creando...' : 'Crear Compra'}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
