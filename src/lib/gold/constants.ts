export const GOLD_ENGINE_FEATURE_FLAG = "gold_engine_enabled";
export const GOLD_REVISION_SCHEMA_VERSION = 1;
export const GOLD_ESTIMATE_SNAPSHOT_SCHEMA_VERSION = 1;

export const goldTradeDirections = [
  "CUSTOMER_BUYS_GOLD",
  "CUSTOMER_SELLS_GOLD",
] as const;

export const goldRateSetStatuses = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;

export const goldInventoryEntryTypes = [
  "STOCK_INCREASE",
  "STOCK_DECREASE",
  "BUY_CAPACITY_INCREASE",
  "BUY_CAPACITY_DECREASE",
  "CORRECTION",
] as const;

export const goldAvailabilityStates = [
  "AVAILABLE",
  "LIMITED_AVAILABILITY",
  "MANUAL_REVIEW_REQUIRED",
  "PAUSED",
  "UNAVAILABLE",
] as const;

export const goldSecureServicePricingModes = [
  "DISABLED",
  "FIXED_MINOR_UNITS",
  "BASIS_POINTS",
] as const;

export const goldTradeDirectionLabels: Record<
  (typeof goldTradeDirections)[number],
  string
> = {
  CUSTOMER_BUYS_GOLD: "Buy Gold",
  CUSTOMER_SELLS_GOLD: "Sell Gold",
};

export const goldTradeDirectionDescriptions: Record<
  (typeof goldTradeDirections)[number],
  string
> = {
  CUSTOMER_BUYS_GOLD:
    "The business sells gold to the customer and must have enough stock.",
  CUSTOMER_SELLS_GOLD:
    "The business buys gold from the customer and must have enough buying capacity.",
};

export const goldInventoryEntryTypeLabels: Record<
  (typeof goldInventoryEntryTypes)[number],
  string
> = {
  STOCK_INCREASE: "Stock increase",
  STOCK_DECREASE: "Stock decrease",
  BUY_CAPACITY_INCREASE: "Buying capacity increase",
  BUY_CAPACITY_DECREASE: "Buying capacity decrease",
  CORRECTION: "Inventory correction",
};

export const goldAvailabilityLabels: Record<
  (typeof goldAvailabilityStates)[number],
  string
> = {
  AVAILABLE: "Available",
  LIMITED_AVAILABILITY: "Limited availability",
  MANUAL_REVIEW_REQUIRED: "Manual review required",
  PAUSED: "Paused",
  UNAVAILABLE: "Currently unavailable",
};
