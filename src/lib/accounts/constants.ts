export const ACCOUNT_MARKETPLACE_FEATURE_FLAG = "account_marketplace_enabled";

export const ACCOUNT_LISTING_REVISION_SCHEMA_VERSION = 1;
export const ACCOUNT_LISTING_SNAPSHOT_SCHEMA_VERSION = 1;

export const accountListingStatuses = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export const accountListingAvailabilities = [
  "AVAILABLE",
  "HELD",
  "SOLD",
  "PAUSED",
  "UNAVAILABLE",
] as const;

export const accountListingApprovalStatuses = [
  "PENDING_REVIEW",
  "APPROVED",
  "REJECTED",
] as const;

export const accountStatTypes = [
  "SKILL",
  "COMBAT",
  "QUEST",
  "SUMMARY",
  "OTHER",
] as const;

export const accountUnlockTypes = [
  "QUEST",
  "DIARY",
  "MINIGAME",
  "BOSS_ACCESS",
  "RAID",
  "PRAYER",
  "SPELLBOOK",
  "TRANSPORTATION",
  "UNTRADEABLE",
  "ACCOUNT_PROGRESSION",
  "OTHER",
] as const;

export const accountHoldStatuses = [
  "ACTIVE",
  "RELEASED",
  "EXPIRED",
  "CANCELLED",
] as const;

export const accountHandoverReadinessStates = [
  "INTERNAL_REVIEW_REQUIRED",
  "READY_FOR_FUTURE_HANDOVER",
  "NEEDS_MANUAL_REVIEW",
] as const;

export const accountImageTypes = [
  "COVER",
  "GALLERY",
  "STAT_OVERVIEW",
  "UNLOCK_OVERVIEW",
] as const;

export const accountSortOptions = [
  "featured",
  "price_asc",
  "price_desc",
  "total_level_desc",
  "newest",
] as const;

export const accountAvailabilityLabels: Record<
  (typeof accountListingAvailabilities)[number],
  string
> = {
  AVAILABLE: "Available",
  HELD: "Temporarily held",
  SOLD: "Sold",
  PAUSED: "Paused",
  UNAVAILABLE: "Unavailable",
};

export const accountApprovalLabels: Record<
  (typeof accountListingApprovalStatuses)[number],
  string
> = {
  PENDING_REVIEW: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const accountPublicationLabels: Record<
  (typeof accountListingStatuses)[number],
  string
> = {
  DRAFT: "Draft",
  PUBLISHED: "Published",
  ARCHIVED: "Archived",
};

export const accountGameModeLabels = {
  NORMAL: "Normal",
  IRONMAN: "Ironman",
  HARDCORE_IRONMAN: "Hardcore Ironman",
  ULTIMATE_IRONMAN: "Ultimate Ironman",
} as const;

export const accountSortLabels: Record<
  (typeof accountSortOptions)[number],
  string
> = {
  featured: "Featured",
  price_asc: "Price low to high",
  price_desc: "Price high to low",
  total_level_desc: "Total level high to low",
  newest: "Newest published",
};
