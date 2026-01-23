'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEffect } from 'react';
import { SaleForm } from '@/components/sales/sale-form';
import { useSale } from '@/lib/api/hooks/use-sale';
import { useUpdateSale } from '@/lib/api/hooks/use-sale-mutations';

export default function EditSalePage() {
  const router = useRouter();
  const params = useParams();
  const saleId = params.id as string;
  const { user } = useAuthStore();
  const { data: sale, isLoading, error } = useSale(saleId);
  const updateSale = useUpdateSale(saleId);

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Cargando venta...</p>
        </div>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Error</h1>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">
              {(error as Error)?.message || 'Venta no encontrada'}
            </p>
            <button
              onClick={() => router.push('/sales')}
              className="mt-4 text-sm text-red-600 underline"
            >
              Volver a ventas
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (data: any) => {
    try {
      // For update, only send customer fields and optional fields
      await updateSale.mutateAsync({
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        discount: data.discount,
        notes: data.notes,
      });
      // Redirect is handled by the mutation
    } catch (error) {
      console.error('Error updating sale:', error);
    }
  };

  const handleCancel = () => {
    router.push(`/sales/${saleId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Editar Venta</h1>
          <p className="text-gray-600">Modificar información de la venta</p>
        </div>

        {updateSale.isError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              Error: {(updateSale.error as Error)?.message || 'Error al actualizar la venta'}
            </p>
          </div>
        )}

        <SaleForm
          sale={sale}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={updateSale.isPending}
        />
      </div>
    </div>
  );
}
