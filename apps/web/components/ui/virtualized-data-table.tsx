'use client';

import { useRef, useEffect, ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils/cn';
import { Skeleton } from '@/components/ui/skeleton';

export interface VirtualizedDataTableColumn<T> {
  key: string;
  label: string;
  className?: string;
  width?: string | number;
}

export interface VirtualizedDataTableProps<T> {
  items: T[];
  columns: VirtualizedDataTableColumn<T>[];
  renderRow: (item: T, index: number) => ReactNode;
  estimateSize?: (index: number) => number;
  className?: string;
  tableClassName?: string;
  headerClassName?: string;
  rowClassName?: string | ((item: T, index: number) => string);
  onRowClick?: (item: T, index: number) => void;
  loading?: boolean;
  emptyState?: ReactNode;
  height?: string | number;
  overscan?: number;
  onLoadMore?: () => void;
  hasMore?: boolean;
  isLoadingMore?: boolean;
}

/**
 * VirtualizedDataTable - Reusable virtualized table component
 * 
 * Features:
 * - Row virtualization for performance with large datasets (10k+ rows)
 * - Sticky header
 * - Loading state
 * - Empty state
 * - Optional onRowClick handler
 * - Auto-load more on scroll
 * 
 * Usage:
 * ```tsx
 * <VirtualizedDataTable
 *   items={data}
 *   columns={columns}
 *   renderRow={(item) => <td>{item.name}</td>}
 *   onRowClick={(item) => router.push(`/item/${item.id}`)}
 *   loading={isLoading}
 *   emptyState={<div>No items</div>}
 * />
 * ```
 */
export function VirtualizedDataTable<T>({
  items,
  columns,
  renderRow,
  estimateSize = () => 60,
  className,
  tableClassName,
  headerClassName,
  rowClassName,
  onRowClick,
  loading = false,
  emptyState,
  height = 600,
  overscan = 5,
  onLoadMore,
  hasMore = false,
  isLoadingMore = false,
}: VirtualizedDataTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  // Auto-load more when scrolling near the end
  useEffect(() => {
    if (!onLoadMore || !hasMore || isLoadingMore) return;

    const lastItem = virtualItems[virtualItems.length - 1];
    if (lastItem) {
      const threshold = items.length - 10; // Load more when 10 items from end
      if (lastItem.index >= threshold) {
        onLoadMore();
      }
    }
  }, [virtualItems, hasMore, isLoadingMore, onLoadMore, items.length]);

  // Loading state
  if (loading) {
    return (
      <div className={cn('bg-white rounded-lg border border-gray-200 overflow-hidden', className)}>
        <div className="p-4 space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </div>
      </div>
    );
  }

  // Empty state
  if (items.length === 0 && emptyState) {
    return (
      <div className={cn('bg-white rounded-lg border border-gray-200 overflow-hidden', className)}>
        {emptyState}
      </div>
    );
  }

  // Normal table if items < 200 (fallback)
  if (items.length < 200) {
    return (
      <div className={cn('bg-white rounded-lg border border-gray-200 overflow-hidden', className)}>
        <div className="overflow-x-auto">
          <table className={cn('w-full', tableClassName)}>
            <thead className={cn('bg-gray-50 border-b border-gray-200', headerClassName)}>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                      col.className,
                    )}
                    style={col.width ? { width: col.width } : undefined}
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {items.map((item, index) => {
                const rowClass = typeof rowClassName === 'function' 
                  ? rowClassName(item, index) 
                  : rowClassName;
                return (
                  <tr
                    key={index}
                    onClick={() => onRowClick?.(item, index)}
                    className={cn(
                      onRowClick && 'cursor-pointer hover:bg-gray-50',
                      rowClass,
                    )}
                  >
                    {renderRow(item, index)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Virtualized table for large datasets
  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto bg-white rounded-lg border border-gray-200', className)}
      style={{ height: typeof height === 'number' ? `${height}px` : height }}
    >
      <div className="overflow-x-auto">
        <table className={cn('w-full', tableClassName)}>
          <thead className={cn('bg-gray-50 border-b border-gray-200 sticky top-0 z-10', headerClassName)}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50',
                    col.className,
                  )}
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody
            className="bg-white divide-y divide-gray-200 relative"
            style={{ height: `${virtualizer.getTotalSize()}px` }}
          >
            {virtualItems.map((virtualRow) => {
              const item = items[virtualRow.index];
              const rowClass = typeof rowClassName === 'function' 
                ? rowClassName(item, virtualRow.index) 
                : rowClassName;
              return (
                <tr
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={virtualizer.measureElement}
                  onClick={() => onRowClick?.(item, virtualRow.index)}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={cn(
                    onRowClick && 'cursor-pointer hover:bg-gray-50',
                    rowClass,
                  )}
                >
                  {renderRow(item, virtualRow.index)}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Load more indicator */}
      {isLoadingMore && (
        <div className="p-4 border-t flex items-center justify-center bg-gray-50">
          <div className="text-sm text-gray-600">Cargando más...</div>
        </div>
      )}
    </div>
  );
}

VirtualizedDataTable.displayName = 'VirtualizedDataTable';
