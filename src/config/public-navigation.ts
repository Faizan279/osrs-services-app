export type PublicLink = {
  label: string;
  href: string;
};

export type ServiceNavigationItem = PublicLink & {
  description: string;
};

export const serviceNavigation = [
  {
    label: "Power levelling",
    href: "/#power-levelling",
    description: "Structured training paths for individual skills.",
  },
  {
    label: "Questing",
    href: "/#questing",
    description: "Quest support planned around your account.",
  },
  {
    label: "Achievement diaries",
    href: "/#achievement-diaries",
    description: "Region-by-region diary progression support.",
  },
  {
    label: "Minigames",
    href: "/#minigames",
    description: "Focused help for rewards and unlocks.",
  },
  {
    label: "Bossing and PvM",
    href: "/#bossing-pvm",
    description: "Configurable PvM and encounter assistance.",
  },
  {
    label: "Gold and items",
    href: "/#gold-service",
    description: "Planned gold, item and marketplace flows.",
  },
  {
    label: "Membership and bonds",
    href: "/#membership-service",
    description: "Future membership and bond service options.",
  },
  {
    label: "Accounts",
    href: "/#accounts-service",
    description: "Marketplace and custom account-build requests.",
  },
] satisfies readonly ServiceNavigationItem[];

export const primaryNavigation = [
  { label: "Gold", href: "/#gold-service" },
  { label: "Accounts", href: "/#accounts-service" },
  { label: "Membership", href: "/#membership-service" },
  { label: "Help", href: "/#faq" },
] satisfies readonly PublicLink[];

// Reintroduce this item only when verified reviews and a genuine destination exist.
export const deferredPrimaryNavigation = [
  { label: "Reviews", href: "/#reviews" },
] satisfies readonly PublicLink[];

export const footerNavigation = {
  services: [
    { label: "Power levelling", href: "/#power-levelling" },
    { label: "Questing", href: "/#questing" },
    { label: "Bossing and PvM", href: "/#bossing-pvm" },
    { label: "Gold", href: "/#gold-service" },
  ],
  marketplace: [
    { label: "Gold and items", href: "/#gold-service" },
    { label: "Accounts", href: "/#accounts-service" },
    { label: "Membership and bonds", href: "/#membership-service" },
    { label: "Estimate preview", href: "/#calculator-preview" },
  ],
  account: [
    { label: "My account", href: "/account" },
    { label: "Sign in", href: "/login" },
    { label: "Track an order", href: "/account" },
  ],
  help: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Security and privacy", href: "/#security" },
    { label: "Frequently asked questions", href: "/#faq" },
    { label: "Contact support", href: "/#support" },
    { label: "Terms placeholder", href: "/#legal-note" },
    { label: "Privacy placeholder", href: "/#legal-note" },
  ],
} satisfies Record<string, readonly PublicLink[]>;

export const publicCtaLinks = {
  browseServices: "/#service-categories",
  account: "/account",
  getEstimate: "/#calculator-preview",
  search: "/#marketplace-search",
  support: "/#support",
} as const;

export function getDiscordHref() {
  const configuredUrl = process.env.NEXT_PUBLIC_DISCORD_URL?.trim();
  return configuredUrl || publicCtaLinks.support;
}
