'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth-store';
import type { LoginResponse, SelectOrgRequest } from '@/types/api';

export default function SelectOrgPage() {
  const router = useRouter();
  const { tempToken, setTokens, clearAuth } = useAuthStore();
  const [organizations, setOrganizations] = useState<LoginResponse['organizations']>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tempToken) {
      router.push('/login');
      return;
    }

    // Fetch organizations (they should be in localStorage from login response)
    // For now, we'll need to get them from login again or store them
    // This is a simplified version - you might want to store orgs in auth store
  }, [tempToken, router]);

  const handleSelectOrg = async (organizationId: string) => {
    if (!tempToken) {
      router.push('/login');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Set temp token in header for this request
      const response = await api.post<LoginResponse>('/auth/select-organization', {
        organizationId,
      } as SelectOrgRequest);

      if (response.accessToken && response.refreshToken && response.user) {
        setTokens(response.accessToken, response.refreshToken, response.user);
        router.push('/inbox');
      } else {
        setError('Respuesta inesperada del servidor');
      }
    } catch (err: any) {
      setError(err.message || 'Error al seleccionar organización');
      if (err.status === 401) {
        clearAuth();
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Selecciona una organización</CardTitle>
          <CardDescription>Elige la organización con la que quieres trabajar</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-red-500 mb-4">{error}</p>}
          <div className="space-y-2">
            {organizations?.map((org) => (
              <Button
                key={org.id}
                variant="outline"
                className="w-full justify-start"
                onClick={() => handleSelectOrg(org.id)}
                disabled={loading}
              >
                <div className="flex flex-col items-start">
                  <span className="font-medium">{org.name}</span>
                  <span className="text-xs text-gray-500">{org.role}</span>
                </div>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
