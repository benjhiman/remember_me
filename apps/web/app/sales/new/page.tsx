'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEffect } from 'react';
import { SaleForm } from '@/components/sales/sale-form';
import { useCreateSale } from '@/lib/api/hooks/use-sale-mutations';

export default function NewSalePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const createSale = useCreateSale();

  useEffect(() => {
    if (!user) {
      router.push('/login');
    }
  }, [user, router]);

  if (!user) {
    return null;
  }

  const handleSubmit = async (data: any) => {
    try {
      await createSale.mutateAsync(data);
      // Redirect is handled by the mutation
    } catch (error) {
      console.error('Error creating sale:', error);
    }
  };

  const handleCancel = () => {
    router.push('/sales');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Crear Venta</h1>
          <p className="text-gray-600">Crear una nueva venta desde reservas de stock</p>
        </div>

        {createSale.isError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              Error: {(createSale.error as Error)?.message || 'Error al crear la venta'}
            </p>
          </div>
        )}

        <SaleForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={createSale.isPending}
        />
      </div>
    </div>
  );
}
