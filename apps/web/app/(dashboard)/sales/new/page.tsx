'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEffect } from 'react';
import { SaleFormZoho } from '@/components/sales/sale-form-zoho';
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
      <div className="max-w-5xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Create Invoice</h1>
        </div>

        {createSale.isError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              Error: {(createSale.error as Error)?.message || 'Error al crear la venta'}
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg border shadow-sm p-6">
          <SaleFormZoho
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            isLoading={createSale.isPending}
          />
        </div>
      </div>
    </div>
  );
}
