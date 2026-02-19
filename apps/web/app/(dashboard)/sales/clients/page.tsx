'use client';

// Redirect to /sales/customers
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientsPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/sales/customers');
  }, [router]);

  return null;
}
