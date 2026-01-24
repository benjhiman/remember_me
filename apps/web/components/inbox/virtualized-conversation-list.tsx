'use client';

import { useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils/cn';

interface VirtualizedConversationListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  estimateSize?: (index: number) => number;
  className?: string;
  overscan?: number;
}

/**
 * VirtualizedConversationList - Virtualized list for conversation items
 * 
 * Use for lists with 50+ items to improve scroll performance.
 */
export function VirtualizedConversationList<T>({
  items,
  renderItem,
  estimateSize = () => 80,
  className,
  overscan = 8,
}: VirtualizedConversationListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize,
    overscan,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div ref={parentRef} className={cn('h-full overflow-auto', className)}>
      <div
        className="relative"
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualRow) => {
          const item = items[virtualRow.index];
          return (
            <div
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
            >
              {renderItem(item, virtualRow.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

VirtualizedConversationList.displayName = 'VirtualizedConversationList';
