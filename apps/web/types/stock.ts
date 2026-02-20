// Stock Types

export type StockStatus = 'AVAILABLE' | 'SOLD' | 'DAMAGED' | 'RETURNED' | 'CANCELLED';
export type ItemCondition = 'NEW' | 'USED' | 'REFURBISHED';
export type MovementType = 'IN' | 'OUT' | 'ADJUST' | 'SOLD';

export interface StockItem {
  id: string;
  organizationId: string;
  sku?: string;
  model: string;
  storage?: string;
  color?: string;
  condition: ItemCondition;
  imei?: string;
  serialNumber?: string;
  quantity: number;
  costPrice?: string;
  basePrice?: string;
  status: StockStatus;
  location?: string;
  notes?: string;
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt: string;
  // Computed fields (from backend)
  availableQuantity?: number;
}

export interface StockMovement {
  id: string;
  organizationId: string;
  stockItemId: string;
  type: MovementType;
  quantity: number;
  quantityBefore: number;
  quantityAfter: number;
  reason?: string;
  saleId?: string | null;
  createdById: string;
  metadata?: Record<string, any>;
  createdAt: string;
  createdBy?: {
    id: string;
    name: string;
    email?: string;
  };
}

export interface StockListResponse {
  data: StockItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface MovementListResponse {
  data: StockMovement[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
