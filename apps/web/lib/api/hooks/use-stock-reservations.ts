import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../client';
import type { ReservationListResponse, StockReservation } from '@/types/stock';

interface UseStockReservationsParams {
  itemId?: string;
  status?: string;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export function useStockReservations(params: UseStockReservationsParams = {}) {
  const { itemId, status, page = 1, limit = 50, enabled = true } = params;

  const queryParams = new URLSearchParams({
    page: page.toString(),
    limit: limit.toString(),
  });

  if (itemId) queryParams.set('itemId', itemId);
  if (status) queryParams.set('status', status);

  return useQuery({
    queryKey: ['stock-reservations', params],
    queryFn: () => api.get<ReservationListResponse>(`/stock/reservations?${queryParams.toString()}`),
    enabled,
  });
}

export function useReleaseReservation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (reservationId: string) =>
      api.post<StockReservation>(`/stock/reservations/${reservationId}/release`),
    onSuccess: (reservation) => {
      // Invalidate reservations and stock item
      queryClient.invalidateQueries({ queryKey: ['stock-reservations'] });
      queryClient.invalidateQueries({ queryKey: ['stock-item', reservation.stockItemId] });
      queryClient.invalidateQueries({ queryKey: ['stock-items'] });
    },
  });
}
