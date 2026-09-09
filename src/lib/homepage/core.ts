import { z } from "zod";

export const homepagePlacements = [
  "MAIN_CATEGORY",
  "MAIN_SERVICE",
  "FEATURED_SERVICE",
] as const;
export const homepageSourceTypes = [
  "SERVICE",
  "PRODUCT",
  "ACCOUNT",
  "GOLD",
  "CUSTOM_BUILD",
  "MANUAL_PROMO",
] as const;
export const homepagePriceModes = ["AUTO", "OVERRIDE", "HIDE"] as const;
export const homepageViewAllLinks = {
  services: "/services",
  accounts: "/accounts",
  products: "/products",
  gold: "/gold",
} as const;

export type HomepagePlacement = (typeof homepagePlacements)[number];
export type HomepageSourceType = (typeof homepageSourceTypes)[number];
export type HomepagePriceMode = (typeof homepagePriceModes)[number];

export type HomepageSchedule = {
  isActive: boolean;
  startsAt: Date | null;
  expiresAt: Date | null;
  archivedAt: Date | null;
};

export type HomepageCard = {
  id: string;
  placement: HomepagePlacement;
  sourceType: HomepageSourceType;
  title: string;
  description: string;
  badge: string | null;
  badgeStyle: string | null;
  bullets: string[];
  imagePath: string | null;
  imageAltText: string;
  ctaText: string;
  href: string;
  priceLabel: string | null;
  oldPriceLabel: string | null;
  categoryLabel: string | null;
  displayOrder: number;
};

export const defaultHomepageSections = [
  {
    sectionKey: "main-categories",
    title: "What Can We Do For You?",
    enabled: true,
    itemLimit: 5,
    displayOrder: 10,
  },
  {
    sectionKey: "main-services",
    title: "Our Main Services",
    enabled: true,
    itemLimit: 7,
    displayOrder: 20,
  },
  {
    sectionKey: "featured-services",
    title: "Featured Services",
    enabled: true,
    itemLimit: 4,
    displayOrder: 30,
  },
] as const;

const fallbackHomepageRows: ReadonlyArray<
  readonly [string, HomepagePlacement, string, string, string, string, string]
> = [
  [
    "accounts",
    "MAIN_CATEGORY",
    "Accounts",
    "Account marketplace and custom account builds.",
    "/accounts",
    "View Accounts",
    "Marketplace",
  ],
  [
    "gold",
    "MAIN_CATEGORY",
    "Gold / Items",
    "Get the gold or items you need quickly and safely.",
    "/gold",
    "Buy Gold",
    "Marketplace",
  ],
  [
    "power",
    "MAIN_CATEGORY",
    "Powerleveling",
    "Level your skills with fast, efficient methods.",
    "/skills",
    "View Powerleveling",
    "Services",
  ],
  [
    "pvm",
    "MAIN_CATEGORY",
    "PVMing",
    "Bossing, raids and more with experienced teams.",
    "/bossing",
    "View PVM Services",
    "Services",
  ],
  [
    "misc-gathering",
    "MAIN_CATEGORY",
    "Misc Gathering",
    "Configure resource and gathering services by quantity.",
    "/misc-gathering",
    "View Gathering",
    "Services",
  ],
  [
    "inferno",
    "MAIN_SERVICE",
    "Inferno",
    "",
    "/infernal",
    "View Inferno",
    "PvM",
  ],
  ["quiver", "MAIN_SERVICE", "Quiver", "", "/services", "View Quiver", "PvM"],
  ["bossing", "MAIN_SERVICE", "Bossing", "", "/bossing", "View Bossing", "PvM"],
  ["raids", "MAIN_SERVICE", "Raids", "", "/bossing", "View Raids", "PvM"],
  [
    "skills",
    "MAIN_SERVICE",
    "Skills",
    "",
    "/skills",
    "View Skills",
    "Skilling",
  ],
  [
    "quests",
    "MAIN_SERVICE",
    "Quests",
    "",
    "/quests",
    "View Quests",
    "Questing",
  ],
  [
    "diaries",
    "MAIN_SERVICE",
    "Diaries",
    "",
    "/diaries",
    "View Diaries",
    "Diaries",
  ],
  [
    "feat-inferno",
    "FEATURED_SERVICE",
    "Inferno Cape Service",
    "A tailored Inferno service with requirements reviewed before scheduling.",
    "/infernal",
    "Configure",
    "PvM",
  ],
  [
    "feat-gauntlet",
    "FEATURED_SERVICE",
    "Corrupted Gauntlet",
    "Configure a clear Gauntlet service scope for your account.",
    "/bossing",
    "View Service",
    "PvM",
  ],
  [
    "feat-zulrah",
    "FEATURED_SERVICE",
    "Zulrah Kills",
    "Plan a Zulrah kill package with account requirements checked first.",
    "/bossing",
    "Configure",
    "Bossing",
  ],
  [
    "feat-raids",
    "FEATURED_SERVICE",
    "Raids Services",
    "Explore raid support options and request a tailored configuration.",
    "/bossing",
    "View Raids",
    "Raids",
  ],
];

