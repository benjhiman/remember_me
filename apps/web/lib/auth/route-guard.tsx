'use client';

import { useEffect, useState } from 'react';
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
 * - Waits for zustand persist to hydrate from localStorage
 * - Checks auth state on mount and route changes
 * - Redirects to login if not authenticated
 * - Preserves redirectTo query param
 * - Prevents flash of protected content and redirect loops
 */
export function RouteGuard({ children, requireAuth = true }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, accessToken } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  // Wait for zustand persist to hydrate from localStorage
  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') return;

    // Zustand persist sets a flag in localStorage when hydrated
    // We check by trying to access the store state
    const checkHydration = () => {
      try {
        const state = useAuthStore.getState();
        // If we can access the state, it's hydrated
        setIsHydrated(true);
      } catch {
        // If there's an error, wait a bit more
        setTimeout(checkHydration, 50);
      }
    };

    // Initial check
    const timer = setTimeout(() => {
      checkHydration();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Once hydrated, check auth
  useEffect(() => {
    if (!isHydrated) return;
    if (!requireAuth) {
      setIsChecking(false);
      return;
    }

    // Check auth state after hydration (get fresh state each time)
    const state = useAuthStore.getState();
    const hasAuth = !!(state.user && state.accessToken);

    if (!hasAuth) {
      // Only redirect if we're not already on login/select-org page
      // Use replace to avoid adding to history (prevents loops)
      if (pathname && pathname !== '/login' && pathname !== '/select-org') {
        const currentPath = pathname;
        const redirectTo = `?redirectTo=${encodeURIComponent(currentPath)}`;
        router.replace(`/login${redirectTo}`);
      } else {
        setIsChecking(false);
      }
    } else {
      setIsChecking(false);
    }
  }, [isHydrated, requireAuth, pathname, router]);

  // Show loading state while hydrating or checking
  if (!isHydrated || (isChecking && requireAuth)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Cargando...</div>
        </div>
      </div>
    );
  }

  // If auth required but no user after hydration, don't render (redirect will happen)
  if (requireAuth && !user) {
    return null;
  }

  return <>{children}</>;
}
