'use client';

import { useRouter, useParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useEffect } from 'react';
import { LeadForm } from '@/components/leads/lead-form';
import { useLead } from '@/lib/api/hooks/use-lead';
import { useUpdateLead } from '@/lib/api/hooks/use-lead-mutations';
import { Breadcrumb } from '@/components/ui/breadcrumb';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/utils/error-handler';

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
      <div className="max-w-3xl mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <Breadcrumb items={[{ label: 'Leads', href: '/leads' }, { label: 'Error' }]} />
        <Card className="mt-4">
          <CardContent className="p-6">
            <div className="text-center">
              <p className="text-red-600 font-medium mb-2">Error al cargar lead</p>
              <p className="text-sm text-gray-600 mb-4">
                {error ? getErrorMessage(error) : 'Lead no encontrado'}
              </p>
              <Button onClick={() => router.push('/leads')} variant="outline">
                Volver a Leads
              </Button>
            </div>
          </CardContent>
        </Card>
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
    <div className="max-w-3xl mx-auto p-6">
      <Breadcrumb items={[{ label: 'Leads', href: '/leads' }, { label: lead.name, href: `/leads/${leadId}` }, { label: 'Editar' }]} />
      <div className="mb-6 mt-4">
        <h1 className="text-3xl font-bold">Editar Lead</h1>
        <p className="text-gray-600">Modificar información del lead</p>
      </div>

        <LeadForm
          lead={lead}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          isLoading={updateLead.isPending}
        />
    </div>
  );
}
