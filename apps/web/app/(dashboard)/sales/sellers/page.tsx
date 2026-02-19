'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useMe } from '@/lib/api/hooks/use-me';
import { useSellersStats, useInviteSeller, useCreateSeller } from '@/lib/api/hooks/use-sellers';
import { PageShell } from '@/components/layout/page-shell';
import { OwnerOnlyDenied } from '@/components/ui/owner-only-denied';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, UserPlus, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

export default function SellersPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { data: meData } = useMe();
  const { toast } = useToast();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [createSellerData, setCreateSellerData] = useState({
    name: '',
    email: '',
    phone: '',
    city: '',
    address: '',
  });

  const isAdmin = meData?.role === 'OWNER' || meData?.role === 'ADMIN' || meData?.role === 'MANAGER' || user?.role === 'OWNER' || user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const { data: statsData, isLoading: statsLoading } = useSellersStats(isAdmin);
  const inviteSeller = useInviteSeller();
  const createSeller = useCreateSeller();

  const breadcrumbs = [
    { label: 'Sales', href: '/sales' },
    { label: 'Vendedores', href: '/sales/sellers' },
  ];

  if (!isAdmin) {
    return (
      <PageShell title="Vendedores" breadcrumbs={breadcrumbs}>
        <OwnerOnlyDenied backHref="/sales" />
      </PageShell>
    );
  }

  const handleInvite = async () => {
    if (!inviteEmail.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor ingresá un email válido.',
      });
      return;
    }

    try {
      await inviteSeller.mutateAsync({ email: inviteEmail });
      setInviteEmail('');
      setInviteDialogOpen(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const handleCreateSeller = async () => {
    if (!createSellerData.name.trim() || !createSellerData.email.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Por favor completá nombre y email.',
      });
      return;
    }

    try {
      await createSeller.mutateAsync({
        name: createSellerData.name.trim(),
        email: createSellerData.email.trim(),
        phone: createSellerData.phone.trim() || undefined,
        city: createSellerData.city.trim() || undefined,
        address: createSellerData.address.trim() || undefined,
      });
      setCreateSellerData({
        name: '',
        email: '',
        phone: '',
        city: '',
        address: '',
      });
      setCreateDialogOpen(false);
    } catch (error) {
      // Error handled by hook
    }
  };

  const sortedStats = statsData?.data
    ? [...statsData.data].sort((a, b) => {
        return sortOrder === 'desc' ? b.totalInvoiced - a.totalInvoiced : a.totalInvoiced - b.totalInvoiced;
      })
    : [];

  return (
    <>
      <PageShell
        title="Vendedores"
        description="Gestiona los vendedores de tu organización"
        breadcrumbs={breadcrumbs}
        actions={
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setInviteDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Invitar Vendedor
            </Button>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1.5" />
              Alta Vendedor
            </Button>
          </div>
        }
      >
        {statsLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : !statsData?.data || statsData.data.length === 0 ? (
          <div className="p-12 text-center">
            <div className="max-w-sm mx-auto">
              <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-sm font-semibold text-gray-900 mb-1">No hay vendedores registrados aún</h3>
              <p className="text-xs text-gray-600 mb-4">Invita vendedores para empezar a gestionar tu equipo de ventas.</p>
              <Button onClick={() => setInviteDialogOpen(true)} size="sm">
                <UserPlus className="h-4 w-4 mr-1.5" />
                Invitar Primer Vendedor
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">
                    <button
                      onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
                      className="flex items-center gap-1 hover:text-gray-900"
                    >
                      Total Facturado
                      {sortOrder === 'desc' ? (
                        <ArrowDown className="h-4 w-4" />
                      ) : (
                        <ArrowUp className="h-4 w-4" />
                      )}
                    </button>
                  </TableHead>
                  <TableHead className="text-right">Cobrado</TableHead>
                  <TableHead className="text-right">Por Cobrar</TableHead>
                  <TableHead className="text-right"># Facturas</TableHead>
                  <TableHead className="text-right">Comisiones</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedStats.map((stat) => (
                  <TableRow
                    key={stat.sellerId}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/sales/sellers/${stat.sellerId}`)}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium text-gray-900">{stat.name || stat.email}</div>
                        <div className="text-sm text-gray-500">{stat.email}</div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {stat.totalInvoiced.toLocaleString('es-AR', {
                        style: 'currency',
                        currency: 'USD',
                      })}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {stat.totalPaid.toLocaleString('es-AR', {
                        style: 'currency',
                        currency: 'USD',
                      })}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {stat.totalOutstanding.toLocaleString('es-AR', {
                        style: 'currency',
                        currency: 'USD',
                      })}
                    </TableCell>
                    <TableCell className="text-right">{stat.invoicesCount}</TableCell>
                    <TableCell className="text-right">
                      {stat.commissionsTotal > 0
                        ? stat.commissionsTotal.toLocaleString('es-AR', {
                            style: 'currency',
                            currency: 'USD',
                          })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/sales/sellers/${stat.sellerId}`);
                        }}
                      >
                        Ver Detalle
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </PageShell>

      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invitar Vendedor</DialogTitle>
            <DialogDescription>
              Enviá una invitación por email para que se una a tu organización como vendedor.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="vendedor@ejemplo.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleInvite();
                  }
                }}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleInvite} disabled={inviteSeller.isPending || !inviteEmail.trim()}>
              {inviteSeller.isPending ? 'Enviando...' : 'Enviar Invitación'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Alta Vendedor</DialogTitle>
            <DialogDescription>
              Creá un nuevo vendedor con cuenta de usuario. Se enviará una invitación por email para que configure su contraseña.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Nombre *</Label>
              <Input
                id="create-name"
                value={createSellerData.name}
                onChange={(e) => setCreateSellerData({ ...createSellerData, name: e.target.value })}
                placeholder="Nombre completo"
                required
                disabled={createSeller.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-email">Email *</Label>
              <Input
                id="create-email"
                type="email"
                value={createSellerData.email}
                onChange={(e) => setCreateSellerData({ ...createSellerData, email: e.target.value })}
                placeholder="vendedor@ejemplo.com"
                required
                disabled={createSeller.isPending}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="create-phone">Teléfono</Label>
                <Input
                  id="create-phone"
                  value={createSellerData.phone}
                  onChange={(e) => setCreateSellerData({ ...createSellerData, phone: e.target.value })}
                  placeholder="+54 11 1234-5678"
                  disabled={createSeller.isPending}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="create-city">Ciudad</Label>
                <Input
                  id="create-city"
                  value={createSellerData.city}
                  onChange={(e) => setCreateSellerData({ ...createSellerData, city: e.target.value })}
                  placeholder="Ciudad"
                  disabled={createSeller.isPending}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="create-address">Dirección</Label>
              <Input
                id="create-address"
                value={createSellerData.address}
                onChange={(e) => setCreateSellerData({ ...createSellerData, address: e.target.value })}
                placeholder="Dirección completa"
                disabled={createSeller.isPending}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)} disabled={createSeller.isPending}>
              Cancelar
            </Button>
            <Button
              onClick={handleCreateSeller}
              disabled={createSeller.isPending || !createSellerData.name.trim() || !createSellerData.email.trim()}
            >
              {createSeller.isPending ? 'Creando...' : 'Crear Vendedor'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

