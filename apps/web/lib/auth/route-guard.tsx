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
 * - Checks auth state on mount and route changes
 * - Redirects to login if not authenticated
 * - Preserves redirectTo query param
 * - Prevents flash of protected content
 */
export function RouteGuard({ children, requireAuth = true }: RouteGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    if (!requireAuth) {
      setIsChecking(false);
      return;
    }

    // Small delay to allow auth store to hydrate from localStorage
    const timer = setTimeout(() => {
      if (!user) {
        // Only redirect if we're not already on login page
        if (pathname !== '/login') {
          const currentPath = pathname || '/';
          const redirectTo = currentPath !== '/login' ? `?redirectTo=${encodeURIComponent(currentPath)}` : '';
          router.push(`/login${redirectTo}`);
        }
      } else {
        setIsChecking(false);
      }
    }, 150); // Slightly longer delay to ensure localStorage is hydrated

    return () => clearTimeout(timer);
  }, [user, pathname, router, requireAuth]);

  // Show loading state while checking auth
  if (isChecking && requireAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Cargando...</div>
        </div>
      </div>
    );
  }

  // If auth required but no user, don't render children (redirect will happen)
  if (requireAuth && !user) {
    return null;
  }

  return <>{children}</>;
}
