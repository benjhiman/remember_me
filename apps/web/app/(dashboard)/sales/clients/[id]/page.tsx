'use client';

// Redirect to /sales/customers/[id]
import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

export default function ClientDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : undefined;
  
  useEffect(() => {
    if (id) {
      router.replace(`/sales/customers/${id}`);
    }
  }, [router, id]);

  return null;
}
