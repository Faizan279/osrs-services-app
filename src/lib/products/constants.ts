export const PRODUCT_MARKETPLACE_FEATURE_FLAG = "product_marketplace_enabled";

export const PRODUCT_REVISION_SCHEMA_VERSION = 1;
export const PRODUCT_ESTIMATE_SNAPSHOT_SCHEMA_VERSION = 1;

export const productTypes = ["ITEM", "BOND", "OUTFIT"] as const;

export const productPublicationStatuses = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export const productAvailabilityStates = [
  "AVAILABLE",
  "LOW_STOCK",
  "OUT_OF_STOCK",
  "MANUAL_REVIEW_REQUIRED",
  "PAUSED",
  "UNAVAILABLE",
] as const;

export const productStockModes = [
  "TRACKED",
  "UNLIMITED",
  "MANUAL_REVIEW",
] as const;

export const productInventoryEntryTypes = [
  "STOCK_IN",
  "STOCK_OUT",
  "CORRECTION_IN",
  "CORRECTION_OUT",
  "INITIAL_BALANCE",
] as const;

export const productReservationStatuses = [
  "ACTIVE",
  "RELEASED",
  "EXPIRED",
  "CANCELLED",
] as const;

export const productImageTypes = ["COVER", "GALLERY", "PACKAGE"] as const;

export const productPriceModes = [
  "FIXED_UNIT",
  "QUANTITY_TIER",
  "FIXED_PACKAGE",
  "MANUAL_REVIEW",
] as const;

export const productVariantStatuses = [
  "AVAILABLE",
  "PAUSED",
  "UNAVAILABLE",
] as const;

export const productSortOptions = [
  "featured",
  "newest",
  "price_asc",
  "price_desc",
  "name_asc",
] as const;

export const productTypeLabels: Record<(typeof productTypes)[number], string> =
  {
    ITEM: "Items",
    BOND: "Bonds",
    OUTFIT: "Outfits",
  };

export const productAvailabilityLabels: Record<
  (typeof productAvailabilityStates)[number],
  string
> = {
  AVAILABLE: "Available",
  LOW_STOCK: "Low stock",
  OUT_OF_STOCK: "Out of stock",
  MANUAL_REVIEW_REQUIRED: "Manual review required",
  PAUSED: "Paused",
  UNAVAILABLE: "Unavailable",
};

export const productPriceModeLabels: Record<
  (typeof productPriceModes)[number],
  string
> = {
  FIXED_UNIT: "Fixed unit",
  QUANTITY_TIER: "Quantity tier",
  FIXED_PACKAGE: "Fixed package",
  MANUAL_REVIEW: "Manual review",
};

export const productStockModeLabels: Record<
  (typeof productStockModes)[number],
  string
> = {
  TRACKED: "Tracked",
  UNLIMITED: "Unlimited",
  MANUAL_REVIEW: "Manual review",
};

export const productSortLabels: Record<
  (typeof productSortOptions)[number],
  string
> = {
  featured: "Featured",
  newest: "Newest published",
  price_asc: "Price low to high",
  price_desc: "Price high to low",
  name_asc: "Name A to Z",
};
