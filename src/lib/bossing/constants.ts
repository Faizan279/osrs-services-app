export const bossingKillModes = ["DIRECT", "TARGET_KC"] as const;

export type BossingKillMode = (typeof bossingKillModes)[number];

export const bossingDeliverySpeeds = [
  "STANDARD",
  "PRIORITY",
  "EXPRESS",
] as const;

export type BossingDeliverySpeed = (typeof bossingDeliverySpeeds)[number];

export const bossingDeliveryLabels: Record<BossingDeliverySpeed, string> = {
  STANDARD: "Standard",
  PRIORITY: "Priority",
  EXPRESS: "Express",
};

export const bossingPriceModes = ["PER_KILL", "FIXED_PACKAGE"] as const;

export type BossingPriceMode = (typeof bossingPriceModes)[number];

export const bossingPriceModeLabels: Record<BossingPriceMode, string> = {
  PER_KILL: "Per kill",
  FIXED_PACKAGE: "Fixed package",
};

export const bossingPublicStatMetricKeys = [
  "skill.attack.level",
  "skill.strength.level",
  "skill.defence.level",
  "skill.ranged.level",
  "skill.prayer.level",
  "skill.magic.level",
  "skill.hitpoints.level",
  "total.level",
] as const;

export type BossingPublicStatMetricKey =
  (typeof bossingPublicStatMetricKeys)[number];

export const bossingPublicStatLabels: Record<
  BossingPublicStatMetricKey,
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
