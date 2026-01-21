'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function DevLoginRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const key = searchParams.get('k');
    const redirect = searchParams.get('redirect');
    
    // Build new URL preserving query params
    const params = new URLSearchParams();
    if (key) params.set('k', key);
    if (redirect) params.set('redirect', redirect);
    
    const queryString = params.toString();
    const newUrl = `/dev/login${queryString ? `?${queryString}` : ''}`;
    
    router.replace(newUrl);
  }, [router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="text-center">
        <div className="text-lg font-semibold mb-2">Redirecting...</div>
        <div className="text-sm text-gray-500">Please wait</div>
      </div>
    </div>
  );
}

export default function DevLoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Loading...</div>
        </div>
      </div>
    }>
      <DevLoginRedirect />
    </Suspense>
  );
}
