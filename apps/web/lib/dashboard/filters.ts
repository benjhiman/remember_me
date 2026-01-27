import type { DateRangePreset } from '@/lib/utils/date-range';

export interface DashboardFilters {
  preset: DateRangePreset;
  from?: string; // YYYY-MM-DD
  to?: string; // YYYY-MM-DD
  compare?: boolean;
  groupBy?: 'day' | 'week' | 'month';
}

export interface DashboardFiltersParsed {
  preset: DateRangePreset;
  from: string; // ISO date string
  to: string; // ISO date string
  compare: boolean;
  groupBy: 'day' | 'week' | 'month';
}

/**
 * Parse dashboard filters from URL search params
 */
export function parseDashboardFilters(searchParams: URLSearchParams): DashboardFiltersParsed {
  const preset = (searchParams.get('preset') as DateRangePreset) || '7d';
  const from = searchParams.get('from') || undefined;
  const to = searchParams.get('to') || undefined;
  const compare = searchParams.get('compare') === '1' || searchParams.get('compare') === 'true';
  const groupBy = (searchParams.get('groupBy') as 'day' | 'week' | 'month') || 'day';

  // Validate preset
  const validPresets: DateRangePreset[] = ['today', '7d', '30d', 'custom'];
  const validPreset = validPresets.includes(preset) ? preset : '7d';

  // If custom, require both from and to
  if (validPreset === 'custom' && (!from || !to)) {
    return {
      preset: '7d',
      from: getDefaultDateRange('7d').from,
      to: getDefaultDateRange('7d').to,
      compare: false,
      groupBy: 'day',
    };
  }

  // Build date range
  let finalFrom: string;
  let finalTo: string;

  if (validPreset === 'custom' && from && to) {
    // Validate dates
    const fromDate = new Date(from);
    const toDate = new Date(to);
    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime()) || fromDate > toDate) {
      // Invalid dates, use default
      const defaultRange = getDefaultDateRange('7d');
      finalFrom = defaultRange.from;
      finalTo = defaultRange.to;
    } else {
      finalFrom = fromDate.toISOString();
      finalTo = toDate.toISOString();
    }
  } else {
    const defaultRange = getDefaultDateRange(validPreset);
    finalFrom = defaultRange.from;
    finalTo = defaultRange.to;
  }

  return {
    preset: validPreset,
    from: finalFrom,
    to: finalTo,
    compare,
    groupBy,
  };
}

/**
 * Convert dashboard filters to URL search params
 */
export function toSearchParams(filters: DashboardFilters): string {
  const params = new URLSearchParams();
  params.set('preset', filters.preset);
  if (filters.preset === 'custom' && filters.from && filters.to) {
    // Store as YYYY-MM-DD for readability
    const fromDate = new Date(filters.from);
    const toDate = new Date(filters.to);
    if (!isNaN(fromDate.getTime()) && !isNaN(toDate.getTime())) {
      params.set('from', fromDate.toISOString().split('T')[0]);
      params.set('to', toDate.toISOString().split('T')[0]);
    }
  }
  if (filters.compare) {
    params.set('compare', '1');
  }
  if (filters.groupBy && filters.groupBy !== 'day') {
    params.set('groupBy', filters.groupBy);
  }
  return params.toString();
}

/**
 * Get default date range for a preset
 */
function getDefaultDateRange(preset: DateRangePreset): { from: string; to: string } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case 'today':
      return {
        from: today.toISOString(),
        to: now.toISOString(),
      };
    case '7d':
      const sevenDaysAgo = new Date(today);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      return {
        from: sevenDaysAgo.toISOString(),
        to: now.toISOString(),
      };
    case '30d':
      const thirtyDaysAgo = new Date(today);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      return {
        from: thirtyDaysAgo.toISOString(),
        to: now.toISOString(),
      };
    case 'custom':
      // Fallback to 7d
      const fallback = new Date(today);
      fallback.setDate(fallback.getDate() - 7);
      return {
        from: fallback.toISOString(),
        to: now.toISOString(),
      };
    default:
      const defaultRange = new Date(today);
      defaultRange.setDate(defaultRange.getDate() - 7);
      return {
        from: defaultRange.toISOString(),
        to: now.toISOString(),
      };
  }
}

/**
 * Calculate previous period range (for compare)
 */
export function getPreviousPeriodRange(from: string, to: string): { from: string; to: string } {
  const fromDate = new Date(from);
  const toDate = new Date(to);
  const rangeDays = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;

  const prevTo = new Date(fromDate);
  prevTo.setDate(prevTo.getDate() - 1);

  const prevFrom = new Date(prevTo);
  prevFrom.setDate(prevFrom.getDate() - (rangeDays - 1));

  return {
    from: prevFrom.toISOString(),
    to: prevTo.toISOString(),
  };
}
