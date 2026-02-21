import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { ReservationListResponse, StockReservation } from '@/types/stock';

interface UseStockReservationsParams {
  q?: string;
  status?: string;
  itemId?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function useStockReservations(params: UseStockReservationsParams = {}) {
  const { q, status, itemId, from, to, page = 1, limit = 50, enabled = true } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (q) queryParams.set('q', q);
  if (status) queryParams.set('status', status);
  if (itemId) queryParams.set('itemId', itemId);
  if (from) queryParams.set('from', from);
  if (to) queryParams.set('to', to);

  return useQuery({
    queryKey: ['stock-reservations', params],
    queryFn: () => api.get<ReservationListResponse>(`/stock/reservations?${queryParams.toString()}`),
    enabled,
  });
}

interface CreateReservationData {
  itemId?: string;
  stockItemId?: string;
  quantity: number;
  expiresAt?: string;
  customerName?: string;
  notes?: string;
  saleId?: string;
}

export function useCreateReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateReservationData) =>
      api.post<StockReservation>(`/stock/reservations`, data),
    onSuccess: () => {
      // Invalidate reservations, stock summary, and movements
      queryClient.invalidateQueries({ queryKey: ['stock-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements-global'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    },
  });
}

export function useReleaseReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) =>
      api.post<StockReservation>(`/stock/reservations/${reservationId}/release`),
    onSuccess: () => {
      // Invalidate reservations, stock summary, and movements
      queryClient.invalidateQueries({ queryKey: ['stock-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements-global'] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    },
  });
}

interface ExtendReservationData {
  hours?: number;
}

export function useExtendReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reservationId, hours }: { reservationId: string; hours?: number }) =>
      api.post<StockReservation>(`/stock/reservations/${reservationId}/extend`, { hours }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-reservations'] });
    },
  });
}
