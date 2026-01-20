import { useQuery } from '@tanstack/react-query';
import { api } from '../client';
import type { DashboardOverview, LeadsDashboard, SalesDashboard, StockDashboard } from '@/types/dashboard';

interface DashboardFilters {
  from?: string;
  to?: string;
  groupBy?: 'day' | 'week' | 'month';
  tz?: string;
}

export function useDashboardOverview(filters: DashboardFilters = {}, enabled: boolean = true) {
  const queryParams = new URLSearchParams();
  if (filters.from) queryParams.set('from', filters.from);
  if (filters.to) queryParams.set('to', filters.to);
  if (filters.groupBy) queryParams.set('groupBy', filters.groupBy);
  if (filters.tz) queryParams.set('tz', filters.tz);

  return useQuery({
    queryKey: ['dashboard-overview', filters],
    queryFn: () => api.get<DashboardOverview>(`/dashboard/overview?${queryParams.toString()}`),
    enabled,
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
    enabled,
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
    enabled,
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
    enabled,
  });
}
