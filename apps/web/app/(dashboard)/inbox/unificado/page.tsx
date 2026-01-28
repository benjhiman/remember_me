'use client';

import { Suspense } from 'react';
import InboxUnifiedInner from '../unified/unified-inner';

// Unificado uses the same component as unified (General)
export default function InboxUnificadoPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-140px)] rounded-xl border bg-background" />}>
      <InboxUnifiedInner />
    </Suspense>
  );
}
