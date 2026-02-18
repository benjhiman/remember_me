'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { useSales } from '@/lib/api/hooks/use-sales';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageShell } from '@/components/layout/page-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { getStatusColor, getStatusLabel } from '@/lib/utils/sales-utils';
import { Permission, userCan } from '@/lib/auth/permissions';
import { usePermissions } from '@/lib/auth/use-permissions';
import { perfMark, perfMeasureToNow } from '@/lib/utils/perf';
import { ShoppingCart, Plus, Search, ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react';
import type { SaleStatus } from '@/types/sales';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';

export default function SalesPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { can } = usePermissions();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SaleStatus | undefined>(undefined);
  const [recordsPerPage, setRecordsPerPage] = useState(30);

  const { data, isLoading, error, refetch } = useSales({
    page,
    limit: recordsPerPage,
    q: search || undefined,
    status: statusFilter,
    enabled: !!user,
  });

  useEffect(() => {
    perfMark('sales-page-mount');
  }, []);

  useEffect(() => {
    if (data && !isLoading) {
      perfMeasureToNow('sales-page-data-loaded', 'sales-page-mount');
    }
  }, [data, isLoading]);

  const breadcrumbs = [
    { label: 'Ventas', href: '/sales' },
  ];

  const actions = (
    <>
      {can('sales.write') && (
        <Button size="sm" onClick={() => router.push('/sales/new')}>
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva Venta
        </Button>
      )}
    </>
  );

  const toolbar = (
    <div className="flex items-center gap-3">
      <div className="flex-1 max-w-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Buscar ventas..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>
      <Select
        value={statusFilter || 'all'}
        onValueChange={(value) => {
          setStatusFilter(value === 'all' ? undefined : (value as SaleStatus));
          setPage(1);
        }}
      >
        <SelectTrigger className="w-[180px] h-9">
          <SelectValue placeholder="Todos los estados" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos los estados</SelectItem>
          <SelectItem value="DRAFT">Borrador</SelectItem>
          <SelectItem value="RESERVED">Reservado</SelectItem>
          <SelectItem value="PAID">Pagado</SelectItem>
          <SelectItem value="SHIPPED">Enviado</SelectItem>
          <SelectItem value="DELIVERED">Entregado</SelectItem>
          <SelectItem value="CANCELLED">Cancelado</SelectItem>
        </SelectContent>
      </Select>
      {(search || statusFilter) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setStatusFilter(undefined);
            setSearch('');
            setPage(1);
          }}
          className="h-9"
        >
          Limpiar
        </Button>
      )}
    </div>
  );

  // Calculate balance (total if not paid, 0 if paid)
  const calculateBalance = (sale: any) => {
    if (sale.status === 'PAID' || sale.status === 'SHIPPED' || sale.status === 'DELIVERED') {
      return 0;
    }
    return parseFloat(sale.total);
  };

  // Calculate due date (30 days from creation for unpaid sales)
  const calculateDueDate = (sale: any) => {
    const createdDate = new Date(sale.createdAt);
    const dueDate = new Date(createdDate);
    dueDate.setDate(dueDate.getDate() + 30);
    return dueDate;
  };

  return (
    <PageShell
      title="Ventas"
      description="Gestión de ventas"
      breadcrumbs={breadcrumbs}
      actions={actions}
      toolbar={toolbar}
    >
      <div className="bg-white rounded-lg border shadow-sm">
        {isLoading && (
          <div className="p-4 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        )}

        {error && (
          <div className="p-8 text-center">
            <div className="max-w-md mx-auto">
              <p className="text-red-600 font-medium mb-2">Error al cargar las ventas</p>
              <p className="text-sm text-gray-600 mb-4">{(error as Error).message || 'No se pudo conectar con el servidor'}</p>
              <Button onClick={() => refetch()} variant="outline" size="sm">
                Reintentar
              </Button>
            </div>
          </div>
        )}

        {data && (
          <>
            {data.data.length === 0 ? (
              <div className="p-12 text-center">
                <div className="max-w-sm mx-auto">
                  <ShoppingCart className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-sm font-semibold text-gray-900 mb-1">
                    {search || statusFilter ? 'No hay ventas con estos filtros' : 'No hay ventas'}
                  </h3>
                  <p className="text-xs text-gray-600 mb-4">
                    {search || statusFilter
                      ? 'Intentá ajustar los filtros para ver más resultados.'
                      : 'Creá tu primera venta para empezar a gestionar transacciones.'}
                  </p>
                  {can('sales.write') && (
                    <Button onClick={() => router.push('/sales/new')} size="sm">
                      <Plus className="h-4 w-4 mr-1.5" />
                      Nueva Venta
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead className="w-[100px]">
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              onChange={(e) => {
                                // TODO: Implement select all
                              }}
                            />
                            Invoice Date
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[140px]">
                          <div className="flex items-center gap-2">
                            Invoice Number
                            <span className="text-xs text-gray-400">All</span>
                          </div>
                        </TableHead>
                        <TableHead className="min-w-[140px]">Order Number</TableHead>
                        <TableHead className="min-w-[150px]">Account Name</TableHead>
                        <TableHead className="min-w-[150px]">Contact Name</TableHead>
                        <TableHead className="w-[120px]">Status</TableHead>
                        <TableHead className="min-w-[120px]">Due Date</TableHead>
                        <TableHead className="min-w-[140px] text-right">Grand Total</TableHead>
                        <TableHead className="min-w-[140px] text-right">Balance</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.data.map((sale) => {
                        const balance = calculateBalance(sale);
                        const dueDate = calculateDueDate(sale);
                        const isOverdue = balance > 0 && dueDate < new Date();
                        
                        return (
                          <TableRow
                            key={sale.id}
                            className="cursor-pointer hover:bg-gray-50/50"
                            onClick={() => router.push(`/sales/${sale.id}`)}
                          >
                            <TableCell>
                              <input
                                type="checkbox"
                                className="rounded border-gray-300"
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) => {
                                  // TODO: Implement individual selection
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {format(new Date(sale.createdAt), 'MMM dd, yyyy', { locale: es })}
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900">
                                {sale.saleNumber || sale.id.slice(0, 8)}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-gray-600">
                                {sale.saleNumber || `SO-${sale.id.slice(0, 8)}`}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div className="font-medium text-gray-900">{sale.customerName || '—'}</div>
                            </TableCell>
                            <TableCell>
                              <div className="text-sm text-gray-900">
                                {sale.customerName || sale.customerEmail || '—'}
                              </div>
                              {sale.customerEmail && (
                                <div className="text-xs text-gray-500">{sale.customerEmail}</div>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant="outline"
                                className={`${getStatusColor(sale.status)} border-0`}
                              >
                                {getStatusLabel(sale.status)}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className={`text-sm ${isOverdue ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                                {format(dueDate, 'MMM dd, yyyy', { locale: es })}
                              </div>
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {sale.currency || 'USD'} {parseFloat(sale.total).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {balance > 0 ? (
                                <>
                                  {sale.currency || 'USD'} {balance.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </>
                              ) : (
                                <>
                                  {sale.currency || 'USD'} 0.00
                                </>
                              )}
                            </TableCell>
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-8 w-8 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // TODO: Implement dropdown menu
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {data?.meta && (
                  <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Records Per Page</span>
                      <Select
                        value={recordsPerPage.toString()}
                        onValueChange={(value) => {
                          setRecordsPerPage(Number(value));
                          setPage(1);
                        }}
                      >
                        <SelectTrigger className="w-[120px] h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="10">10</SelectItem>
                          <SelectItem value="20">20</SelectItem>
                          <SelectItem value="30">30</SelectItem>
                          <SelectItem value="50">50</SelectItem>
                          <SelectItem value="100">100</SelectItem>
                        </SelectContent>
                      </Select>
                      <span className="text-sm text-gray-600">
                        {((page - 1) * recordsPerPage) + 1} - {Math.min(page * recordsPerPage, data.meta.total)} of {data.meta.total}
                      </span>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="h-8"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                        disabled={page === data.meta.totalPages}
                        className="h-8"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </PageShell>
  );
}
