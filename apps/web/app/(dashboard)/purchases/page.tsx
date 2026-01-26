'use client';

// Redirect to purchases list (legacy route compatibility)
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function PurchasesPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to legacy route for now
    router.replace('/sales/purchases');
  }, [router]);

  return null;
}
