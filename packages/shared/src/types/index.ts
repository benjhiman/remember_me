import type {
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

// Re-export shared enums for API and Web
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
};

// Backwards-compatible alias used across the codebase.
// In Prisma schema this enum is called RuleType.
export type MarkupType = RuleType;
