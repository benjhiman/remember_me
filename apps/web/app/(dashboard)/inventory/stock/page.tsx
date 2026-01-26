'use client';

import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { Package } from 'lucide-react';
import { PageShell } from '@/components/layout/page-shell';

export default function InventoryStockPage() {
  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Stock', href: '/inventory/stock' },
  ];

  return (
    <PageShell
      title="All Stock"
      breadcrumbs={breadcrumbs}
      toolbar={
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">Filter By:</div>
          <select className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm">
            <option>Type: All</option>
            <option>Type: Adjustment</option>
            <option>Type: Transfer</option>
          </select>
          <select className="h-9 rounded-md border border-input bg-background px-3 py-1.5 text-sm">
            <option>Period: All</option>
            <option>Period: This Month</option>
            <option>Period: Last Month</option>
          </select>
        </div>
      }
    >
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="max-w-2xl mx-auto text-center space-y-6">
          <div className="flex justify-center">
            <div className="h-24 w-24 rounded-full bg-muted flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-3xl font-bold text-foreground">
            Keep your inventory accurate
          </h2>
          <p className="text-lg text-muted-foreground">
            Adjust your inventory to ensure accurate quantity and value.
          </p>
          <div className="pt-4">
            <button
              onClick={() => {
                if (typeof window !== 'undefined') {
                  // eslint-disable-next-line no-alert
                  alert('Coming soon: CREATE ADJUSTMENT');
                }
              }}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-md font-medium hover:bg-primary/90 transition-colors"
            >
              CREATE ADJUSTMENT
            </button>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
