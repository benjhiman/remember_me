'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { devAutoLogin } from '@/lib/auth/dev-auth-helper';

/**
 * Development-only component that auto-logs in with test user
 * Only runs in development mode (NODE_ENV !== 'production')
 */
export function DevAutoLogin() {
  const router = useRouter();
  const { user, setTokens } = useAuthStore();
  const [isDev, setIsDev] = useState(false);
  const [attempted, setAttempted] = useState(false);

  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV === 'production') {
      return;
    }

    setIsDev(true);

    // If already logged in, don't do anything
    if (user) {
      return;
    }

    // Only attempt once
    if (attempted) {
      return;
    }

    const attemptAutoLogin = async () => {
      setAttempted(true);
      const authData = await devAutoLogin();

      if (authData) {
        setTokens(authData.accessToken, authData.refreshToken, authData.user);
        // Redirect to /leads (or current path if already on a protected route)
        if (typeof window !== 'undefined') {
          const currentPath = window.location.pathname;
          if (currentPath === '/login' || currentPath === '/') {
            router.push('/board/leads');
          }
        }
      }
    };

    attemptAutoLogin();
  }, [user, router, setTokens, attempted]);

  // This component doesn't render anything
  return null;
}
