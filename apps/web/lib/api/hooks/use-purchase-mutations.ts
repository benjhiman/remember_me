'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../auth-client';
import { useToast } from '@/components/ui/use-toast';
import { getErrorMessage, getRequestIdFromError } from '@/lib/utils/error-handler';
import { RequestIdChip } from '@/components/observability/request-id-chip';
import type { PurchaseStatus } from './use-purchases';

export interface CreatePurchaseLineDto {
  description: string;
  quantity: number;
  unitPriceCents: number;
  sku?: string;
}

export interface CreatePurchaseDto {
  vendorId: string;
  notes?: string;
  lines: CreatePurchaseLineDto[];
}

export interface UpdatePurchaseLineDto {
  id?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
  sku?: string;
}

export interface UpdatePurchaseDto {
  vendorId?: string;
  notes?: string;
  lines?: UpdatePurchaseLineDto[];
}

export interface TransitionPurchaseDto {
  status: PurchaseStatus;
}

export function useCreatePurchase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (dto: CreatePurchaseDto) => {
      return api.post('/purchases', dto);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      toast({
        title: 'Compra creada',
        description: 'La compra se creó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      const requestId = getRequestIdFromError(error);
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: (
            <div>
              <p>No tenés permisos para crear compras</p>
              {requestId && <RequestIdChip requestId={requestId} />}
            </div>
          ),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: (
            <div>
              <p>{message}</p>
              {requestId && <RequestIdChip requestId={requestId} />}
            </div>
          ),
          variant: 'destructive',
        });
      }
    },
  });
}

export function useUpdatePurchase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: UpdatePurchaseDto }) => {
      return api.patch(`/purchases/${id}`, dto);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase', variables.id] });
      toast({
        title: 'Compra actualizada',
        description: 'La compra se actualizó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      const requestId = getRequestIdFromError(error);
      if (error?.status === 403 || error?.response?.status === 403) {
        toast({
          title: 'Permisos insuficientes',
          description: (
            <div>
              <p>No tenés permisos para editar compras</p>
              {requestId && <RequestIdChip requestId={requestId} />}
            </div>
          ),
          variant: 'destructive',
        });
      } else if (error?.response?.data?.code === 'INVALID_STATUS') {
        toast({
          title: 'No se puede editar',
          description: (
            <div>
              <p>Solo las compras en borrador pueden editarse</p>
              {requestId && <RequestIdChip requestId={requestId} />}
            </div>
          ),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: (
            <div>
              <p>{message}</p>
              {requestId && <RequestIdChip requestId={requestId} />}
            </div>
          ),
          variant: 'destructive',
        });
      }
    },
  });
}

export function useTransitionPurchase() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id, dto }: { id: string; dto: TransitionPurchaseDto }) => {
      return api.post(`/purchases/${id}/transition`, dto);
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['purchase', variables.id] });
      toast({
        title: 'Estado actualizado',
        description: 'El estado de la compra se actualizó correctamente',
      });
    },
    onError: (error: any) => {
      const message = getErrorMessage(error);
      const requestId = getRequestIdFromError(error);
      if (error?.response?.data?.code === 'INVALID_TRANSITION') {
        const transitionMessage = error.response.data.message || 'No se puede cambiar a este estado';
        toast({
          title: 'Transición inválida',
          description: (
            <div>
              <p>{transitionMessage}</p>
              {requestId && <RequestIdChip requestId={requestId} />}
            </div>
          ),
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Error',
          description: (
            <div>
              <p>{message}</p>
              {requestId && <RequestIdChip requestId={requestId} />}
            </div>
          ),
          variant: 'destructive',
        });
      }
    },
  });
}
