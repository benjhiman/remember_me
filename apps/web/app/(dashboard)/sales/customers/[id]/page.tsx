'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useCustomer, useCustomerInvoices } from '@/lib/api/hooks/use-customers';
import { usePermissions } from '@/lib/auth/use-permissions';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { formatDate } from '@/lib/utils/lead-utils';
import { ArrowLeft, Plus, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function CustomerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { can } = usePermissions();
  const customerId = typeof params.id === 'string' ? params.id : undefined;

  const { data: customer, isLoading: customerLoading } = useCustomer(customerId);
  const { data: invoices, isLoading: invoicesLoading } = useCustomerInvoices(customerId);

  const breadcrumbs = [
    { label: 'Sales', href: '/sales' },
    { label: 'Clientes', href: '/sales/customers' },
    { label: customer?.name || 'Cliente', href: `/sales/customers/${customerId}` },
  ];

  const handleCreateSale = () => {
    router.push(`/sales/new?customerId=${customerId}`);
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

  if (customerLoading) {
    return (
      <PageShell title="Cliente" breadcrumbs={breadcrumbs}>
        <div className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </PageShell>
    );
  }

  if (!customer) {
    return (
      <PageShell title="Cliente no encontrado" breadcrumbs={breadcrumbs}>
        <div className="p-8 text-center">
          <p className="text-gray-600 mb-4">El cliente no existe o no tenés acceso a él.</p>
          <Button onClick={() => router.push('/sales/customers')} variant="outline">
            Volver a Clientes
          </Button>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      title={customer.name}
      description={customer.email || customer.phone || 'Sin información de contacto'}
      breadcrumbs={breadcrumbs}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push('/sales/customers')}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
          {can('sales.write') && (
            <Button onClick={handleCreateSale}>
              <Plus className="h-4 w-4 mr-2" />
              Crear Venta
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-6">
        {/* Customer Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Información del Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium text-gray-500">Nombre</label>
                <p className="text-sm text-gray-900">{customer.name}</p>
              </div>
              {customer.email && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Email</label>
                  <p className="text-sm text-gray-900">{customer.email}</p>
                </div>
              )}
              {customer.phone && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Teléfono</label>
                  <p className="text-sm text-gray-900">{customer.phone}</p>
                </div>
              )}
              {customer.taxId && (
                <div>
                  <label className="text-sm font-medium text-gray-500">CUIT/DNI</label>
                  <p className="text-sm text-gray-900">{customer.taxId}</p>
                </div>
              )}
              {customer.city && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Ciudad</label>
                  <p className="text-sm text-gray-900">{customer.city}</p>
                </div>
              )}
              {customer.address && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Dirección</label>
                  <p className="text-sm text-gray-900">{customer.address}</p>
                </div>
              )}
              {customer.assignedTo && (
                <div>
                  <label className="text-sm font-medium text-gray-500">Vendedor Asignado</label>
                  <p className="text-sm text-gray-900">{customer.assignedTo.name || customer.assignedTo.email}</p>
                </div>
              )}
              <div>
                <label className="text-sm font-medium text-gray-500">Estado</label>
                <p className="text-sm text-gray-900">
                  <span
                    className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                      customer.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {customer.status === 'ACTIVE' ? 'Activo' : 'Inactivo'}
                  </span>
                </p>
              </div>
            </div>
            {customer.notes && (
              <div className="mt-4">
                <label className="text-sm font-medium text-gray-500">Notas</label>
                <p className="text-sm text-gray-900 mt-1">{customer.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoices Card */}
        <Card>
          <CardHeader>
            <CardTitle>Historial de Facturas</CardTitle>
            <CardDescription>
              {invoicesLoading ? 'Cargando...' : `${invoices?.length || 0} factura${invoices?.length !== 1 ? 's' : ''}`}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {invoicesLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : !invoices || invoices.length === 0 ? (
              <div className="p-8 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-sm text-gray-600 mb-4">No hay facturas para este cliente.</p>
                {can('sales.write') && (
                  <Button onClick={handleCreateSale} size="sm">
                    <Plus className="h-4 w-4 mr-1.5" />
                    Crear Primera Venta
                  </Button>
                )}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead># Factura</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead className="text-right">Monto</TableHead>
                      <TableHead>Pagada</TableHead>
                      <TableHead>Entregada</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.map((invoice) => (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-medium">{invoice.number}</TableCell>
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
