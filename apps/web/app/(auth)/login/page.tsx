'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth-store';
import type { LoginRequest, LoginResponse } from '@/types/api';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setTokens, setTempToken } = useAuthStore();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [branding, setBranding] = useState<{ name: string; logoUrl: string | null } | null>(null);
  
  const redirectTo = searchParams.get('redirectTo') || '/inbox';

  useEffect(() => {
    try {
      const raw = localStorage.getItem('crm-branding');
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed?.name) setBranding({ name: parsed.name, logoUrl: parsed.logoUrl || null });
    } catch {}
  }, []);

  const brandName = useMemo(() => branding?.name || 'CRM', [branding?.name]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginRequest>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginRequest) => {
    setError(null);
    setLoading(true);

    try {
      const response = await api.post<LoginResponse>('/auth/login', data);

      if (response.requiresOrgSelection && response.organizations) {
        // User has multiple orgs, redirect to selection
        if (response.tempToken) {
          setTempToken(response.tempToken);
        }
        router.push('/select-org');
      } else if (response.accessToken && response.refreshToken && response.user) {
        // Direct login
        setTokens(response.accessToken, response.refreshToken, response.user);
        router.push(redirectTo);
      } else {
        setError('Respuesta inesperada del servidor');
      }
    } catch (err: any) {
      setError(err.message || 'Error al iniciar sesión');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-3">
            {branding?.logoUrl ? (
              <img
                src={branding.logoUrl}
                alt="Logo"
                className="h-10 w-10 rounded-md border bg-white object-contain"
              />
            ) : (
              <div className="h-10 w-10 rounded-md border bg-muted flex items-center justify-center text-xs font-semibold">
                {brandName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0">
              <CardTitle className="truncate">{brandName}</CardTitle>
              <CardDescription>Ingresá a tu cuenta</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium mb-1">
                Email
              </label>
              <Input
                id="email"
                type="email"
                {...register('email')}
                placeholder="tu@email.com"
              />
              {errors.email && (
                <p className="text-sm text-red-500 mt-1">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1">
                Contraseña
              </label>
              <Input
                id="password"
                type="password"
                {...register('password')}
                placeholder="••••••••"
              />
              {errors.password && (
                <p className="text-sm text-red-500 mt-1">{errors.password.message}</p>
              )}
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Iniciando sesión...' : 'Iniciar sesión'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
