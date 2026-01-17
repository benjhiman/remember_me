// Shared TypeScript types and interfaces
// These will be synced between the API and Web apps

export type {
  Role,
  InviteStatus,
  LeadStatus,
  ItemCondition,
  StockStatus,
  StockMovementType,
  ReservationStatus,
  RuleType,
  ScopeType,
  SaleStatus,
} from "./prisma-enums";

// Backwards-compatible alias used in code/docs.
// In Prisma schema this is RuleType.
export type MarkupType = RuleType;
