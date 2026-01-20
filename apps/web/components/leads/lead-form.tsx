'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { usePipelines } from '@/lib/api/hooks/use-pipelines';
import type { Lead, LeadStatus } from '@/types/api';

const leadSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  phone: z.string().optional(),
  pipelineId: z.string().min(1, 'Pipeline es requerido'),
  stageId: z.string().min(1, 'Stage es requerido'),
  status: z.enum(['ACTIVE', 'CONVERTED', 'LOST', 'ARCHIVED']).optional(),
  source: z.string().optional(),
  city: z.string().optional(),
});

type LeadFormData = z.infer<typeof leadSchema>;

interface LeadFormProps {
  lead?: Lead;
  onSubmit: (data: LeadFormData) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function LeadForm({ lead, onSubmit, onCancel, isLoading }: LeadFormProps) {
  const { data: pipelines, isLoading: pipelinesLoading } = usePipelines();
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>('');

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<LeadFormData>({
    resolver: zodResolver(leadSchema),
    defaultValues: {
      name: lead?.name || '',
      email: lead?.email || '',
      phone: lead?.phone || '',
      pipelineId: lead?.pipelineId || '',
      stageId: lead?.stageId || '',
      status: lead?.status || 'ACTIVE',
      source: lead?.source || '',
      city: lead?.city || '',
    },
  });

  const pipelineId = watch('pipelineId');
  const selectedPipeline = pipelines?.find((p) => p.id === pipelineId);
  const availableStages = selectedPipeline?.stages || [];

  useEffect(() => {
    if (lead) {
      setValue('pipelineId', lead.pipelineId);
      setValue('stageId', lead.stageId);
      setSelectedPipelineId(lead.pipelineId);
    } else if (pipelines && pipelines.length > 0) {
      // Default to first pipeline and first stage
      const defaultPipeline = pipelines[0];
      setValue('pipelineId', defaultPipeline.id);
      setSelectedPipelineId(defaultPipeline.id);
      if (defaultPipeline.stages && defaultPipeline.stages.length > 0) {
        setValue('stageId', defaultPipeline.stages[0].id);
      }
    }
  }, [lead, pipelines, setValue]);

  const handlePipelineChange = (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    setValue('pipelineId', pipelineId);
    // Reset stage when pipeline changes
    const pipeline = pipelines?.find((p) => p.id === pipelineId);
    if (pipeline?.stages && pipeline.stages.length > 0) {
      setValue('stageId', pipeline.stages[0].id);
    } else {
      setValue('stageId', '');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{lead ? 'Editar Lead' : 'Crear Lead'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Nombre <span className="text-red-500">*</span>
            </label>
            <Input {...register('name')} placeholder="Nombre del lead" />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium mb-1">Email</label>
            <Input type="email" {...register('email')} placeholder="email@ejemplo.com" />
            {errors.email && <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium mb-1">Teléfono</label>
            <Input {...register('phone')} placeholder="+1234567890" />
            {errors.phone && <p className="text-sm text-red-500 mt-1">{errors.phone.message}</p>}
          </div>

          {/* Pipeline */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Pipeline <span className="text-red-500">*</span>
            </label>
            {pipelinesLoading ? (
              <div className="text-sm text-gray-500">Cargando pipelines...</div>
            ) : (
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('pipelineId')}
                onChange={(e) => handlePipelineChange(e.target.value)}
              >
                <option value="">Seleccionar pipeline</option>
                {pipelines?.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            )}
            {errors.pipelineId && (
              <p className="text-sm text-red-500 mt-1">{errors.pipelineId.message}</p>
            )}
          </div>

          {/* Stage */}
          <div>
            <label className="block text-sm font-medium mb-1">
              Stage <span className="text-red-500">*</span>
            </label>
            {availableStages.length === 0 ? (
              <div className="text-sm text-gray-500">
                {pipelineId ? 'Selecciona un pipeline primero' : 'Selecciona un pipeline'}
              </div>
            ) : (
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('stageId')}
              >
                <option value="">Seleccionar stage</option>
                {availableStages.map((stage) => (
                  <option key={stage.id} value={stage.id}>
                    {stage.name}
                  </option>
                ))}
              </select>
            )}
            {errors.stageId && (
              <p className="text-sm text-red-500 mt-1">{errors.stageId.message}</p>
            )}
          </div>

          {/* Status (only for edit) */}
          {lead && (
            <div>
              <label className="block text-sm font-medium mb-1">Estado</label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
                {...register('status')}
              >
                <option value="ACTIVE">Activo</option>
                <option value="CONVERTED">Convertido</option>
                <option value="LOST">Perdido</option>
                <option value="ARCHIVED">Archivado</option>
              </select>
            </div>
          )}

          {/* Source */}
          <div>
            <label className="block text-sm font-medium mb-1">Origen</label>
            <Input {...register('source')} placeholder="instagram, whatsapp, manual, etc." />
          </div>

          {/* City */}
          <div>
            <label className="block text-sm font-medium mb-1">Ciudad</label>
            <Input {...register('city')} placeholder="Buenos Aires" />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-4 justify-end">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isLoading}>
          Cancelar
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading ? 'Guardando...' : lead ? 'Actualizar' : 'Crear'}
        </Button>
      </div>
    </form>
  );
}
