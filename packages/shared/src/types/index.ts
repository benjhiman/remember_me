// Shared TypeScript types and interfaces
// These will be synced between the API and Web apps

// Re-export Prisma types
export type {
  User,
  Organization,
  Membership,
  RefreshToken,
  Invitation,
  Pipeline,
  Stage,
  Lead,
  Note,
  Task,
  StockItem,
  PricingRule,
  Sale,
  SaleItem,
  Role,
  LeadStatus,
  ItemCondition,
  StockStatus,
  MarkupType,
  SaleStatus,
  InviteStatus,
} from '@remember-me/prisma';

// Add any additional shared types here as the project grows
