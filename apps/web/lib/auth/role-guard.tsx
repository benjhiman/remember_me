'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store/auth-store';
import { Role } from '@/lib/auth/permissions';

// Re-export Role for convenience
export { Role };
// We'll create the forbidden content inline to avoid circular imports

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: Role[];
  fallback?: React.ReactNode;
  redirectTo?: string;
}

/**
 * RoleGuard Component
 * 
 * Protects routes that require specific roles.
 * - Checks if current user's role is in allowedRoles
 * - Shows forbidden page or redirects if not allowed
 * - Prevents redirect loops
 */
export function RoleGuard({ 
  children, 
  allowedRoles, 
  fallback,
  redirectTo = '/forbidden'
}: RoleGuardProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [isAllowed, setIsAllowed] = useState(false);

  useEffect(() => {
    if (!user) {
      setIsChecking(false);
      setIsAllowed(false);
      return;
    }

    const userRole = user.role as Role;
    const hasAccess = allowedRoles.includes(userRole);
    
    setIsAllowed(hasAccess);
    setIsChecking(false);

    // Redirect if not allowed (only if not already on forbidden page)
    if (!hasAccess && pathname !== redirectTo && pathname !== '/forbidden') {
      router.replace(redirectTo);
    }
  }, [user, allowedRoles, pathname, router, redirectTo]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="text-sm text-muted-foreground">Verificando permisos...</div>
        </div>
      </div>
    );
  }

  if (!isAllowed) {
    if (fallback) {
      return <>{fallback}</>;
    }
    // Show forbidden message
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg border p-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Acceso Denegado
          </h1>
          <p className="text-gray-600 mb-6">
            No tenés permisos para acceder a esta sección.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Tu rol actual: <strong>{user?.role}</strong>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Roles permitidos: <strong>{allowedRoles.join(', ')}</strong>
          </p>
          <Button onClick={() => router.push('/dashboard')}>
            Volver al Dashboard
          </Button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
