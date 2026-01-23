'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function InboxIndex() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/inbox/whatsapp');
  }, [router]);
  return null;
}
