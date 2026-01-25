'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { DevAutoLogin } from '@/components/auth/dev-auto-login';
import { Toaster } from '@/components/ui/toaster';
import { OrgThemeSync } from '@/components/settings/org-theme-sync';
import { AuthHydrationGate } from '@/components/auth/auth-hydration-gate';
import { ThemeProvider } from '@/components/providers/theme-provider';
import { validateRuntimeConfig } from '@/lib/runtime-config';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30 * 1000, // 30s default
            gcTime: 5 * 60 * 1000, // 5min garbage collection
            refetchOnWindowFocus: false,
            retry: 1,
            // Add timeout to all queries to prevent infinite loading
            networkMode: 'online',
          },
        },
      })
  );

  // Validate runtime config on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const config = validateRuntimeConfig();
      if (!config.isValid) {
        // Error will be shown by AuthHydrationGate
        console.error('[PROVIDERS] ❌ Runtime config validation failed');
      } else if (process.env.NODE_ENV === 'production') {
        console.log('[PROVIDERS] ✅ Runtime config validated, API:', config.apiBaseUrl);
      }
    }
  }, []);

  return (
    <ThemeProvider>
      <QueryClientProvider client={queryClient}>
        <AuthHydrationGate>
          <DevAutoLogin />
          <OrgThemeSync />
          {children}
          <Toaster />
        </AuthHydrationGate>
      </QueryClientProvider>
    </ThemeProvider>
  );
}
