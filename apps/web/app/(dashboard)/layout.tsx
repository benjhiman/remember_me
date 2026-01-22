'use client';

import { AppLayout } from '@/components/layout/app-layout';
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
        <AppLayout>{children}</AppLayout>
      </RouteGuard>
    </ErrorBoundary>
  );
}
