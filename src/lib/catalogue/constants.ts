export const catalogueEngineTypes = [
  "CATALOGUE_CARD",
  "SKILLING_CALCULATOR",
  "BOSSING_ENGINE",
  "PREMIUM_SERVICE_CONFIGURATOR",
  "GOLD_ENGINE",
  "ACCOUNT_MARKETPLACE",
  "CUSTOM_ACCOUNT_BUILD",
  "PRODUCT_MARKETPLACE",
] as const;

export const cataloguePublicationStatuses = [
  "DRAFT",
  "PUBLISHED",
  "ARCHIVED",
] as const;

export const catalogueAvailabilityStates = [
  "AVAILABLE",
  "PAUSED",
  "UNAVAILABLE",
] as const;

export const catalogueGameModes = [
  "NORMAL",
  "IRONMAN",
  "HARDCORE_IRONMAN",
  "ULTIMATE_IRONMAN",
] as const;

export const catalogueRequirementTypes = [
  "SKILL",
  "QUEST",
  "ITEM",
  "ACTIVITY",
  "ACCOUNT",
  "OTHER",
] as const;

export const requirementVerificationModes = [
  "AUTOMATIC",
  "CUSTOMER_CONFIRMED",
  "SUPPORT_VERIFIED",
] as const;

export const gameModeLabels: Record<
  (typeof catalogueGameModes)[number],
  string
> = {
  NORMAL: "Normal",
  IRONMAN: "Ironman",
  HARDCORE_IRONMAN: "Hardcore Ironman",
  ULTIMATE_IRONMAN: "Ultimate Ironman",
};

export const engineTypeLabels: Record<
  (typeof catalogueEngineTypes)[number],
  string
> = {
  CATALOGUE_CARD: "Catalogue card",
  SKILLING_CALCULATOR: "Skilling calculator",
  BOSSING_ENGINE: "Bossing engine",
  PREMIUM_SERVICE_CONFIGURATOR: "Premium service configurator",
  GOLD_ENGINE: "Gold engine",
  ACCOUNT_MARKETPLACE: "Account marketplace",
  CUSTOM_ACCOUNT_BUILD: "Custom account build",
  PRODUCT_MARKETPLACE: "Product marketplace",
};

export function formatEnumLabel(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
