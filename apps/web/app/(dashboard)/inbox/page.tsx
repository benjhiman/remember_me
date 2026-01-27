'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InboxPage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to unified inbox
    router.replace('/inbox/unificado');
  }, [router]);

  return null;
}
