'use client';

import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { Package } from 'lucide-react';

export default function ItemsPage() {
  return (
    <ZohoEmptyState
      title="All Items"
      headline="Start managing your items!"
      description="Create and organize your product catalog to streamline sales and inventory management."
      primaryActionLabel="CREATE ITEM"
      showDropdown
    />
  );
}
