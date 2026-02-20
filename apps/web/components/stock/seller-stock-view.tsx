'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { useSellerStockView } from '@/lib/api/hooks/use-seller-stock-view';
import { Skeleton } from '@/components/ui/skeleton';
import { Package } from 'lucide-react';

// Stock thresholds
const STOCK_LOW = 3;
const STOCK_MEDIUM = 7;

function getStockColor(qty: number): string {
  if (qty <= STOCK_LOW) {
    return 'bg-red-50 border-red-200 hover:bg-red-100';
  } else if (qty <= STOCK_MEDIUM) {
    return 'bg-yellow-50 border-yellow-200 hover:bg-yellow-100';
  } else {
    return 'bg-green-50 border-green-200 hover:bg-green-100';
  }
}

function getStockTextColor(qty: number): string {
  if (qty <= STOCK_LOW) {
    return 'text-red-700 font-semibold';
  } else if (qty <= STOCK_MEDIUM) {
    return 'text-yellow-700 font-semibold';
  } else {
    return 'text-green-700 font-semibold';
  }
}

export function SellerStockView() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error } = useSellerStockView(search || undefined);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <Skeleton key={i} className="h-12 w-full" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-12 text-center">
        <div className="max-w-sm mx-auto">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-sm font-semibold text-gray-900 mb-1">Error al cargar stock</h3>
          <p className="text-xs text-gray-600">No se pudo cargar la información del stock.</p>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="p-12 text-center">
        <div className="max-w-sm mx-auto">
          <Package className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          {search.trim() ? (
            <>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Sin resultados</h3>
              <p className="text-xs text-gray-600 mb-4">
                No se encontraron items que coincidan con &quot;{search}&quot;.
              </p>
            </>
          ) : (
            <>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Sin stock</h3>
              <p className="text-xs text-gray-600">No hay items en stock disponibles.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search */}
      <div className="max-w-sm">
        <Input
          placeholder="Buscar por modelo, GB, color..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Sections */}
      {data.map((section) => (
        <div key={section.section} className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
            {section.section}
          </h3>
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cantidad
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {section.rows.map((row, idx) => (
                  <tr
                    key={`${section.section}-${idx}`}
                    className={getStockColor(row.qty)}
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {row.label}
                    </td>
                    <td className={`px-4 py-3 text-sm text-right ${getStockTextColor(row.qty)}`}>
                      {row.qty}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
