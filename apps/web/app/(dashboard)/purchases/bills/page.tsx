'use client';

import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { FileText } from 'lucide-react';

export default function PurchasesBillsPage() {
  return (
    <ZohoEmptyState
      title="All Bills"
      headline="Owe money? It's good to pay bills on time!"
      description="If you've purchased something for your business, and you don't have to repay it immediately, then you can record it as a bill."
      primaryActionLabel="CREATE A BILL"
      secondaryActionLabel="Import Bills"
      showDropdown
      icon={FileText}
    />
  );
}
