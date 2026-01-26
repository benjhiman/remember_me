'use client';

import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { CreditCard } from 'lucide-react';

export default function PurchasesPaymentsMadePage() {
  return (
    <ZohoEmptyState
      title="All Payments"
      headline="You haven't made any payments yet."
      description="Receipts of your bill payments will show up here."
      primaryActionLabel="GO TO UNPAID BILLS"
      secondaryActionLabel="Import Payments"
      showDropdown
      icon={CreditCard}
    />
  );
}
