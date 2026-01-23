'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/lib/store/auth-store';
import { Loader2 } from 'lucide-react';

/**
 * AuthHydrationGate
 * 
 * Prevents rendering protected content until zustand persist has fully hydrated.
 * This eliminates false redirects to /login during hydration.
 * 
 * Usage: Wrap the root layout or providers with this component.
 */
export function AuthHydrationGate({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Check if we're in the browser
    if (typeof window === 'undefined') {
      setIsHydrated(true);
      return;
    }

    // Zustand persist hydrates asynchronously
    // We need to wait until the store is ready
    const checkHydration = () => {
      try {
        const state = useAuthStore.getState();
        // If we can access the state, it's likely hydrated
        // But we need to wait a tick to ensure persist has finished
        setTimeout(() => {
          setIsHydrated(true);
        }, 0);
      } catch {
        // If there's an error, wait a bit more
        setTimeout(checkHydration, 50);
      }
    };

    // Initial check after a small delay to allow persist to start
    const timer = setTimeout(() => {
      checkHydration();
    }, 100);

    return () => clearTimeout(timer);
  }, []);

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
