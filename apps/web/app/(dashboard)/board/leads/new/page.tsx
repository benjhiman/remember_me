'use client';

import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEffect } from 'react';
import { LeadForm } from '@/components/leads/lead-form';
import { useCreateLead } from '@/lib/api/hooks/use-lead-mutations';
import { Breadcrumb } from '@/components/ui/breadcrumb';

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
    router.push('/board/leads');
  };

  return (
    <div className="max-w-3xl mx-auto p-6">
      <Breadcrumb items={[{ label: 'Board', href: '/board' }, { label: 'Leads', href: '/board/leads' }, { label: 'Crear Lead' }]} />
      <div className="mb-6 mt-4">
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
  );
}
