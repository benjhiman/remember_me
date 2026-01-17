// AUTO-GENERATED from packages/prisma/schema.prisma
// Do not edit by hand.

export type Role = "OWNER" | "ADMIN" | "MANAGER" | "SELLER";
export type InviteStatus = "PENDING" | "ACCEPTED" | "EXPIRED" | "CANCELLED";
export type LeadStatus = "ACTIVE" | "CONVERTED" | "LOST" | "ARCHIVED";
export type ItemCondition = "NEW" | "USED" | "REFURBISHED";
export type StockStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "DAMAGED" | "RETURNED" | "CANCELLED";
export type StockMovementType = "IN" | "OUT" | "RESERVE" | "RELEASE" | "ADJUST" | "SOLD";
export type ReservationStatus = "ACTIVE" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
export type RuleType = "MARKUP_PERCENT" | "MARKUP_FIXED" | "OVERRIDE_PRICE";
export type ScopeType = "GLOBAL" | "BY_PRODUCT" | "BY_CONDITION" | "BY_CATEGORY";
export type SaleStatus = "DRAFT" | "RESERVED" | "PAID" | "SHIPPED" | "DELIVERED" | "CANCELLED";
export type AuditAction = "CREATE" | "UPDATE" | "DELETE" | "RESTORE" | "PAY" | "CANCEL" | "RESERVE" | "CONFIRM" | "RELEASE" | "SHIP" | "DELIVER" | "ASSIGN" | "ADJUST";
export type IntegrationProvider = "WHATSAPP" | "INSTAGRAM" | "FACEBOOK";
export type ConnectedAccountStatus = "CONNECTED" | "DISCONNECTED" | "ERROR";
export type WebhookEventStatus = "PENDING" | "PROCESSED" | "FAILED";
export type MessageDirection = "INBOUND" | "OUTBOUND";
export type MessageStatus = "QUEUED" | "SENT" | "DELIVERED" | "READ" | "FAILED";
export type WhatsAppTemplateCategory = "MARKETING" | "UTILITY" | "AUTHENTICATION";
export type WhatsAppTemplateStatus = "APPROVED" | "PENDING" | "REJECTED" | "DISABLED";
export type IntegrationJobType = "SEND_MESSAGE" | "SEND_MESSAGE_TEMPLATE" | "PROCESS_WEBHOOK" | "SYNC_ACCOUNT" | "RETRY" | "AUTOMATION_ACTION" | "FETCH_META_SPEND" | "REFRESH_META_TOKEN";
export type WhatsAppAutomationTrigger = "LEAD_CREATED" | "SALE_RESERVED" | "SALE_PAID" | "NO_REPLY_24H";
export type WhatsAppAutomationAction = "SEND_TEMPLATE" | "SEND_TEXT";
export type IntegrationJobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";
export type ConversationStatus = "OPEN" | "PENDING" | "CLOSED";
export type AttributionSource = "META_LEAD_ADS";
export type MetaSpendLevel = "CAMPAIGN" | "ADSET" | "AD";
