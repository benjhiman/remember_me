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

// Conversation types
export type IntegrationProvider = 'WHATSAPP' | 'INSTAGRAM';
export type ConversationStatus = 'OPEN' | 'PENDING' | 'CLOSED';
export type MessageDirection = 'INBOUND' | 'OUTBOUND';
export type MessageStatus = 'QUEUED' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED';
export type SlaStatus = 'OK' | 'WARNING' | 'BREACH';

export interface Conversation {
  id: string;
  organizationId: string;
  provider: IntegrationProvider;
  externalThreadId?: string;
  phone?: string;
  handle?: string;
  leadId?: string;
  lead?: {
    id: string;
    name: string;
    phone?: string;
    stage?: {
      id: string;
      name: string;
    };
  };
  assignedToId?: string;
  assignedUser?: {
    id: string;
    name: string;
  };
  status: ConversationStatus;
  lastMessageAt: string;
  lastInboundAt?: string;
  lastOutboundAt?: string;
  lastReadAt?: string;
  unreadCount: number;
  previewText?: string;
  lastMessageDirection?: MessageDirection;
  tags: Array<{
    id: string;
    name: string;
    color?: string;
    organizationId?: string;
    createdAt?: string;
  }>;
  canReply: boolean;
  requiresTemplate: boolean;
  slaStatus: SlaStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationListResponse {
  data: Conversation[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface Message {
  id: string;
  conversationId: string;
  provider: IntegrationProvider;
  direction: MessageDirection;
  from: string;
  to: string;
  text?: string;
  templateId?: string;
  status?: MessageStatus;
  externalMessageId?: string;
  metaJson?: any;
  createdAt: string;
  updatedAt: string;
}

export interface MessageListResponse {
  data: Message[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface ConversationTag {
  id: string;
  organizationId: string;
  name: string;
  color?: string;
  createdAt: string;
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
  provider: IntegrationProvider | 'FACEBOOK';
  displayName: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  externalAccountId: string;
  metadata: {
    metaUserId?: string;
    pageId?: string;
    igUserId?: string;
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
