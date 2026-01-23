'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';

interface RouteGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

/**
 * Route Guard Component
 * 
 * Protects routes that require authentication.
 * - Assumes AuthHydrationGate has already handled hydration at root level
 * - Checks auth state with fresh store state (no stale closures)
 * - Redirects to login if not authenticated
 * - Preserves redirectTo query param
 * - Prevents redirect loops
 */
export function RouteGuard({ children, requireAuth = true }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isChecking, setIsChecking] = useState(true);
  const hasRedirectedRef = useRef(false);

  useEffect(() => {
    if (!requireAuth) {
      setIsChecking(false);
      return;
    }

    // Get fresh state from store (don't use hook to avoid stale closures)
    const checkAuth = () => {
      // Prevent multiple redirects
      if (hasRedirectedRef.current) return;

      const state = useAuthStore.getState();
      const hasAuth = !!(state.user && state.accessToken);

      if (!hasAuth) {
        // Only redirect if we're not already on login/select-org page
        if (pathname && pathname !== '/login' && pathname !== '/select-org') {
          hasRedirectedRef.current = true;
          const currentPath = pathname;
          const redirectTo = `?redirectTo=${encodeURIComponent(currentPath)}`;
          router.replace(`/login${redirectTo}`);
        } else {
          setIsChecking(false);
        }
      } else {
        setIsChecking(false);
      }
    };

    // Small delay to ensure we're past hydration
    const timer = setTimeout(checkAuth, 50);

    return () => {
      clearTimeout(timer);
    };
  }, [requireAuth, pathname, router]);

  // Reset redirect flag when pathname changes (new navigation)
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [pathname]);

  // Show minimal loading state while checking
  if (isChecking && requireAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Cargando...</div>
        </div>
      </div>
    );
  }

  // If auth required, check one more time with fresh state
  if (requireAuth) {
    const state = useAuthStore.getState();
    if (!state.user || !state.accessToken) {
      return null;
    }
  }

  return <>{children}</>;
}
