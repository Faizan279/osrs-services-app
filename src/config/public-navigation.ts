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
    href: "/services/power-levelling",
    description: "Structured training paths for individual skills.",
  },
  {
    label: "Questing",
    href: "/services/quests",
    description: "Quest support planned around your account.",
  },
  {
    label: "Achievement diaries",
    href: "/services/achievement-diaries",
    description: "Region-by-region diary progression support.",
  },
  {
    label: "Minigames",
    href: "/services/minigames",
    description: "Focused help for rewards and unlocks.",
  },
  {
    label: "Bossing and PvM",
    href: "/services/bossing-pvm",
    description: "Configurable PvM and encounter assistance.",
  },
  {
    label: "Gold and items",
    href: "/products",
    description: "Published item, bond and outfit marketplace listings.",
  },
  {
    label: "Membership and bonds",
    href: "/#membership-service",
    description: "Future membership and bond service options.",
  },
  {
    label: "Accounts",
    href: "/accounts",
    description: "Published account listings and availability states.",
  },
  {
    label: "Custom builds",
    href: "/custom-account-build",
    description: "Configure desired account stats, quests and unlocks.",
  },
] satisfies readonly ServiceNavigationItem[];

export const primaryNavigation = [
  { label: "Gold", href: "/#gold-service" },
  { label: "Products", href: "/products" },
  { label: "Accounts", href: "/accounts" },
  { label: "Custom Build", href: "/custom-account-build" },
  { label: "Membership", href: "/#membership-service" },
  { label: "Help", href: "/#faq" },
  { label: "Support", href: "/support" },
] satisfies readonly PublicLink[];

// Reintroduce this item only when verified reviews and a genuine destination exist.
export const deferredPrimaryNavigation = [
  { label: "Reviews", href: "/#reviews" },
] satisfies readonly PublicLink[];

export const footerNavigation = {
  services: [
    { label: "All services", href: "/services" },
    { label: "Power levelling", href: "/services/power-levelling" },
    { label: "Questing", href: "/services/quests" },
    { label: "Bossing and PvM", href: "/services/bossing-pvm" },
    { label: "Gold", href: "/#gold-service" },
    { label: "Products", href: "/products" },
  ],
  marketplace: [
    { label: "Gold and items", href: "/#gold-service" },
    { label: "Products", href: "/products" },
    { label: "Accounts", href: "/accounts" },
    { label: "Custom account build", href: "/custom-account-build" },
    { label: "Membership and bonds", href: "/#membership-service" },
    { label: "Estimate preview", href: "/#calculator-preview" },
  ],
  account: [
    { label: "My account", href: "/account" },
    { label: "Sign in", href: "/account/login" },
    { label: "Track an order", href: "/account" },
  ],
  help: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Security and privacy", href: "/#security" },
    { label: "Frequently asked questions", href: "/#faq" },
    { label: "Contact support", href: "/support" },
    { label: "Terms placeholder", href: "/#legal-note" },
    { label: "Privacy placeholder", href: "/#legal-note" },
  ],
} satisfies Record<string, readonly PublicLink[]>;

export const publicCtaLinks = {
  browseServices: "/services",
  account: "/account",
  getEstimate: "/#calculator-preview",
  search: "/services",
  support: "/support",
} as const;

export function getDiscordHref() {
  const configuredUrl = process.env.NEXT_PUBLIC_DISCORD_URL?.trim();
  return configuredUrl || publicCtaLinks.support;
}
