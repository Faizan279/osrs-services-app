import type { PublicStatsProfile } from "@/lib/eligibility/profile";

export const skillMetricNames = [
  "attack",
  "defence",
  "strength",
  "hitpoints",
  "ranged",
  "prayer",
  "magic",
  "cooking",
  "woodcutting",
  "fletching",
  "fishing",
  "firemaking",
  "crafting",
  "smithing",
  "mining",
  "herblore",
  "agility",
  "thieving",
  "slayer",
  "farming",
  "runecraft",
  "hunter",
  "construction",
] as const;

const title = (value: string) => value.charAt(0).toUpperCase() + value.slice(1);

export const metricRegistry = new Map<string, string>([
  ["total.level", "Total level"],
  ["total.xp", "Total XP"],
  ...skillMetricNames.flatMap((skill) => [
    [`skill.${skill}.level`, `${title(skill)} level`] as const,
    [`skill.${skill}.xp`, `${title(skill)} XP`] as const,
  ]),
]);

export function isAllowedMetricKey(value: string | null | undefined) {
  return Boolean(value && metricRegistry.has(value));
}

export function metricValue(
  profile: PublicStatsProfile,
  key: string,
): number | undefined {
  if (!metricRegistry.has(key)) return undefined;
  if (key === "total.level") return profile.totalLevel;
  if (key === "total.xp") return profile.totalXp;
  const [, skill, kind] = key.split(".");
  if (!skill) return undefined;
  return kind === "level" ? profile.skillLevels[skill] : profile.skillXp[skill];
}
