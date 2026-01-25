'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/layout/page-shell';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Plus, Search, BookOpen } from 'lucide-react';
import { useLedgerAccounts } from '@/lib/api/hooks/use-ledger-accounts';
import { formatDate } from '@/lib/utils/lead-utils';

const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  ASSET: 'Activo',
  LIABILITY: 'Pasivo',
  EQUITY: 'Patrimonio',
  REVENUE: 'Ingreso',
  EXPENSE: 'Gasto',
};

const ACCOUNT_TYPE_COLORS: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-red-100 text-red-800',
  EQUITY: 'bg-green-100 text-green-800',
  REVENUE: 'bg-purple-100 text-purple-800',
  EXPENSE: 'bg-orange-100 text-orange-800',
};

export default function LedgerAccountsPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [activeFilter, setActiveFilter] = useState<boolean | undefined>(undefined);

  const { data, isLoading, error } = useLedgerAccounts({
    page: 1,
    limit: 50,
    q: search || undefined,
    type: typeFilter || undefined,
    isActive: activeFilter,
    enabled: !!user,
  });

  const breadcrumbs = [
    { label: 'Settings', href: '/settings' },
    { label: 'Accounting', href: '/settings/accounting' },
    { label: 'Accounts', href: '#' },
  ];

  const actions = (
    <>
      {can('ledger.write' as any) && (
        <Button size="sm" onClick={() => router.push('/settings/accounting/accounts/new')}>
          <Plus className="h-4 w-4 mr-1.5" />
          New Account
        </Button>
      )}
    </>
  );

  if (isLoading) {
    return (
      <PageShell title="Accounts" breadcrumbs={breadcrumbs} actions={actions}>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    );
  }

  if (error) {
    return (
      <PageShell title="Accounts" breadcrumbs={breadcrumbs} actions={actions}>
        <div className="p-8 text-center">
          <p className="text-red-600 font-medium">Error al cargar las cuentas</p>
          <p className="text-sm text-gray-600 mt-2">{(error as Error)?.message || 'Error desconocido'}</p>
        </div>
      </PageShell>
    );
  }

  const accounts = data?.items || [];
  const isEmpty = accounts.length === 0;

  return (
    <PageShell title="Accounts" breadcrumbs={breadcrumbs} actions={actions}>
      <div className="space-y-4">
        {/* Toolbar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por código o nombre..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos los tipos</option>
              {Object.entries(ACCOUNT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={activeFilter === undefined ? '' : activeFilter ? 'true' : 'false'}
              onChange={(e) => setActiveFilter(e.target.value === '' ? undefined : e.target.value === 'true')}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Todos</option>
              <option value="true">Activos</option>
              <option value="false">Inactivos</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {isEmpty ? (
          <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
            <BookOpen className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No hay cuentas contables</h3>
            <p className="text-sm text-gray-600 mb-4">
              {can('ledger.write' as any)
                ? 'Crea tu primera cuenta contable para comenzar a gestionar tu contabilidad.'
                : 'No hay cuentas contables disponibles.'}
            </p>
            {can('ledger.write' as any) && (
              <Button onClick={() => router.push('/settings/accounting/accounts/new')}>
                <Plus className="h-4 w-4 mr-1.5" />
                Nueva Cuenta
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Código
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Nombre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Estado
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actualizado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {accounts.map((account) => (
                  <tr key={account.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-mono text-gray-900">{account.code}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-gray-900">{account.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={ACCOUNT_TYPE_COLORS[account.type] || 'bg-gray-100 text-gray-800'}>
                        {ACCOUNT_TYPE_LABELS[account.type] || account.type}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {account.isActive ? (
                        <Badge className="bg-green-100 text-green-800">Activo</Badge>
                      ) : (
                        <Badge className="bg-gray-100 text-gray-800">Inactivo</Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(account.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </PageShell>
  );
}
