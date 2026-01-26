'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { useMe } from '@/lib/api/hooks/use-me';
import { PageShell } from '@/components/layout/page-shell';
import { OwnerOnlyDenied } from '@/components/ui/owner-only-denied';
import { Button } from '@/components/ui/button';
import { Users, UserPlus } from 'lucide-react';

export default function SellersPage() {
  const { user } = useAuthStore();
  const { data: meData } = useMe();

  const isOwner = meData?.role === 'OWNER' || user?.role === 'OWNER';

  const breadcrumbs = [
    { label: 'Ventas', href: '/sales' },
    { label: 'Vendedores', href: '/sales/sellers' },
  ];

  if (!isOwner) {
    return (
      <PageShell title="Vendedores" breadcrumbs={breadcrumbs}>
        <OwnerOnlyDenied backHref="/sales" />
      </PageShell>
    );
  }

  return (
    <PageShell
      title="Vendedores"
      description="Gestiona los vendedores de tu organización"
      breadcrumbs={breadcrumbs}
      actions={
        <Button size="sm" disabled>
          <UserPlus className="h-4 w-4 mr-1.5" />
          Invitar Vendedor (Próximamente)
        </Button>
      }
    >
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Nombre
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Role
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estado
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            <tr>
              <td colSpan={4} className="px-6 py-12 text-center text-sm text-gray-500">
                <Users className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                <p>No hay vendedores registrados aún.</p>
                <p className="text-xs text-gray-400 mt-1">Esta funcionalidad estará disponible próximamente.</p>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
