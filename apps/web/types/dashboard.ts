// Dashboard Types

export interface DashboardOverview {
  totalLeads: number;
  totalSales: number;
  salesByStatus: Array<{
    status: string;
    count: number;
  }>;
  revenue: string;
  stockAvailableCount: number;
  stockSoldCount: number;
  topProductsByVolume: Array<{
    model: string;
    quantitySold: number;
    salesCount: number;
  }>;
}


export interface SalesDashboard {
  salesCreated: Array<{
    period: string;
    count: number;
  }>;
  revenue: Array<{
    period: string;
    revenue: string;
  }>;
  breakdown: Array<{
    status: string;
    count: number;
  }>;
  topCustomers: Array<{
    customerName: string;
    salesCount: number;
    totalSpent: string;
  }>;
}

export interface StockDashboard {
  breakdown: Array<{
    status: string;
    count: number;
    totalQuantity: number;
  }>;
  movements: Array<{
    period: string;
    IN?: number;
    OUT?: number;
    SOLD?: number;
    ADJUST?: number;
  }>;
  lowStock: Array<{
    id: string;
    model: string;
    quantity: number;
    status: string;
    location?: string;
  }>;
}

export type DateRange = {
  from: string;
  to: string;
};

export type DateRangePreset = 'today' | '7d' | '30d' | 'custom';
