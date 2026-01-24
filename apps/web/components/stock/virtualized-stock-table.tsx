'use client';

import { useMemo } from 'react';
import { VirtualizedTable } from '@/components/data/virtualized-table';
import type { StockStatus, ItemCondition } from '@/types/stock';

interface StockItem {
  id: string;
  model: string;
  sku?: string | null;
  condition: ItemCondition;
  quantity: number;
  reservedQuantity?: number | null;
  availableQuantity?: number | null;
  status: StockStatus;
  updatedAt: string;
}

interface VirtualizedStockTableProps {
  items: StockItem[];
  onItemClick: (item: StockItem) => void;
  getStatusColor: (status: StockStatus) => string;
  getStatusLabel: (status: StockStatus) => string;
  getConditionLabel: (condition: ItemCondition) => string;
  formatDate: (date: string) => string;
  className?: string;
}

function VirtualizedStockTableComponent({
  items,
  onItemClick,
  getStatusColor,
  getStatusLabel,
  getConditionLabel,
  formatDate,
  className,
}: VirtualizedStockTableProps) {
  const columns = useMemo(
    () => [
      { key: 'item', label: 'Item / SKU' },
      { key: 'condition', label: 'Condición' },
      { key: 'quantity', label: 'Cantidad Total' },
      { key: 'reserved', label: 'Reservado' },
      { key: 'available', label: 'Disponible' },
      { key: 'status', label: 'Estado' },
      { key: 'updated', label: 'Última Actualización' },
    ],
    [],
  );

  const renderRow = useMemo(
    () => (item: StockItem) => {
      const reserved = item.reservedQuantity || 0;
      const available = item.availableQuantity ?? (item.quantity - reserved);
      return (
        <>
          <td className="px-6 py-4 whitespace-nowrap">
            <div className="text-sm font-medium text-gray-900">{item.model}</div>
            {item.sku && <div className="text-sm text-gray-500">{item.sku}</div>}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {getConditionLabel(item.condition)}
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.quantity}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-yellow-600">{reserved}</td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
            {available}
          </td>
          <td className="px-6 py-4 whitespace-nowrap">
            <span
              className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                item.status,
              )}`}
            >
              {getStatusLabel(item.status)}
            </span>
          </td>
          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
            {formatDate(item.updatedAt)}
          </td>
        </>
      );
    },
    [getStatusColor, getStatusLabel, getConditionLabel, formatDate],
  );

  return (
    <div className={className || 'bg-white rounded-lg border border-gray-200 overflow-hidden'}>
      <VirtualizedTable
        items={items}
        columns={columns}
        renderRow={(item) => (
          <tr
            key={item.id}
            onClick={() => onItemClick(item)}
            className="hover:bg-gray-50 cursor-pointer"
          >
            {renderRow(item)}
          </tr>
        )}
        estimateSize={() => 60}
        className="h-[600px]"
        tableClassName="min-w-full divide-y divide-gray-200"
      />
    </div>
  );
}

VirtualizedStockTableComponent.displayName = 'VirtualizedStockTable';

export const VirtualizedStockTable = VirtualizedStockTableComponent;
