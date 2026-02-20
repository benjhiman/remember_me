// Auth types
export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  accessToken?: string;
  refreshToken?: string;
  user?: {
    id: string;
    email: string;
    name: string;
    organizationId: string;
    organizationName: string;
    role: string;
  };
  requiresOrgSelection?: boolean;
  organizations?: Array<{
    id: string;
    name: string;
    slug: string;
    role: string;
  }>;
  tempToken?: string;
}

export interface SelectOrgRequest {
  organizationId: string;
}

// ROAS/Attribution types
export type AttributionGroupBy = 'campaign' | 'adset' | 'ad';

export interface AttributionMetric {
  campaignId?: string;
  adsetId?: string;
  adId?: string;
  leadsCount: number;
  salesCount: number;
  revenue: number;
  spend: number;
  avgTicket: number;
  conversionRate: number;
  roas: number | null;
}

// User types
export type Role = 'OWNER' | 'ADMIN' | 'MANAGER' | 'SELLER';

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatar: string | null;
  role: Role;
  joinedAt: string;
}

// Meta OAuth types
export interface MetaOAuthStartResponse {
  url: string;
  state: string;
}

export interface MetaAdAccount {
  id: string;
  name: string;
}

export interface ConnectedAccount {
  id: string;
  provider: 'FACEBOOK';
  displayName: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  externalAccountId: string;
  metadata: {
    metaUserId?: string;
    pageId?: string;
    adAccounts: Array<{
      id: string;
      name: string;
    }>;
  };
  token: {
    expiresAt: string;
    scopes: string[];
  } | null;
  createdAt: string;
  updatedAt: string;
}

// Lead types
export type LeadStatus = 'ACTIVE' | 'CONVERTED' | 'LOST' | 'ARCHIVED';

export interface Lead {
  id: string;
  organizationId: string;
  assignedToId?: string;
  createdById: string;
  name: string;
  email?: string;
  phone?: string;
  source?: string;
  city?: string;
  budget?: string;
  model?: string;
  customFields?: Record<string, any>;
  tags?: string[];
  status: LeadStatus;
  convertedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo?: {
    id: string;
    name: string;
    email?: string;
  };
  creator?: {
    id: string;
    name: string;
    email?: string;
  };
  _count?: {
    notes?: number;
    tasks?: number;
  };
}

export interface LeadListResponse {
  data: Lead[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
