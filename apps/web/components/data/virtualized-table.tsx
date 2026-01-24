'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils/cn';

interface VirtualizedTableProps<T> {
  items: T[];
  columns: Array<{
    key: string;
    label: string;
    className?: string;
  }>;
  renderRow: (item: T, index: number) => React.ReactNode;
  estimateSize?: (index: number) => number;
  className?: string;
  tableClassName?: string;
}

/**
 * VirtualizedTable - Table with virtualized rows for performance
 * 
 * Only virtualizes tbody rows, keeps thead fixed.
 * Use for lists with 100+ items.
 */
export function VirtualizedTable<T>({
  items,
  columns,
  renderRow,
  estimateSize = () => 60,
  className,
  tableClassName,
}: VirtualizedTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan: 5,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className={cn('overflow-auto', className)} style={{ height: '600px' }}>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className={cn('w-full', tableClassName)}>
            <thead className="bg-gray-50 border-b border-gray-200 sticky top-0 z-10">
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider bg-gray-50',
                      col.className,
                    )}
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
                return (
                  <tr
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className="hover:bg-gray-50"
                  >
                    {renderRow(item, virtualRow.index)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

VirtualizedTable.displayName = 'VirtualizedTable';
