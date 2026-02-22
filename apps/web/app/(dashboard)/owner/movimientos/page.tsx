'use client';

import { useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { RoleGuard } from '@/lib/auth/role-guard';
import { Role } from '@/lib/auth/permissions';
import { PageShell } from '@/components/layout/page-shell';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuditLogs, AuditLog } from '@/lib/api/hooks/use-audit-logs';
import { useAuditLogsStats } from '@/lib/api/hooks/use-audit-logs-stats';
import { formatDate } from '@/lib/utils/lead-utils';
import { Search, Filter, X, ChevronLeft, ChevronRight, Eye, Download, BarChart3 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export default function MovimientosPage() {
  const { user } = useAuthStore();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [activeTab, setActiveTab] = useState('logs');
  const [filters, setFilters] = useState({
    dateFrom: '',
    dateTo: '',
    actorUserId: '',
    actorRole: 'ALL',
    action: 'ALL',
    entityType: 'ALL',
    entityId: '',
    search: '',
  });
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Prepare filters for API call - exclude "ALL" values
  const apiFilters = {
    ...(filters.dateFrom && { dateFrom: filters.dateFrom }),
    ...(filters.dateTo && { dateTo: filters.dateTo }),
    ...(filters.actorUserId && { actorUserId: filters.actorUserId }),
    ...(filters.actorRole && filters.actorRole !== 'ALL' && { actorRole: filters.actorRole }),
    ...(filters.action && filters.action !== 'ALL' && { action: filters.action }),
    ...(filters.entityType && filters.entityType !== 'ALL' && { entityType: filters.entityType }),
    ...(filters.entityId && { entityId: filters.entityId }),
    ...(filters.search && { search: filters.search }),
  };

  const { data, isLoading, error } = useAuditLogs({
    page,
    pageSize,
    ...apiFilters,
  });

  const { data: statsData, isLoading: statsLoading } = useAuditLogsStats();

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      dateFrom: '',
      dateTo: '',
      actorUserId: '',
      actorRole: 'ALL',
      action: 'ALL',
      entityType: 'ALL',
      entityId: '',
      search: '',
    });
    setPage(1);
  };

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    // Don't count "ALL" as an active filter
    if (key === 'actorRole' || key === 'action' || key === 'entityType') {
      return value !== 'ALL' && value !== '';
    }
    return value !== '';
  });

  const breadcrumbs = [{ label: 'Movimientos', href: '/owner/movimientos' }];

  return (
    <RoleGuard allowedRoles={[Role.OWNER]}>
      <PageShell
        title="Movimientos"
        description="Registro de auditoría de todos los movimientos del sistema"
        breadcrumbs={breadcrumbs}
      >
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="logs">Registros</TabsTrigger>
            <TabsTrigger value="stats">Estadísticas</TabsTrigger>
          </TabsList>

          <TabsContent value="logs" className="space-y-6">
            {/* Filters */}
            <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Limpiar
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Date From */}
              <div>
                <Label htmlFor="dateFrom">Fecha Desde</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                />
              </div>

              {/* Date To */}
              <div>
                <Label htmlFor="dateTo">Fecha Hasta</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                />
              </div>

              {/* Actor Role */}
              <div>
                <Label htmlFor="actorRole">Rol</Label>
                <Select value={filters.actorRole || 'ALL'} onValueChange={(v) => handleFilterChange('actorRole', v)}>
                  <SelectTrigger id="actorRole">
                    <SelectValue placeholder="Todos los roles" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los roles</SelectItem>
                    <SelectItem value="OWNER">OWNER</SelectItem>
                    <SelectItem value="ADMIN">ADMIN</SelectItem>
                    <SelectItem value="MANAGER">MANAGER</SelectItem>
                    <SelectItem value="SELLER">SELLER</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Action */}
              <div>
                <Label htmlFor="action">Acción</Label>
                <Select value={filters.action || 'ALL'} onValueChange={(v) => handleFilterChange('action', v)}>
                  <SelectTrigger id="action">
                    <SelectValue placeholder="Todas las acciones" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas las acciones</SelectItem>
                    <SelectItem value="CREATE">CREATE</SelectItem>
                    <SelectItem value="UPDATE">UPDATE</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                    <SelectItem value="CUSTOMER_CREATED">CUSTOMER_CREATED</SelectItem>
                    <SelectItem value="CUSTOMER_UPDATED">CUSTOMER_UPDATED</SelectItem>
                    <SelectItem value="SALE_CREATED">SALE_CREATED</SelectItem>
                    <SelectItem value="SALE_UPDATED">SALE_UPDATED</SelectItem>
                    <SelectItem value="PAY">PAY</SelectItem>
                    <SelectItem value="CANCEL">CANCEL</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Entity Type */}
              <div>
                <Label htmlFor="entityType">Tipo de Entidad</Label>
                <Select value={filters.entityType || 'ALL'} onValueChange={(v) => handleFilterChange('entityType', v)}>
                  <SelectTrigger id="entityType">
                    <SelectValue placeholder="Todos los tipos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todos los tipos</SelectItem>
                    <SelectItem value="Customer">Customer</SelectItem>
                    <SelectItem value="Sale">Sale</SelectItem>
                    <SelectItem value="StockItem">StockItem</SelectItem>
                    <SelectItem value="Payment">Payment</SelectItem>
                    <SelectItem value="User">User</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Entity ID */}
              <div>
                <Label htmlFor="entityId">ID de Entidad</Label>
                <Input
                  id="entityId"
                  placeholder="ID específico..."
                  value={filters.entityId}
                  onChange={(e) => handleFilterChange('entityId', e.target.value)}
                />
              </div>

              {/* Search */}
              <div className="md:col-span-2">
                <Label htmlFor="search">Búsqueda</Label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="search"
                    placeholder="Buscar en email, acción, ID..."
                    className="pl-10"
                    value={filters.search}
                    onChange={(e) => handleFilterChange('search', e.target.value)}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

            {/* Results */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Registros de Auditoría</CardTitle>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (filters.dateFrom) params.set('dateFrom', filters.dateFrom);
                      if (filters.dateTo) params.set('dateTo', filters.dateTo);
                      if (filters.actorUserId) params.set('actorUserId', filters.actorUserId);
                      if (filters.actorRole && filters.actorRole !== 'ALL') params.set('actorRole', filters.actorRole);
                      if (filters.action && filters.action !== 'ALL') params.set('action', filters.action);
                      if (filters.entityType && filters.entityType !== 'ALL') params.set('entityType', filters.entityType);
                      if (filters.entityId) params.set('entityId', filters.entityId);
                      params.set('format', 'csv');
                      window.open(`/api/audit-logs/export?${params.toString()}`, '_blank');
                    }}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Exportar CSV
                  </Button>
                </div>
              </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Cargando movimientos...</div>
            ) : error ? (
              <div className="text-center py-8 text-destructive">
                Error al cargar movimientos. Por favor, intentá nuevamente.
              </div>
            ) : !data?.data || data.data.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No se encontraron movimientos con los filtros seleccionados.
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 text-sm font-medium">Fecha</th>
                        <th className="text-left p-2 text-sm font-medium">Usuario</th>
                        <th className="text-left p-2 text-sm font-medium">Rol</th>
                        <th className="text-left p-2 text-sm font-medium">Acción</th>
                        <th className="text-left p-2 text-sm font-medium">Entidad</th>
                        <th className="text-left p-2 text-sm font-medium">ID</th>
                        <th className="text-left p-2 text-sm font-medium">Resumen</th>
                        <th className="text-left p-2 text-sm font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.data.map((log) => (
                        <tr
                          key={log.id}
                          className="border-b hover:bg-muted/50 cursor-pointer"
                          onClick={() => {
                            setSelectedLog(log);
                            setShowDetails(true);
                          }}
                        >
                          <td className="p-2 text-sm">{formatDate(log.createdAt)}</td>
                          <td className="p-2 text-sm">
                            {log.actorUser?.name || log.actorEmail || 'Sistema'}
                          </td>
                          <td className="p-2 text-sm">
                            <span className="px-2 py-1 rounded text-xs bg-muted">
                              {log.actorRole || 'N/A'}
                            </span>
                          </td>
                          <td className="p-2 text-sm">
                            <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                              {log.action}
                            </span>
                          </td>
                          <td className="p-2 text-sm">{log.entityType}</td>
                          <td className="p-2 text-sm font-mono text-xs">{log.entityId.slice(0, 8)}...</td>
                          <td className="p-2 text-sm text-muted-foreground">
                            {log.after?.name || log.after?.customerName || log.after?.saleNumber || '-'}
                          </td>
                          <td className="p-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedLog(log);
                                setShowDetails(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {data.meta && data.meta.totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <div className="text-sm text-muted-foreground">
                      Mostrando {data.meta.itemCount} de {data.meta.totalItems} registros
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Página {data.meta.currentPage} de {data.meta.totalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPage((p) => Math.min(data.meta.totalPages, p + 1))}
                        disabled={page >= data.meta.totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="stats" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Estadísticas de Movimientos
                </CardTitle>
              </CardHeader>
              <CardContent>
                {statsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Cargando estadísticas...</div>
                ) : statsData ? (
                  <div className="space-y-6">
                    {/* Totales */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 border rounded">
                        <div className="text-sm text-muted-foreground">Total Movimientos</div>
                        <div className="text-2xl font-bold">{statsData.totalMovements.toLocaleString()}</div>
                      </div>
                      <div className="p-4 border rounded">
                        <div className="text-sm text-muted-foreground">Últimos 7 días</div>
                        <div className="text-2xl font-bold">{statsData.movementsLast7Days.toLocaleString()}</div>
                      </div>
                      <div className="p-4 border rounded">
                        <div className="text-sm text-muted-foreground">Últimos 30 días</div>
                        <div className="text-2xl font-bold">{statsData.movementsLast30Days.toLocaleString()}</div>
                      </div>
                    </div>

                    {/* Por Rol */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Movimientos por Rol</h3>
                      <div className="space-y-2">
                        {statsData.movementsByRole.map((item) => (
                          <div key={item.role} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm">{item.role || 'UNKNOWN'}</span>
                            <span className="text-sm font-medium">{item.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Por Acción */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Movimientos por Acción</h3>
                      <div className="space-y-2">
                        {statsData.movementsByAction.map((item) => (
                          <div key={item.action} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm">{item.action}</span>
                            <span className="text-sm font-medium">{item.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Por Entidad */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Movimientos por Tipo de Entidad</h3>
                      <div className="space-y-2">
                        {statsData.movementsByEntity.map((item) => (
                          <div key={item.entityType} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm">{item.entityType}</span>
                            <span className="text-sm font-medium">{item.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Top Actores */}
                    <div>
                      <h3 className="text-lg font-semibold mb-3">Top 5 Actores</h3>
                      <div className="space-y-2">
                        {statsData.topActors.map((actor, idx) => (
                          <div key={actor.userId || idx} className="flex items-center justify-between p-2 border rounded">
                            <span className="text-sm">{actor.email || 'Sistema'}</span>
                            <span className="text-sm font-medium">{actor.count.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">No hay estadísticas disponibles</div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Details Dialog */}
        <Dialog open={showDetails} onOpenChange={setShowDetails}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalles del Movimiento</DialogTitle>
              <DialogDescription>Información completa del registro de auditoría</DialogDescription>
            </DialogHeader>
            {selectedLog && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>ID</Label>
                    <p className="text-sm font-mono">{selectedLog.id}</p>
                  </div>
                  <div>
                    <Label>Fecha</Label>
                    <p className="text-sm">{formatDate(selectedLog.createdAt)}</p>
                  </div>
                  <div>
                    <Label>Usuario</Label>
                    <p className="text-sm">{selectedLog.actorUser?.name || selectedLog.actorEmail || 'Sistema'}</p>
                  </div>
                  <div>
                    <Label>Rol</Label>
                    <p className="text-sm">{selectedLog.actorRole || 'N/A'}</p>
                  </div>
                  <div>
                    <Label>Acción</Label>
                    <p className="text-sm">{selectedLog.action}</p>
                  </div>
                  <div>
                    <Label>Tipo de Entidad</Label>
                    <p className="text-sm">{selectedLog.entityType}</p>
                  </div>
                  <div>
                    <Label>ID de Entidad</Label>
                    <p className="text-sm font-mono">{selectedLog.entityId}</p>
                  </div>
                  <div>
                    <Label>Severidad</Label>
                    <p className="text-sm">{selectedLog.severity}</p>
                  </div>
                  <div>
                    <Label>Origen</Label>
                    <p className="text-sm">{selectedLog.source}</p>
                  </div>
                  <div>
                    <Label>Request ID</Label>
                    <p className="text-sm font-mono text-xs">{selectedLog.requestId || 'N/A'}</p>
                  </div>
                  {selectedLog.ip && (
                    <div>
                      <Label>IP</Label>
                      <p className="text-sm font-mono text-xs">{selectedLog.ip}</p>
                    </div>
                  )}
                </div>

                {selectedLog.before && (
                  <div>
                    <Label>Estado Anterior</Label>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.before, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.after && (
                  <div>
                    <Label>Estado Posterior</Label>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.after, null, 2)}
                    </pre>
                  </div>
                )}

                {selectedLog.metadata && (
                  <div>
                    <Label>Metadata</Label>
                    <pre className="mt-2 p-3 bg-muted rounded text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.metadata, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </PageShell>
    </RoleGuard>
  );
}
