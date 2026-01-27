'use client';

import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { PageShell } from '@/components/layout/page-shell';

export default function InventoryPricelistPage() {
  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Price List', href: '/inventory/pricelist' },
  ];

  return (
    <PageShell
      title="All Price Lists"
      description="Customize your item pricing with flexibility"
      breadcrumbs={breadcrumbs}
    >
      <ZohoEmptyState
        title="All Price Lists"
        headline="Customize your item pricing with flexibility"
        description="Create and manage multiple pricelists tailored to different customer segments."
        primaryActionLabel="CREATE PRICE LIST"
        showDropdown
      />
    </PageShell>
  );
}
