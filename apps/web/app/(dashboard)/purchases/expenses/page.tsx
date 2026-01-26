'use client';

import { ZohoEmptyState } from '@/components/ui/zoho-empty-state';
import { Receipt } from 'lucide-react';

export default function PurchasesExpensesPage() {
  return (
    <ZohoEmptyState
      title="All Expenses"
      headline="Track your expenses easily"
      description="Record and categorize your business expenses for better financial tracking."
      primaryActionLabel="CREATE EXPENSE"
      showDropdown
      icon={Receipt}
    />
  );
}
