'use client';

import { AppShellZoho } from '@/components/layout/app-shell-zoho';
import { RouteGuard } from '@/lib/auth/route-guard';
import { ErrorBoundary } from '@/components/error-boundary';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <RouteGuard requireAuth={true}>
        <AppShellZoho>{children}</AppShellZoho>
      </RouteGuard>
    </ErrorBoundary>
  );
}
