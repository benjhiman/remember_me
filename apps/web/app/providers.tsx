'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { DevAutoLogin } from '@/components/auth/dev-auto-login';
import { Toaster } from '@/components/ui/toaster';
import { OrgThemeSync } from '@/components/settings/org-theme-sync';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000, // 5 seconds (matches polling interval)
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <DevAutoLogin />
      <OrgThemeSync />
      {children}
      <Toaster />
    </QueryClientProvider>
  );
}
