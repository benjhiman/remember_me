'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEffect } from 'react';
import { LeadForm } from '@/components/leads/lead-form';
import { useCreateLead } from '@/lib/api/hooks/use-lead-mutations';

export default function NewLeadPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const createLead = useCreateLead();

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
      await createLead.mutateAsync(data);
      // Redirect is handled by the mutation
    } catch (error) {
      // Error is handled by the mutation
      console.error('Error creating lead:', error);
    }
  };

  const handleCancel = () => {
    router.push('/leads');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Crear Lead</h1>
          <p className="text-gray-600">Agregar un nuevo lead al CRM</p>
        </div>

        {createLead.isError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              Error: {(createLead.error as Error)?.message || 'Error al crear el lead'}
            </p>
          </div>
        )}

        <LeadForm
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={createLead.isPending}
        />
      </div>
    </div>
  );
}
