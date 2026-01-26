'use client';

import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Lock } from 'lucide-react';

interface OwnerOnlyDeniedProps {
  title?: string;
  message?: string;
  backLabel?: string;
  backHref?: string;
}

/**
 * OwnerOnlyDenied - Component for displaying owner-only access denied message
 * 
 * Used when a non-owner user tries to access an owner-only section.
 * Shows a clear message and a back button.
 */
export function OwnerOnlyDenied({
  title = 'Solo Owner',
  message = 'Esta sección está disponible solo para el Owner de la organización.',
  backLabel = 'Volver',
  backHref,
}: OwnerOnlyDeniedProps) {
  const router = useRouter();

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <div className="p-12 text-center">
      <div className="max-w-sm mx-auto">
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gray-100 mx-auto mb-4">
          <Lock className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-600 mb-6">{message}</p>
        <Button onClick={handleBack} variant="outline" size="sm">
          {backLabel}
        </Button>
      </div>
    </div>
  );
}
