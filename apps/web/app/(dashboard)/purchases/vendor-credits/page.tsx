'use client';

import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { Gift } from 'lucide-react';

export default function PurchasesVendorCreditsPage() {
  return (
    <ZohoEmptyState
      title="All Vendor Credits"
      headline="You deserve some credit too."
      description="Create vendor credits and apply them to multiple bills when buying stuff from your vendor."
      primaryActionLabel="CREATE VENDOR CREDITS"
      secondaryActionLabel="Import Vendor Credits"
      showDropdown
      icon={Gift}
    />
  );
}
