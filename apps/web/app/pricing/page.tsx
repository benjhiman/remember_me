'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { DollarSign, Package, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PricingPage() {
  const router = useRouter();

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Pricing</h1>
        <p className="text-muted-foreground">Gestión de precios y productos</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Coming Soon
          </CardTitle>
          <CardDescription>
            El módulo de Pricing estará disponible próximamente.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Esta sección permitirá gestionar precios, productos y configuraciones de venta.
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => router.push('/dashboard')}>
                Ir al Dashboard
              </Button>
              <Button variant="outline" onClick={() => router.push('/sales')}>
                Ver Ventas
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
