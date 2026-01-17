// Shared TypeScript types and interfaces
// These will be synced between the API and Web apps

// Prisma-exported types should NOT be required by the web build.
// Keep shared enums as pure TypeScript string unions.

// Roles
export type Role = "OWNER" | "ADMIN" | "MANAGER" | "SELLER";

// Leads
export type LeadStatus = "ACTIVE" | "CONVERTED" | "LOST" | "ARCHIVED";

// Stock
export type ItemCondition = "NEW" | "USED" | "REFURBISHED";
export type StockStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "DAMAGED" | "RETURNED" | "CANCELLED";
export type StockMovementType = "IN" | "OUT" | "RESERVE" | "RELEASE" | "ADJUST" | "SOLD";

// Reservations
export type ReservationStatus = "ACTIVE" | "CONFIRMED" | "EXPIRED" | "CANCELLED";

// Pricing
export type MarkupType = "MARKUP_PERCENT" | "MARKUP_FIXED" | "OVERRIDE_PRICE";

// Sales
export type SaleStatus = "DRAFT" | "PENDING" | "PAID" | "CANCELLED" | "REFUNDED";

// Invites
export type InviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED";
