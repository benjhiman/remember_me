'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError, ErrorType } from '@/lib/api/client';
import { useAuthStore } from '@/lib/store/auth-store';
import type { LoginRequest, LoginResponse } from '@/types/api';

const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'Contraseña requerida'),
});

function LoginPageContent() {
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
      // Better error handling for production with specific error detection
      let errorMessage = 'Error al iniciar sesión';
      
      // Check if it's an ApiError with type information
      if (err?.type) {
        switch (err.type) {
          case 'CORS':
            errorMessage = 'Error de configuración CORS. El servidor no permite conexiones desde este dominio.';
            break;
          case 'DNS':
            errorMessage = 'No se pudo resolver el dominio del servidor. Verificá la configuración de API URL.';
            break;
          case 'TIMEOUT':
            errorMessage = 'El servidor no responde. Verificá que el API esté disponible.';
            break;
          case 'AUTH':
            // Use backend message if available, otherwise default message
            if (err.status === 401) {
              errorMessage = err.message || 'Credenciales incorrectas. Verificá tu email y contraseña.';
            } else if (err.status === 403) {
              errorMessage = err.message || 'No tenés permisos para realizar esta acción.';
            } else {
              errorMessage = err.message || 'Error de autenticación.';
            }
            break;
          case 'NETWORK':
            // Check if it's a base URL issue
            const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
            if (!apiUrl || apiUrl.includes('localhost')) {
              errorMessage = 'API URL no configurada correctamente. Verificá NEXT_PUBLIC_API_BASE_URL.';
            } else {
              errorMessage = `No se pudo conectar con el servidor (${apiUrl}). Verificá tu conexión y la configuración del API.`;
            }
            break;
          default:
            // Use error message from API if available
            errorMessage = err.message || 'Error al iniciar sesión';
        }
      } else if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes('cors') || msg.includes('cross-origin')) {
          errorMessage = 'Error de configuración CORS. El servidor no permite conexiones desde este dominio.';
        } else if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
          const apiUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:4000/api';
          if (!apiUrl || apiUrl.includes('localhost')) {
            errorMessage = 'API URL no configurada correctamente. Verificá NEXT_PUBLIC_API_BASE_URL en Vercel.';
          } else {
            errorMessage = `No se pudo conectar con el servidor (${apiUrl}). Verificá la configuración del API.`;
          }
        } else if (msg.includes('401') || msg.includes('403')) {
          errorMessage = 'Credenciales incorrectas. Verificá tu email y contraseña.';
        } else {
          errorMessage = err.message;
        }
      } else if (err?.message) {
        errorMessage = err.message;
      } else if (typeof err === 'string') {
        errorMessage = err;
      }
      
      setError(errorMessage);
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

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Cargando...</CardTitle>
          </CardHeader>
        </Card>
      </div>
    }>
      <LoginPageContent />
    </Suspense>
  );
}
