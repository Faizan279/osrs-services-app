export const premiumDeliverySpeeds = [
  "STANDARD",
  "PRIORITY",
  "EXPRESS",
] as const;

export type PremiumDeliverySpeed = (typeof premiumDeliverySpeeds)[number];

export const premiumDeliveryLabels: Record<PremiumDeliverySpeed, string> = {
  STANDARD: "Standard",
  PRIORITY: "Priority",
  EXPRESS: "Express",
};

export const premiumOptionTypes = [
  "ADDON",
  "SUPPLIES",
  "GEAR_SUPPORT",
  "UNLOCK_SUPPORT",
] as const;

export type PremiumOptionType = (typeof premiumOptionTypes)[number];

export const premiumOptionTypeLabels: Record<PremiumOptionType, string> = {
  ADDON: "Add-on",
  SUPPLIES: "Supplies",
  GEAR_SUPPORT: "Gear support",
  UNLOCK_SUPPORT: "Unlock support",
};

export const premiumOptionPricingModes = [
  "FIXED_FEE",
  "PERCENT_OF_BASE",
  "PER_UNIT",
] as const;

export type PremiumOptionPricingMode =
  (typeof premiumOptionPricingModes)[number];

export const premiumOptionPricingModeLabels: Record<
  PremiumOptionPricingMode,
  string
> = {
  FIXED_FEE: "Fixed fee",
  PERCENT_OF_BASE: "Percent of base",
  PER_UNIT: "Per unit",
};

export const premiumConfiguratorTypes = [
  "FIRE_CAPE",
  "INFERNAL_CAPE",
  "COLOSSEUM",
  "YAMA",
  "ROYAL_TITANS",
  "CORRUPTED_GAUNTLET",
  "DOOM_OF_MOKHAIOTL",
  "RAIDS",
  "CUSTOM",
] as const;

export type PremiumConfiguratorType = (typeof premiumConfiguratorTypes)[number];

export const premiumConfiguratorTypeLabels: Record<
  PremiumConfiguratorType,
  string
> = {
  FIRE_CAPE: "Fire Cape",
  INFERNAL_CAPE: "Infernal Cape",
  COLOSSEUM: "Colosseum",
  YAMA: "Yama",
  ROYAL_TITANS: "Royal Titans",
  CORRUPTED_GAUNTLET: "Corrupted Gauntlet",
  DOOM_OF_MOKHAIOTL: "Doom of Mokhaiotl",
  RAIDS: "Raids",
  CUSTOM: "Custom",
};

export const premiumRequirementTypes = [
  "SKILL",
  "QUEST",
  "ITEM",
  "ACTIVITY",
  "ACCOUNT",
  "GEAR",
  "UNLOCK",
  "OTHER",
] as const;

export type PremiumRequirementType = (typeof premiumRequirementTypes)[number];

export const premiumRequirementTypeLabels: Record<
  PremiumRequirementType,
  string
> = {
  SKILL: "Skill",
  QUEST: "Quest",
  ITEM: "Item",
  ACTIVITY: "Activity",
  ACCOUNT: "Account",
  GEAR: "Gear",
  UNLOCK: "Unlock",
  OTHER: "Other",
};

export const premiumPublicStatMetricKeys = [
  "skill.attack.level",
  "skill.strength.level",
  "skill.defence.level",
  "skill.ranged.level",
  "skill.prayer.level",
  "skill.magic.level",
  "skill.hitpoints.level",
  "total.level",
] as const;

export type PremiumPublicStatMetricKey =
  (typeof premiumPublicStatMetricKeys)[number];

export const premiumPublicStatLabels: Record<
  PremiumPublicStatMetricKey,
  string
> = {
  "skill.attack.level": "Attack level",
  "skill.strength.level": "Strength level",
  "skill.defence.level": "Defence level",
  "skill.ranged.level": "Ranged level",
  "skill.prayer.level": "Prayer level",
  "skill.magic.level": "Magic level",
  "skill.hitpoints.level": "Hitpoints level",
  "total.level": "Total level",
};
