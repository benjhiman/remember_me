// Sales Types

export type SaleStatus = 'DRAFT' | 'RESERVED' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface SaleItem {
  id: string;
  saleId: string;
  stockItemId: string;
  model: string;
  quantity: number;
  unitPrice: string;
  totalPrice: string;
  stockItem?: {
    id: string;
    model: string;
    sku?: string;
    imei?: string;
  };
}

export interface Sale {
  id: string;
  organizationId: string;
  createdById: string;
  assignedToId?: string;
  saleNumber?: string;
  status: SaleStatus;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  subtotal: string;
  discount: string;
  total: string;
  currency: string;
  reservedAt?: string | null;
  paidAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  leadId?: string;
  lead?: {
    id: string;
    name: string;
    email?: string;
    phone?: string;
  };
  createdBy?: {
    id: string;
    name: string;
    email?: string;
  };
  assignedTo?: {
    id: string;
    name: string;
    email?: string;
  };
  items?: SaleItem[];
  stockReservations?: Array<{
    id: string;
    stockItemId: string;
    quantity: number;
    status: string;
    stockItem?: {
      id: string;
      model: string;
    };
  }>;
  _count?: {
    items: number;
    stockReservations: number;
  };
}

export interface SaleListResponse {
  data: Sale[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
