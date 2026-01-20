'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEffect } from 'react';
import { LeadForm } from '@/components/leads/lead-form';
import { useLead } from '@/lib/api/hooks/use-lead';
import { useUpdateLead } from '@/lib/api/hooks/use-lead-mutations';

export default function EditLeadPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;
  const { user } = useAuthStore();
  const { data: lead, isLoading, error } = useLead(leadId);
  const updateLead = useUpdateLead(leadId);

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
          <p className="mt-2 text-gray-600">Cargando lead...</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-3xl mx-auto p-6">
          <div className="mb-6">
            <h1 className="text-3xl font-bold">Error</h1>
          </div>
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600">
              {(error as Error)?.message || 'Lead no encontrado'}
            </p>
            <button
              onClick={() => router.push('/leads')}
              className="mt-4 text-sm text-red-600 underline"
            >
              Volver a leads
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (data: any) => {
    try {
      await updateLead.mutateAsync(data);
      // Redirect is handled by the mutation
    } catch (error) {
      console.error('Error updating lead:', error);
    }
  };

  const handleCancel = () => {
    router.push(`/leads/${leadId}`);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Editar Lead</h1>
          <p className="text-gray-600">Modificar información del lead</p>
        </div>

        {updateLead.isError && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">
              Error: {(updateLead.error as Error)?.message || 'Error al actualizar el lead'}
            </p>
          </div>
        )}

        <LeadForm
          lead={lead}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={updateLead.isPending}
        />
      </div>
    </div>
  );
}
