export const directCategoryRoutes = {
  pvm: "/bossing",
  bossing: "/bossing",
  raids: "/bossing",
  "bossing-pvm": "/bossing",
  skills: "/skills",
  "power-levelling": "/skills",
  quests: "/quests",
  diaries: "/diaries",
  "achievement-diaries": "/diaries",
  gold: "/gold",
  "premium-services": "/infernal",
  "ironman-gathering": "/misc-gathering",
} as const satisfies Record<string, string>;

export const directServiceRoutes = {
  "skill-training-request": "/skills",
  "quest-progression": "/quests",
  "diary-progression": "/diaries",
  "pvm-support": "/bossing",
  "gold-trading": "/gold",
  "infernal-cape-service": "/infernal",
  "ironman-gathering-support": "/misc-gathering",
} as const satisfies Record<string, string>;

export function directCategoryDestination(slug: string) {
  return (
    directCategoryRoutes[slug as keyof typeof directCategoryRoutes] ?? null
  );
}

export function directServiceDestination(slug: string) {
  return directServiceRoutes[slug as keyof typeof directServiceRoutes] ?? null;
}
