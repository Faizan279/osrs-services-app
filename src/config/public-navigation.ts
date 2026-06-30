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
    label: "Skill training",
    href: "/#skill-training",
    description: "Account-aware training options and custom quotes.",
  },
] satisfies readonly ServiceNavigationItem[];

export const primaryNavigation = [
  { label: "Gold", href: "/#gold-service" },
  { label: "Accounts", href: "/#accounts-service" },
  { label: "Membership", href: "/#membership-service" },
  { label: "Reviews", href: "/#feedback" },
  { label: "Help", href: "/#faq" },
] satisfies readonly PublicLink[];

export const footerNavigation = {
  services: [
    { label: "Power levelling", href: "/#power-levelling" },
    { label: "Questing", href: "/#questing" },
    { label: "Bossing and PvM", href: "/#bossing-pvm" },
    { label: "Gold", href: "/#gold-service" },
  ],
  support: [
    { label: "How it works", href: "/#how-it-works" },
    { label: "Security and privacy", href: "/#security" },
    { label: "Frequently asked questions", href: "/#faq" },
    { label: "Contact support", href: "/#support" },
  ],
  account: [
    { label: "My account", href: "/account" },
    { label: "Sign in", href: "/login" },
    { label: "Order process", href: "/#how-it-works" },
  ],
  legal: [
    { label: "Terms placeholder", href: "/#legal-note" },
    { label: "Privacy placeholder", href: "/#legal-note" },
    { label: "Refund policy placeholder", href: "/#legal-note" },
  ],
} satisfies Record<string, readonly PublicLink[]>;

export const publicCtaLinks = {
  browseServices: "/#service-categories",
  account: "/account",
  support: "/#support",
} as const;

export function getDiscordHref() {
  const configuredUrl = process.env.NEXT_PUBLIC_DISCORD_URL?.trim();
  return configuredUrl || publicCtaLinks.support;
}
