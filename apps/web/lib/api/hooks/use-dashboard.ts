import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { DashboardOverview, LeadsDashboard, SalesDashboard, StockDashboard } from '@/types/dashboard';

interface DashboardFilters {
  from?: string;
  to?: string;
  groupBy?: 'day' | 'week' | 'month';
  tz?: string;
}

const DEFAULT_STALE_TIME = 30 * 1000; // 30 seconds
const DEFAULT_CACHE_TIME = 5 * 60 * 1000; // 5 minutes

export function useDashboardOverview(filters: DashboardFilters = {}, enabled: boolean = true) {
  const queryParams = new URLSearchParams();
  if (filters.from) queryParams.set('from', filters.from);
  if (filters.to) queryParams.set('to', filters.to);
  if (filters.groupBy) queryParams.set('groupBy', filters.groupBy);
  if (filters.tz) queryParams.set('tz', filters.tz);

  return useQuery({
    queryKey: ['dashboard-overview', filters],
    queryFn: () => api.get<DashboardOverview>(`/dashboard/overview?${queryParams.toString()}`),
    enabled: enabled && !!filters.from && !!filters.to,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: 1,
  });
}

export function useDashboardLeads(filters: DashboardFilters = {}, enabled: boolean = true) {
  const queryParams = new URLSearchParams();
  if (filters.from) queryParams.set('from', filters.from);
  if (filters.to) queryParams.set('to', filters.to);
  if (filters.groupBy) queryParams.set('groupBy', filters.groupBy || 'day');
  if (filters.tz) queryParams.set('tz', filters.tz);

  return useQuery({
    queryKey: ['dashboard-leads', filters],
    queryFn: () => api.get<LeadsDashboard>(`/dashboard/leads?${queryParams.toString()}`),
    enabled: enabled && !!filters.from && !!filters.to,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: 1,
  });
}

export function useDashboardSales(filters: DashboardFilters = {}, enabled: boolean = true) {
  const queryParams = new URLSearchParams();
  if (filters.from) queryParams.set('from', filters.from);
  if (filters.to) queryParams.set('to', filters.to);
  if (filters.groupBy) queryParams.set('groupBy', filters.groupBy || 'day');
  if (filters.tz) queryParams.set('tz', filters.tz);

  return useQuery({
    queryKey: ['dashboard-sales', filters],
    queryFn: () => api.get<SalesDashboard>(`/dashboard/sales?${queryParams.toString()}`),
    enabled: enabled && !!filters.from && !!filters.to,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: 1,
  });
}

export function useDashboardStock(filters: DashboardFilters = {}, enabled: boolean = true) {
  const queryParams = new URLSearchParams();
  if (filters.from) queryParams.set('from', filters.from);
  if (filters.to) queryParams.set('to', filters.to);
  if (filters.groupBy) queryParams.set('groupBy', filters.groupBy || 'day');
  if (filters.tz) queryParams.set('tz', filters.tz);

  return useQuery({
    queryKey: ['dashboard-stock', filters],
    queryFn: () => api.get<StockDashboard>(`/dashboard/stock?${queryParams.toString()}`),
    enabled: enabled && !!filters.from && !!filters.to,
    staleTime: DEFAULT_STALE_TIME,
    gcTime: DEFAULT_CACHE_TIME,
    retry: 1,
  });
}
