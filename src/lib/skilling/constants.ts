export const skillingSkillKeys = [
  "ATTACK",
  "STRENGTH",
  "DEFENCE",
  "RANGED",
  "PRAYER",
  "MAGIC",
  "RUNECRAFT",
  "CONSTRUCTION",
  "HITPOINTS",
  "AGILITY",
  "HERBLORE",
  "THIEVING",
  "CRAFTING",
  "FLETCHING",
  "SLAYER",
  "HUNTER",
  "MINING",
  "SMITHING",
  "FISHING",
  "COOKING",
  "FIREMAKING",
  "WOODCUTTING",
  "FARMING",
] as const;

export type SkillingSkillKey = (typeof skillingSkillKeys)[number];

export const skillingSkillLabels: Record<SkillingSkillKey, string> = {
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
};

export const skillingDeliverySpeeds = [
  "STANDARD",
  "PRIORITY",
  "EXPRESS",
] as const;

export type SkillingDeliverySpeed = (typeof skillingDeliverySpeeds)[number];

export const skillingDeliveryLabels: Record<SkillingDeliverySpeed, string> = {
  STANDARD: "Standard",
  PRIORITY: "Priority",
  EXPRESS: "Express",
};

export const skillingInputModes = ["LEVEL", "XP"] as const;

export type SkillingInputMode = (typeof skillingInputModes)[number];

export const MAX_SKILLING_XP = 200_000_000;
export const SKILLING_MAX_LEVEL = 99;
export const SKILLING_MIN_LEVEL = 1;
