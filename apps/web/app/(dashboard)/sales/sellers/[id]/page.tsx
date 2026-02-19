'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useSellerOverview, useSellerCommissionConfig, useUpdateSellerCommission } from '@/lib/api/hooks/use-sellers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDate } from '@/lib/utils/lead-utils';
import { ArrowLeft, DollarSign } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { useToast } from '@/components/ui/use-toast';

export default function SellerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const sellerId = typeof params.id === 'string' ? params.id : undefined;

  const { data: overview, isLoading: overviewLoading } = useSellerOverview(sellerId);
  const { data: commissionConfig } = useSellerCommissionConfig(sellerId);
  const updateCommission = useUpdateSellerCommission();

  const [commissionMode, setCommissionMode] = useState<string>('PERCENT_SALE');
  const [commissionValue, setCommissionValue] = useState<string>('0');

  useEffect(() => {
    if (commissionConfig) {
      setCommissionMode(commissionConfig.mode);
      setCommissionValue(commissionConfig.value.toString());
    }
  }, [commissionConfig]);

  const breadcrumbs = [
    { label: 'Ventas', href: '/sales' },
    { label: 'Vendedores', href: '/sales/sellers' },
    { label: overview?.seller.name || 'Vendedor', href: `/sales/sellers/${sellerId}` },
  ];

  const handleSaveCommission = async () => {
    if (!sellerId) return;

    try {
      await updateCommission.mutateAsync({
        sellerId,
        data: {
          mode: commissionMode,
          value: parseFloat(commissionValue) || 0,
        },
      });
    } catch (error) {
      // Error handled by hook
    }
  };

  const getPaymentStatusLabel = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'Pagada';
      case 'UNPAID':
        return 'Pendiente';
      default:
        return status;
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800';
      case 'UNPAID':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getDeliveryStatusLabel = (status: string) => {
    switch (status) {
      case 'DELIVERED':
        return 'Entregada';
      case 'SHIPPED':
        return 'Enviada';
      case 'NOT_DELIVERED':
        return 'No entregada';
      default:
        return status;
    }
  };

  const getWorkflowStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'Activa';
      case 'CANCELLED':
        return 'Cancelada';
      case 'STANDBY':
        return 'En espera';
      default:
        return status;
    }
  };

  if (overviewLoading) {
    return (
      <PageShell title="Vendedor" breadcrumbs={breadcrumbs}>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    );
  }

  if (!overview) {
    return (
      <PageShell title="Vendedor no encontrado" breadcrumbs={breadcrumbs}>
        <div className="p-8 text-center">
          <p className="text-gray-600 mb-4">El vendedor no existe o no tenés acceso a él.</p>
          <Button onClick={() => router.push('/sales/sellers')} variant="outline">
            Volver a Vendedores
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={overview.seller.name || overview.seller.email}
      description={overview.seller.email}
      breadcrumbs={breadcrumbs}
      actions={
        <Button variant="outline" onClick={() => router.push('/sales/sellers')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Volver
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Totals Card */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Facturado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview.totals.totalInvoiced.toLocaleString('es-AR', {
                  style: 'currency',
                  currency: 'USD',
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Cobrado</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {overview.totals.totalPaid.toLocaleString('es-AR', {
                  style: 'currency',
                  currency: 'USD',
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Por Cobrar</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {overview.totals.totalOutstanding.toLocaleString('es-AR', {
                  style: 'currency',
                  currency: 'USD',
                })}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription># Facturas</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totals.invoicesCount}</div>
            </CardContent>
          </Card>
        </div>

        {/* Commission Config Card */}
        <Card>
          <CardHeader>
            <CardTitle>Configuración de Comisiones</CardTitle>
            <CardDescription>Configurá cómo se calculan las comisiones para este vendedor</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="commission-mode">Modo de Comisión</Label>
                <Select value={commissionMode} onValueChange={setCommissionMode}>
                  <SelectTrigger id="commission-mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENT_SALE">Porcentaje de Venta</SelectItem>
                    <SelectItem value="PERCENT_GROSS_PROFIT">Porcentaje de Ganancia Bruta</SelectItem>
                    <SelectItem value="PER_UNIT">Por Unidad</SelectItem>
                    <SelectItem value="PER_MODEL">Por Modelo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="commission-value">
                  Valor {commissionMode === 'PERCENT_SALE' || commissionMode === 'PERCENT_GROSS_PROFIT' ? '(%)' : '(USD)'}
                </Label>
                <Input
                  id="commission-value"
                  type="number"
                  step="0.01"
                  min="0"
                  value={commissionValue}
                  onChange={(e) => setCommissionValue(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <Button onClick={handleSaveCommission} disabled={updateCommission.isPending}>
                <DollarSign className="h-4 w-4 mr-2" />
                {updateCommission.isPending ? 'Guardando...' : 'Guardar Configuración'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Invoices Card */}
        <Card>
          <CardHeader>
            <CardTitle>Facturas</CardTitle>
            <CardDescription>{overview.invoices.length} factura{overview.invoices.length !== 1 ? 's' : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {overview.invoices.length === 0 ? (
              <div className="p-8 text-center">
                <p className="text-sm text-gray-600">No hay facturas para este vendedor.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead># Factura</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Pagada</TableHead>
                      <TableHead>Entregada</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overview.invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.number}</TableCell>
                        <TableCell>{invoice.customerName}</TableCell>
                        <TableCell>
                          {format(new Date(invoice.issuedAt), 'dd/MM/yyyy', { locale: es })}
                        </TableCell>
                        <TableCell className="text-right">
                          {invoice.amountTotal.toLocaleString('es-AR', {
                            style: 'currency',
                            currency: 'USD',
                          })}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getPaymentStatusColor(
                              invoice.paymentStatus,
                            )}`}
                          >
                            {getPaymentStatusLabel(invoice.paymentStatus)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {getDeliveryStatusLabel(invoice.deliveryStatus)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-gray-600">
                            {getWorkflowStatusLabel(invoice.workflowStatus)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/sales/${invoice.id}`)}
                          >
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
