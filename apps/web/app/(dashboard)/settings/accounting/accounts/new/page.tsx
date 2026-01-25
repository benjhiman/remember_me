'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useCreateLedgerAccount } from '@/lib/api/hooks/use-ledger-account-mutations';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/layout/page-shell';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { ArrowLeft } from 'lucide-react';

const accountSchema = z.object({
  code: z.string().min(1, 'El código es requerido'),
  name: z.string().min(1, 'El nombre es requerido'),
  type: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
  isActive: z.boolean().default(true),
});

type AccountFormData = z.infer<typeof accountSchema>;

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Activo' },
  { value: 'LIABILITY', label: 'Pasivo' },
  { value: 'EQUITY', label: 'Patrimonio' },
  { value: 'REVENUE', label: 'Ingreso' },
  { value: 'EXPENSE', label: 'Gasto' },
];

export default function NewLedgerAccountPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const createAccount = useCreateLedgerAccount();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AccountFormData>({
    defaultValues: {
      isActive: true,
    },
  });

  const isActive = watch('isActive');

  if (!can('ledger.write' as any)) {
    return (
      <PageShell title="Nueva Cuenta" breadcrumbs={[{ label: 'Settings', href: '/settings' }, { label: 'Accounts', href: '#' }]}>
        <div className="p-8 text-center">
          <p className="text-red-600 font-medium">No tenés permisos para crear cuentas contables</p>
        </div>
      </PageShell>
    );
  }

  const onSubmit = async (data: AccountFormData) => {
    try {
      await createAccount.mutateAsync(data);
      router.push('/settings/accounting/accounts');
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <PageShell
      title="Nueva Cuenta Contable"
      breadcrumbs={[
        { label: 'Settings', href: '/settings' },
        { label: 'Accounting', href: '/settings/accounting' },
        { label: 'Accounts', href: '/settings/accounting/accounts' },
        { label: 'Nueva', href: '#' },
      ]}
    >
      <div className="max-w-2xl">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <div>
              <Label htmlFor="code">Código *</Label>
              <Input
                id="code"
                {...register('code')}
                placeholder="Ej: 1000"
                className="mt-1"
                disabled={createAccount.isPending}
              />
              {errors.code && <p className="text-sm text-red-600 mt-1">{errors.code.message}</p>}
            </div>

            <div>
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Ej: Caja"
                className="mt-1"
                disabled={createAccount.isPending}
              />
              {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="type">Tipo *</Label>
              <Select
                onValueChange={(value) => setValue('type', value as AccountFormData['type'])}
                disabled={createAccount.isPending}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccionar tipo" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.type && <p className="text-sm text-red-600 mt-1">{errors.type.message}</p>}
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label htmlFor="isActive">Activa</Label>
                <p className="text-sm text-gray-600">La cuenta estará disponible para uso</p>
              </div>
              <Switch
                id="isActive"
                checked={isActive}
                onCheckedChange={(checked) => setValue('isActive', checked)}
                disabled={createAccount.isPending}
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={createAccount.isPending}>
              {createAccount.isPending ? 'Creando...' : 'Crear Cuenta'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={createAccount.isPending}
            >
              <ArrowLeft className="h-4 w-4 mr-1.5" />
              Cancelar
            </Button>
          </div>
        </form>
      </div>
    </PageShell>
  );
}
