export const CUSTOM_BUILD_FEATURE_FLAG = "custom_account_build_enabled";

export const CUSTOM_BUILD_REVISION_SCHEMA_VERSION = 1;
export const CUSTOM_BUILD_ESTIMATE_SNAPSHOT_SCHEMA_VERSION = 1;
export const CUSTOM_BUILD_QUOTE_REVISION_SCHEMA_VERSION = 1;

export const customBuildRequestStatuses = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "NEEDS_CUSTOMER_INFORMATION",
  "ESTIMATE_PROVIDED",
  "QUOTE_DRAFT",
  "QUOTE_SENT",
  "QUOTE_ACCEPTED",
  "QUOTE_DECLINED",
  "QUOTE_EXPIRED",
  "CLOSED",
  "CANCELLED",
] as const;

export const customBuildEstimateStates = [
  "AUTOMATIC",
  "PARTIAL",
  "MANUAL_REVIEW_REQUIRED",
  "UNAVAILABLE",
] as const;

export const customBuildObjectiveTypes = [
  "QUEST",
  "ACHIEVEMENT_DIARY",
  "UNLOCK",
  "MINIGAME",
  "BOSS_ACCESS",
  "PRAYER",
  "SPELLBOOK",
  "TRANSPORT",
  "UNTRADEABLE",
  "OTHER",
] as const;

export const customBuildPricingModes = [
  "PER_XP",
  "PER_LEVEL_BAND",
  "FIXED_TARGET_PACKAGE",
  "FIXED_ADDITION",
  "MANUAL_REVIEW_ONLY",
] as const;

export const customBuildQuoteStatuses = [
  "DRAFT",
  "SENT",
  "ACCEPTED",
  "DECLINED",
  "EXPIRED",
  "VOID",
] as const;

export const customBuildAttachmentStatuses = [
  "QUARANTINED",
  "APPROVED",
  "REJECTED",
  "REMOVED",
] as const;

export const customBuildAttachmentScanStatuses = [
  "NOT_SCANNED",
  "PENDING",
  "PASSED",
  "FAILED",
  "REJECTED",
] as const;

export const customBuildSkillValueModes = [
  "LEVEL",
  "XP",
  "UNKNOWN_CURRENT",
  "FRESH_ACCOUNT",
] as const;

export const customBuildGameModeLabels = {
  NORMAL: "Normal",
  IRONMAN: "Ironman",
  HARDCORE_IRONMAN: "Hardcore Ironman",
  ULTIMATE_IRONMAN: "Ultimate Ironman",
} as const;

export const customBuildEstimateLabels: Record<
  (typeof customBuildEstimateStates)[number],
  string
> = {
  AUTOMATIC: "Automatic estimate",
  PARTIAL: "Partial estimate",
  MANUAL_REVIEW_REQUIRED: "Manual review required",
  UNAVAILABLE: "Unavailable",
};

export const customBuildPublicStatusLabels: Record<
  (typeof customBuildRequestStatuses)[number],
  string
> = {
  SUBMITTED: "Request received",
  UNDER_REVIEW: "Under review",
  NEEDS_CUSTOMER_INFORMATION: "More information needed",
  ESTIMATE_PROVIDED: "Estimate provided",
  QUOTE_DRAFT: "Quote being prepared",
  QUOTE_SENT: "Quote sent",
  QUOTE_ACCEPTED: "Quote accepted",
  QUOTE_DECLINED: "Quote declined",
  QUOTE_EXPIRED: "Quote expired",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const customBuildQuoteStatusLabels: Record<
  (typeof customBuildQuoteStatuses)[number],
  string
> = {
  DRAFT: "Draft",
  SENT: "Sent",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  EXPIRED: "Expired",
  VOID: "Void",
};

export const customBuildSkillLabels = {
  ATTACK: "Attack",
  STRENGTH: "Strength",
  DEFENCE: "Defence",
  RANGED: "Ranged",
  PRAYER: "Prayer",
  MAGIC: "Magic",
  RUNECRAFT: "Runecraft",
  CONSTRUCTION: "Construction",
  HITPOINTS: "Hitpoints",
  AGILITY: "Agility",
  HERBLORE: "Herblore",
  THIEVING: "Thieving",
  CRAFTING: "Crafting",
  FLETCHING: "Fletching",
  SLAYER: "Slayer",
  HUNTER: "Hunter",
  MINING: "Mining",
  SMITHING: "Smithing",
  FISHING: "Fishing",
  COOKING: "Cooking",
  FIREMAKING: "Firemaking",
  WOODCUTTING: "Woodcutting",
  FARMING: "Farming",
} as const;

export const allowedCustomBuildAttachmentMimes = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
] as const;

export const CUSTOM_BUILD_PRIVATE_ATTACHMENT_ENV =
  "CUSTOM_BUILD_PRIVATE_ATTACHMENT_ROOT";

export const DEFAULT_CUSTOM_BUILD_PRIVATE_ATTACHMENT_ROOT =
  "storage/private/custom-build-attachments";
