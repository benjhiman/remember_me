'use client';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';

function DevLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'error' | 'success'>('loading');

  useEffect(() => {
    const key = searchParams.get('k');
    const redirect = searchParams.get('redirect') || '/leads';

    if (!key) {
      setStatus('error');
      return;
    }

    // Call route handler
    fetch(`/api/dev-login?k=${encodeURIComponent(key)}`)
      .then(async (res) => {
        if (!res.ok) {
          setStatus('error');
          return;
        }

        const data = await res.json();

        if (data.accessToken && data.refreshToken && data.user) {
          setTokens(data.accessToken, data.refreshToken, data.user);
          setStatus('success');
          router.push(redirect);
        } else {
          setStatus('error');
        }
      })
      .catch(() => {
        setStatus('error');
      });
  }, [searchParams, setTokens, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Logging in...</div>
          <div className="text-sm text-gray-500">Please wait</div>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="text-lg font-semibold mb-2">Not found</div>
          <div className="text-sm text-gray-500">The requested page could not be found.</div>
        </div>
      </div>
    );
  }

  return null;
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
      <DevLoginContent />
    </Suspense>
  );
}
