'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage, getRequestIdFromError } from '@/lib/utils/error-handler';
import { RequestIdChip } from '@/components/observability/request-id-chip';
import React from 'react';
import type { LedgerAccount } from './use-ledger-accounts';

export interface CreateLedgerAccountDto {
  code: string;
  name: string;
  type: 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
  isActive?: boolean;
}

export function useCreateLedgerAccount() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation<LedgerAccount, Error, CreateLedgerAccountDto>({
    mutationFn: (dto) => api.post<LedgerAccount>('/ledger/accounts', dto),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ledger-accounts'] });
      toast({ title: 'Cuenta creada', description: 'La cuenta contable ha sido creada correctamente.' });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      const requestId = getRequestIdFromError(error);
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: React.createElement(
            'div',
            null,
            React.createElement('p', null, 'No tenés permisos para crear cuentas contables'),
            requestId && React.createElement(RequestIdChip, { requestId })
          ),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: React.createElement(
            'div',
            null,
            React.createElement('p', null, message),
            requestId && React.createElement(RequestIdChip, { requestId })
          ),
          variant: 'destructive',
        });
      }
    },
  });
}
