'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useCreatePipeline } from '@/lib/api/hooks/use-create-pipeline';
import { PageShell } from '@/components/layout/page-shell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Plus, Trash2, X } from 'lucide-react';
import { Permission, userCan } from '@/lib/auth/permissions';
import { z } from 'zod';

const pipelineSchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional(),
  stages: z
    .array(
      z.object({
        name: z.string().min(1, 'El nombre del stage es requerido'),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Color inválido').optional(),
      })
    )
    .min(1, 'Debe haber al menos un stage'),
});

type PipelineFormData = z.infer<typeof pipelineSchema>;

const DEFAULT_STAGES = [
  { name: 'Nuevo', color: '#94a3b8' },
  { name: 'Contactado', color: '#3b82f6' },
  { name: 'Cerrado', color: '#10b981' },
];

export default function NewPipelinePage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const createPipeline = useCreatePipeline();

  const [name, setName] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [stages, setStages] = useState<Array<{ name: string; color: string }>>(DEFAULT_STAGES);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Permission check
  if (user && !userCan(user, Permission.EDIT_LEADS)) {
    return (
      <PageShell
        title="Nuevo Pipeline"
        description="Crear un nuevo pipeline"
        breadcrumbs={[
          { label: 'Home', href: '/dashboard' },
          { label: 'Board', href: '/board' },
          { label: 'Pipelines', href: '/board' },
          { label: 'New', href: '/board/pipelines/new' },
        ]}
      >
        <Card>
          <CardContent className="p-6 text-center">
            <h2 className="text-lg font-semibold mb-2">Acceso denegado</h2>
            <p className="text-sm text-muted-foreground mb-4">
              No tenés permisos para crear pipelines.
            </p>
            <Button variant="outline" onClick={() => router.push('/board')}>
              Volver a Board
            </Button>
          </CardContent>
        </Card>
      </PageShell>
    );
  }

  const handleAddStage = () => {
    setStages([...stages, { name: '', color: '#94a3b8' }]);
  };

  const handleRemoveStage = (index: number) => {
    if (stages.length > 1) {
      setStages(stages.filter((_, i) => i !== index));
    }
  };

  const handleStageChange = (index: number, field: 'name' | 'color', value: string) => {
    const updated = [...stages];
    updated[index] = { ...updated[index], [field]: value };
    setStages(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});

    const formData: PipelineFormData = {
      name,
      color: color || undefined,
      stages: stages.filter((s) => s.name.trim().length > 0),
    };

    // Validate
    const result = pipelineSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const path = err.path.join('.');
        fieldErrors[path] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    // Submit
    try {
      await createPipeline.mutateAsync({
        name: formData.name,
        color: formData.color,
        stages: formData.stages.map((s) => ({
          name: s.name,
          color: s.color,
        })),
      });
    } catch (error) {
      // Error is handled by the mutation
      console.error('Error creating pipeline:', error);
    }
  };

  const handleCancel = () => {
    router.push('/board');
  };

  return (
    <PageShell
      title="Nuevo Pipeline"
      description="Crear un nuevo pipeline con sus stages"
      breadcrumbs={[
        { label: 'Home', href: '/dashboard' },
        { label: 'Board', href: '/board' },
        { label: 'Pipelines', href: '/board' },
        { label: 'New', href: '/board/pipelines/new' },
      ]}
      actions={
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleCancel} disabled={createPipeline.isPending}>
            Cancelar
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={createPipeline.isPending}>
            {createPipeline.isPending ? 'Creando...' : 'Crear Pipeline'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Pipeline Info */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Pipeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">
                Nombre <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Sales Pipeline"
                className={errors.name ? 'border-destructive' : ''}
              />
              {errors.name && <p className="text-sm text-destructive mt-1">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="color">Color</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-20 h-10"
                />
                <Input
                  type="text"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  placeholder="#6366f1"
                  pattern="^#[0-9A-Fa-f]{6}$"
                  className="flex-1"
                />
              </div>
              {errors.color && <p className="text-sm text-destructive mt-1">{errors.color}</p>}
            </div>
          </CardContent>
        </Card>

        {/* Stages */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Stages</CardTitle>
              <Button type="button" variant="outline" size="sm" onClick={handleAddStage}>
                <Plus className="h-4 w-4 mr-1.5" />
                Agregar Stage
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {stages.map((stage, index) => (
              <div key={index} className="flex items-start gap-3 p-4 border rounded-lg">
                <div className="flex-1 space-y-3">
                  <div>
                    <Label htmlFor={`stage-${index}-name`}>
                      Nombre del Stage <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id={`stage-${index}-name`}
                      value={stage.name}
                      onChange={(e) => handleStageChange(index, 'name', e.target.value)}
                      placeholder={`Stage ${index + 1}`}
                      className={errors[`stages.${index}.name`] ? 'border-destructive' : ''}
                    />
                    {errors[`stages.${index}.name`] && (
                      <p className="text-sm text-destructive mt-1">{errors[`stages.${index}.name`]}</p>
                    )}
                  </div>
                  <div>
                    <Label htmlFor={`stage-${index}-color`}>Color</Label>
                    <div className="flex items-center gap-2">
                      <Input
                        id={`stage-${index}-color`}
                        type="color"
                        value={stage.color}
                        onChange={(e) => handleStageChange(index, 'color', e.target.value)}
                        className="w-20 h-10"
                      />
                      <Input
                        type="text"
                        value={stage.color}
                        onChange={(e) => handleStageChange(index, 'color', e.target.value)}
                        placeholder="#94a3b8"
                        pattern="^#[0-9A-Fa-f]{6}$"
                        className="flex-1"
                      />
                    </div>
                  </div>
                </div>
                {stages.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveStage(index)}
                    className="mt-6"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
            ))}
            {errors.stages && <p className="text-sm text-destructive">{errors.stages}</p>}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={handleCancel} disabled={createPipeline.isPending}>
            Cancelar
          </Button>
          <Button type="submit" disabled={createPipeline.isPending}>
            {createPipeline.isPending ? 'Creando...' : 'Crear Pipeline'}
          </Button>
        </div>
      </form>
    </PageShell>
  );
}
