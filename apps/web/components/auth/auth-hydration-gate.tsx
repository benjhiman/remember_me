'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { Loader2, AlertCircle } from 'lucide-react';
import { validateRuntimeConfig } from '@/lib/runtime-config';

const MAX_HYDRATION_TIMEOUT = 5000; // 5 seconds max

/**
 * AuthHydrationGate
 * 
 * Prevents rendering protected content until zustand persist has fully hydrated.
 * This eliminates false redirects to /login during hydration.
 * 
 * Features:
 * - Maximum timeout to prevent infinite loading
 * - Runtime config validation
 * - Error state with retry
 * 
 * Usage: Wrap the root layout or providers with this component.
 */
export function AuthHydrationGate({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') {
      setIsHydrated(true);
      return;
    }

    // Validate runtime config first
    const config = validateRuntimeConfig();
    if (!config.isValid) {
      setConfigError(config.errors.join('; '));
      setHasError(true);
      return;
    }

    // Set maximum timeout to prevent infinite loading
    const maxTimeout = setTimeout(() => {
      if (!isHydrated) {
        console.error('[AUTH_HYDRATION] ⚠️ Hydration timeout exceeded');
        setHasError(true);
      }
    }, MAX_HYDRATION_TIMEOUT);

    // Zustand persist hydrates asynchronously
    // We need to wait until the store is ready
    let checkCount = 0;
    const MAX_CHECKS = 50; // Max 50 checks (2.5 seconds at 50ms intervals)

    const checkHydration = () => {
      checkCount++;
      
      if (checkCount > MAX_CHECKS) {
        console.error('[AUTH_HYDRATION] ⚠️ Max hydration checks exceeded');
        clearTimeout(maxTimeout);
        setHasError(true);
        return;
      }

      try {
        const state = useAuthStore.getState();
        // If we can access the state, it's likely hydrated
        // But we need to wait a tick to ensure persist has finished
        setTimeout(() => {
          clearTimeout(maxTimeout);
          setIsHydrated(true);
          // Mark auth as ready once hydration is complete
          useAuthStore.getState().setAuthReady(true);
          
          // Production logging
          if (process.env.NODE_ENV === 'production') {
            const hasToken = !!state.accessToken;
            const hasUser = !!state.user;
            console.log('[AUTH_HYDRATION] ✅ Auth ready:', { hasToken, hasUser });
          }
        }, 0);
      } catch (error) {
        // If there's an error, wait a bit more
        setTimeout(checkHydration, 50);
      }
    };

    // Initial check after a small delay to allow persist to start
    const timer = setTimeout(() => {
      checkHydration();
    }, 100);

    return () => {
      clearTimeout(timer);
      clearTimeout(maxTimeout);
    };
  }, [isHydrated]);

  // Show error state
  if (hasError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center max-w-md p-6 border border-red-200 rounded-lg bg-red-50 dark:bg-red-900/20 dark:border-red-800">
          <AlertCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
          <div className="text-red-600 font-semibold mb-2">Initialization Error</div>
          {configError ? (
            <>
              <div className="text-sm text-red-700 dark:text-red-300 mb-4">{configError}</div>
              <div className="text-xs text-red-600 dark:text-red-400 mb-4">
                Please configure NEXT_PUBLIC_API_BASE_URL in Vercel environment variables.
              </div>
            </>
          ) : (
            <div className="text-sm text-red-700 dark:text-red-300 mb-4">
              Failed to initialize application. Please refresh the page.
            </div>
          )}
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-red-600 text-white rounded-md text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Show minimal loading state during hydration
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-2" />
          <div className="text-sm text-muted-foreground">Cargando...</div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