export const fallbackHomepageCards: HomepageCard[] = fallbackHomepageRows.map(
  (
    [id, placement, title, description, href, ctaText, categoryLabel],
    index,
  ) => ({
    id,
    placement: placement as HomepagePlacement,
    sourceType: "MANUAL_PROMO",
    title,
    description,
    badge:
      id === "feat-inferno"
        ? "Best Seller"
        : id === "feat-gauntlet"
          ? "Hot"
          : id === "feat-raids"
            ? "New"
            : null,
    badgeStyle: null,
    bullets:
      placement === "FEATURED_SERVICE"
        ? ["100% hand played", "Clear requirements", "Secure support"]
        : [],
    imagePath: "/artwork/osrs-reference-board.jpeg",
    imageAltText: `${title} fantasy artwork`,
    ctaText,
    href,
    priceLabel: null,
    oldPriceLabel: null,
    categoryLabel,
    displayOrder: index * 10,
  }),
);

export function isHomepageItemActive(item: HomepageSchedule, now = new Date()) {
  return (
    item.isActive &&
    item.archivedAt == null &&
    (item.startsAt == null || item.startsAt <= now) &&
    (item.expiresAt == null || item.expiresAt > now)
  );
}

export function selectHomepageItems<
  T extends HomepageSchedule & {
    placement: HomepagePlacement;
    displayOrder: number;
  },
>(
  items: readonly T[],
  placement: HomepagePlacement,
  limit: number,
  now = new Date(),
) {
  return items
    .filter(
      (item) => item.placement === placement && isHomepageItemActive(item, now),
    )
    .sort((left, right) => left.displayOrder - right.displayOrder)
    .slice(0, Math.max(0, limit));
}

export function safeHomepageHref(value: string | null | undefined) {
  const href = value?.trim();
  if (!href) return "/services";
  if (href.startsWith("/") && !href.startsWith("//")) return href;
  if (/^https:\/\//i.test(href)) return href;
  return "/services";
}

export function parseBulletPoints(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 5);
}

export function formatHomepagePrice(cents: number | null | undefined) {
  if (cents == null || cents < 0) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(cents / 100);
}

const optionalText = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

export const homepageItemInputSchema = z
  .object({
    id: optionalText(30),
    placement: z.enum(homepagePlacements),
    sourceType: z.enum(homepageSourceTypes),
    linkedRecordId: optionalText(30),
    titleOverride: optionalText(180),
    descriptionOverride: optionalText(500),
    badgeText: optionalText(80),
    badgeStyle: optionalText(40),
    bulletPoints: z
      .string()
      .max(1000)
      .optional()
      .transform((value) =>
        (value ?? "")
          .split(/\r?\n/)
          .map((item) => item.trim())
          .filter(Boolean)
          .slice(0, 5),
      ),
    imagePath: optionalText(500),
    imageAltText: optionalText(240),
    ctaText: optionalText(80),
    ctaUrl: optionalText(500),
    priceMode: z.enum(homepagePriceModes),
    promotionalPriceCents: z.coerce.number().int().min(0).optional(),
    oldPriceCents: z.coerce.number().int().min(0).optional(),
    categoryLabel: optionalText(120),
    displayOrder: z.coerce.number().int().min(0).max(10000),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    startsAt: optionalText(40),
    expiresAt: optionalText(40),
    concurrencyVersion: z.coerce.number().int().min(1).optional(),
  })
  .superRefine((value, context) => {
    if (value.sourceType === "MANUAL_PROMO" && !value.titleOverride) {
      context.addIssue({
        code: "custom",
        path: ["titleOverride"],
        message: "Manual promotions require a title.",
      });
    }
    if (value.sourceType !== "MANUAL_PROMO" && !value.linkedRecordId) {
      context.addIssue({
        code: "custom",
        path: ["linkedRecordId"],
        message: "Select a linked record.",
      });
    }
    if (value.priceMode === "OVERRIDE" && value.promotionalPriceCents == null) {
      context.addIssue({
        code: "custom",
        path: ["promotionalPriceCents"],
        message: "An override price is required.",
      });
    }
  });

export const homepageSectionInputSchema = z.object({
  id: z.string().trim().min(1).max(30),
  title: z.string().trim().min(1).max(160),
  enabled: z.boolean(),
  itemLimit: z.coerce.number().int().min(1).max(12),
  displayOrder: z.coerce.number().int().min(0).max(1000),
  concurrencyVersion: z.coerce.number().int().min(1),
});
