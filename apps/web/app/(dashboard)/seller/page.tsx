'use client';

import { useAuthStore } from '@/lib/store/auth-store';
import { RoleGuard } from '@/lib/auth/role-guard';
import { Role } from '@/lib/auth/permissions';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useSales } from '@/lib/api/hooks/use-sales';
import { useRouter } from 'next/navigation';
import { ShoppingCart, Package, Users, DollarSign, Plus } from 'lucide-react';
import { formatCurrency } from '@/lib/utils/date-range';
import { formatDate } from '@/lib/utils/lead-utils';

export default function SellerDashboardPage() {
  const { user } = useAuthStore();
  const router = useRouter();
  
  // Get recent sales for this seller
  const { data: recentSales, isLoading: salesLoading } = useSales({
    limit: 10,
    sort: 'createdAt',
    order: 'desc',
    enabled: !!user,
  });

  // Calculate stats from recent sales
  const totalSales = recentSales?.data?.length || 0;
  const totalRevenue = recentSales?.data?.reduce((sum, sale) => {
    return sum + parseFloat(sale.total || '0');
  }, 0) || 0;
  const avgTicket = totalSales > 0 ? totalRevenue / totalSales : 0;

  const breadcrumbs = [{ label: 'Vista Vendedor', href: '/seller' }];

  const actions = (
    <Button onClick={() => router.push('/sales/new')}>
      <Plus className="h-4 w-4 mr-2" />
      Nueva Venta
    </Button>
  );

  return (
    <RoleGuard allowedRoles={[Role.SELLER]}>
      <PageShell 
        title="Vista Vendedor" 
        description="Panel de trabajo para vendedores"
        breadcrumbs={breadcrumbs}
        actions={actions}
      >
        {/* Welcome Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Bienvenido, {user?.name || 'Vendedor'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Esta es tu vista personalizada como vendedor. Aquí podés gestionar tus ventas, 
              ver el stock disponible y trabajar con tus clientes.
            </p>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ventas Totales</p>
                  <p className="text-2xl font-bold">{totalSales}</p>
                </div>
                <ShoppingCart className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Revenue Total</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalRevenue)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Ticket Promedio</p>
                  <p className="text-2xl font-bold">{formatCurrency(avgTicket)}</p>
                </div>
                <Package className="h-8 w-8 text-muted-foreground" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push('/sales/new')}>
            <CardContent className="p-6 text-center">
              <Plus className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-medium">Nueva Venta</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push('/sales')}>
            <CardContent className="p-6 text-center">
              <ShoppingCart className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-medium">Ver Ventas</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push('/inventory/stock')}>
            <CardContent className="p-6 text-center">
              <Package className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-medium">Ver Stock</p>
            </CardContent>
          </Card>

          <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => router.push('/sales/clients')}>
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 mx-auto mb-2 text-primary" />
              <p className="font-medium">Clientes</p>
            </CardContent>
          </Card>
        </div>

        {/* Recent Sales */}
        <Card>
          <CardHeader>
            <CardTitle>Últimas Ventas</CardTitle>
          </CardHeader>
          <CardContent>
            {salesLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando ventas...</div>
            ) : recentSales?.data && recentSales.data.length > 0 ? (
              <div className="space-y-2">
                {recentSales.data.map((sale) => (
                  <div
                    key={sale.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => router.push(`/sales/${sale.id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{sale.saleNumber || sale.id.slice(0, 8)}</p>
                        <p className="text-sm text-muted-foreground">
                          {sale.customerName || 'Cliente sin nombre'}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDate(sale.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold text-lg">{formatCurrency(parseFloat(sale.total || '0'))}</p>
                        <p className="text-xs text-muted-foreground capitalize">{sale.status?.toLowerCase()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <p>No hay ventas recientes</p>
                <Button 
                  variant="outline" 
                  className="mt-4"
                  onClick={() => router.push('/sales/new')}
                >
                  Crear Primera Venta
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </PageShell>
    </RoleGuard>
  );
}
