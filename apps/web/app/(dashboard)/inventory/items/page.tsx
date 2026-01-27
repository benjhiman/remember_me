'use client';

import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { PageShell } from '@/components/layout/page-shell';

export default function InventoryItemsPage() {
  const breadcrumbs = [
    { label: 'Inventory', href: '/inventory' },
    { label: 'Items', href: '/inventory/items' },
  ];

  return (
    <PageShell
      title="All Items"
      description="Create and organize your product catalog"
      breadcrumbs={breadcrumbs}
    >
      <ZohoEmptyState
        title="All Items"
        headline="Start managing your items!"
        description="Create and organize your product catalog to streamline sales and inventory management."
        primaryActionLabel="CREATE ITEM"
        showDropdown
      />
    </PageShell>
  );
}
