'use client';

import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { api, ApiError, ErrorType } from '@/lib/api/auth-client';
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
      let diagnosticInfo: string | null = null;
      
      // Get effective API base URL for diagnostics
      const apiBaseUrl = typeof window !== 'undefined' 
        ? (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.iphonealcosto.com/api')
        : (process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.iphonealcosto.com/api');
      
      // Check if it's an ApiError with type information
      if (err instanceof ApiError || err?.type) {
        const errorType = err.type || (err instanceof ApiError ? err.type : null);
        const status = err.status;
        
        switch (errorType) {
          case ErrorType.CORS:
            errorMessage = 'Error de configuración CORS. El servidor no permite conexiones desde este dominio.';
            if (process.env.NODE_ENV === 'production') {
              diagnosticInfo = `API: ${apiBaseUrl} | Tipo: CORS`;
            }
            break;
          case ErrorType.DNS:
            errorMessage = 'No se pudo resolver el dominio del servidor. Verificá la configuración de API URL.';
            if (process.env.NODE_ENV === 'production') {
              diagnosticInfo = `API: ${apiBaseUrl} | Tipo: DNS`;
            }
            break;
          case ErrorType.TIMEOUT:
            errorMessage = 'El servidor no responde. Verificá que el API esté disponible.';
            if (process.env.NODE_ENV === 'production') {
              diagnosticInfo = `API: ${apiBaseUrl} | Tipo: TIMEOUT`;
            }
            break;
          case ErrorType.AUTH:
            // Use backend message if available, otherwise default message
            if (status === 401) {
              errorMessage = err.message || 'Credenciales incorrectas. Verificá tu email y contraseña.';
            } else if (status === 403) {
              errorMessage = err.message || 'No tenés permisos para realizar esta acción.';
            } else {
              errorMessage = err.message || 'Error de autenticación.';
            }
            break;
          case ErrorType.NETWORK:
            // Only show "No se pudo conectar" for real network errors (not AUTH)
            if (!apiBaseUrl || apiBaseUrl.includes('localhost')) {
              errorMessage = 'API URL no configurada correctamente. Verificá NEXT_PUBLIC_API_BASE_URL.';
            } else {
              errorMessage = `No se pudo conectar con el servidor (${apiBaseUrl}). Verificá tu conexión y la configuración del API.`;
            }
            if (process.env.NODE_ENV === 'production') {
              diagnosticInfo = `API: ${apiBaseUrl} | Tipo: NETWORK | Status: ${status || 'N/A'}`;
            }
            break;
          default:
            // Use error message from API if available
            errorMessage = err.message || 'Error al iniciar sesión';
            if (process.env.NODE_ENV === 'production') {
              diagnosticInfo = `API: ${apiBaseUrl} | Tipo: ${errorType || 'UNKNOWN'} | Status: ${status || 'N/A'}`;
            }
        }
      } else if (err instanceof Error) {
        const msg = err.message.toLowerCase();
        if (msg.includes('cors') || msg.includes('cross-origin')) {
          errorMessage = 'Error de configuración CORS. El servidor no permite conexiones desde este dominio.';
          if (process.env.NODE_ENV === 'production') {
            diagnosticInfo = `API: ${apiBaseUrl} | Tipo: CORS (detectado por mensaje)`;
          }
        } else if (msg.includes('failed to fetch') || msg.includes('networkerror')) {
          if (!apiBaseUrl || apiBaseUrl.includes('localhost')) {
            errorMessage = 'API URL no configurada correctamente. Verificá NEXT_PUBLIC_API_BASE_URL en Vercel.';
          } else {
            errorMessage = `No se pudo conectar con el servidor (${apiBaseUrl}). Verificá la configuración del API.`;
          }
          if (process.env.NODE_ENV === 'production') {
            diagnosticInfo = `API: ${apiBaseUrl} | Tipo: NETWORK (Failed to fetch)`;
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
      
      // Show diagnostic info in production (only if there's an error)
      if (diagnosticInfo && process.env.NODE_ENV === 'production') {
        console.error('[LOGIN_ERROR]', diagnosticInfo);
      }
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

            {error && (
              <div>
                <p className="text-sm text-red-500">{error}</p>
                {process.env.NODE_ENV === 'production' && typeof window !== 'undefined' && (
                  <details className="mt-2 text-xs text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">Diagnóstico</summary>
                    <div className="mt-1 p-2 bg-muted rounded text-xs font-mono">
                      <div>API Base: {process.env.NEXT_PUBLIC_API_BASE_URL || 'https://api.iphonealcosto.com/api'}</div>
                      <div>Origin: {window.location.origin}</div>
                    </div>
                  </details>
                )}
              </div>
            )}

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
