'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageShell } from '@/components/layout/page-shell';
import { DollarSign, Package, TrendingUp, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const router = useRouter();

  const breadcrumbs = [
    { label: 'Pricing', href: '/pricing' },
  ];

  return (
    <PageShell
      title="Pricing"
      description="Gestión de precios y productos"
      breadcrumbs={breadcrumbs}
    >
      <div className="zoho-card p-8">
        <div className="text-center max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 mb-4">
              <DollarSign className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Coming Soon</h2>
            <p className="text-sm text-gray-600">
              El módulo de Pricing estará disponible próximamente.
            </p>
          </div>
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Esta sección permitirá gestionar precios, productos y configuraciones de venta.
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')}>
                Ir al Dashboard
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => router.push('/sales')}>
                Ver Ventas
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
