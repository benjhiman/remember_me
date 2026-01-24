'use client';

import { ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils/cn';

interface EntityTableShellProps<T> {
  // Data
  items: T[];
  isLoading: boolean;
  error: Error | null;
  onRetry?: () => void;
  
  // Pagination
  page?: number;
  total?: number;
  limit?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  
  // UI
  header?: ReactNode;
  toolbar?: ReactNode;
  emptyState?: ReactNode;
  emptyIcon?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  
  // Table
  columns: Array<{
    key: string;
    label: string;
    className?: string;
  }>;
  renderRow: (item: T, index: number) => ReactNode;
  
  // Styling
  className?: string;
  tableClassName?: string;
  rowHeight?: number; // For virtualization estimation
}

/**
 * EntityTableShell - Reusable table component for entity lists
 * 
 * Provides consistent structure:
 * - Header + toolbar
 * - Loading skeleton
 * - Error state with retry
 * - Empty state
 * - Table with virtualized rows (optional)
 * - Pagination
 */
export function EntityTableShell<T>({
  items,
  isLoading,
  error,
  onRetry,
  page = 1,
  total = 0,
  limit = 20,
  totalPages,
  onPageChange,
  header,
  toolbar,
  emptyState,
  emptyIcon,
  emptyTitle = 'No hay elementos',
  emptyDescription = 'No se encontraron resultados.',
  columns,
  renderRow,
  className,
  tableClassName,
  rowHeight = 60,
}: EntityTableShellProps<T>) {
  const hasPagination = totalPages !== undefined && totalPages > 1;
  const showPagination = hasPagination && onPageChange;

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      {header && <div className="mb-4">{header}</div>}

      {/* Toolbar */}
      {toolbar && <div className="mb-4">{toolbar}</div>}

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="p-8 text-center">
          <div className="max-w-md mx-auto">
            <p className="text-red-600 font-medium mb-2">Error al cargar los datos</p>
            <p className="text-sm text-gray-600 mb-4">{error.message || 'No se pudo conectar con el servidor'}</p>
            {onRetry && (
              <Button onClick={onRetry} variant="outline" size="sm">
                Reintentar
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && !error && items.length === 0 && (
        <div className="p-12 text-center">
          {emptyState || (
            <div className="max-w-sm mx-auto">
              {emptyIcon && <div className="mb-4 flex justify-center">{emptyIcon}</div>}
              <h3 className="text-sm font-semibold text-gray-900 mb-1">{emptyTitle}</h3>
              <p className="text-xs text-gray-600">{emptyDescription}</p>
            </div>
          )}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && items.length > 0 && (
        <>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className={cn('w-full', tableClassName)}>
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {columns.map((col) => (
                      <th
                        key={col.key}
                        className={cn(
                          'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                          col.className,
                        )}
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item, index) => renderRow(item, index))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {showPagination && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Mostrando {((page - 1) * limit) + 1} - {Math.min(page * limit, total)} de {total}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange?.(Math.max(1, page - 1))}
                  disabled={page === 1}
                >
                  Anterior
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onPageChange?.(Math.min(totalPages!, page + 1))}
                  disabled={page === totalPages}
                >
                  Siguiente
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
