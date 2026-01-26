'use client';

import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { DollarSign } from 'lucide-react';

export default function PriceListsPage() {
  return (
    <ZohoEmptyState
      title="All Price Lists"
      headline="Customize your item pricing with flexibility"
      description="Create and manage multiple pricelists tailored to different customer segments."
      primaryActionLabel="CREATE PRICE LIST"
      showDropdown
    />
  );
}
