/**
 * Prefetch utilities for intelligent data loading
 */

import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Check if connection is slow (using Network Information API if available)
 */
export function isSlowConnection(): boolean {
  if (typeof navigator === 'undefined' || !('connection' in navigator)) {
    return false; // Assume fast if API not available
  }
  const conn = (navigator as any).connection;
  if (!conn) return false;
  // @ts-ignore
  const effectiveType = conn.effectiveType;
  return effectiveType === 'slow-2g' || effectiveType === '2g';
}

/**
 * Prefetch a route on hover
 */
export function usePrefetchOnHover() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const slowConnection = isSlowConnection();

  return (path: string, queryKey?: string[]) => {
    if (slowConnection) return; // Skip prefetch on slow connections

    return {
      onMouseEnter: () => {
        router.prefetch(path);
        if (queryKey) {
          queryClient.prefetchQuery({ queryKey });
        }
      },
    };
  };
}
