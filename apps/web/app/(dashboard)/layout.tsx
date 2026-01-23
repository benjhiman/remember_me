'use client';

import { AppShellZoho } from '@/components/layout/app-shell-zoho';
import { RouteGuard } from '@/lib/auth/route-guard';
import { ErrorBoundary } from '@/components/error-boundary';
import { OrgProvider } from '@/components/organizations/org-provider';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ErrorBoundary>
      <RouteGuard requireAuth={true}>
        <OrgProvider>
          <AppShellZoho>{children}</AppShellZoho>
        </OrgProvider>
      </RouteGuard>
    </ErrorBoundary>
  );
}
