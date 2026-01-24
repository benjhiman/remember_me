'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { DevAutoLogin } from '@/components/auth/dev-auto-login';
import { Toaster } from '@/components/ui/toaster';
import { OrgThemeSync } from '@/components/settings/org-theme-sync';
import { AuthHydrationGate } from '@/components/auth/auth-hydration-gate';
import { ThemeProvider } from '@/components/providers/theme-provider';

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
          },
        },
      })
  );

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
