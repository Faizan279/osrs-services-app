export type HomepageCategoryIcon =
  | "activity"
  | "badge"
  | "coins"
  | "crown"
  | "flag"
  | "map"
  | "scroll"
  | "swords";

export type HomepageCategory = {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: HomepageCategoryIcon;
  treatment: "feature" | "standard" | "compact";
};

export const homepageCategories = [
  {
    id: "power-levelling",
    title: "Power levelling",
    description:
      "Shape a skill-training request around your current level, target and preferred approach.",
    href: "/#featured-services",
    icon: "activity",
    treatment: "feature",
  },
  {
    id: "questing",
    title: "Questing",
    description:
      "Plan individual quests or a broader progression route with requirements reviewed first.",
    href: "/#featured-services",
    icon: "scroll",
    treatment: "feature",
  },
  {
    id: "achievement-diaries",
    title: "Achievement diaries",
    description:
      "Organise diary progress by region, tier and the prerequisites your account still needs.",
    href: "/#featured-services",
    icon: "map",
    treatment: "standard",
  },
  {
    id: "minigames",
    title: "Minigames",
    description:
      "Request support for selected rewards, points and account unlocks.",
    href: "/#featured-services",
    icon: "flag",
    treatment: "compact",
  },
  {
    id: "bossing-pvm",
    title: "Bossing and PvM",
    description:
      "Explore encounter support with account requirements and service scope made clear.",
    href: "/#featured-services",
    icon: "swords",
    treatment: "standard",
  },
  {
    id: "gold-service",
    title: "Gold and items",
    description:
      "A preview of the planned buy-and-sell flow; live rates and stock arrive in a later task.",
    href: "/#support",
    icon: "coins",
    treatment: "compact",
  },
  {
    id: "membership-service",
    title: "Membership and bonds",
    description:
      "Review the future membership and bonds service area without invented launch pricing.",
    href: "/#support",
    icon: "crown",
    treatment: "standard",
  },
  {
    id: "accounts-service",
    title: "Accounts",
    description:
      "Learn about the planned account marketplace and custom-build request path.",
    href: "/#support",
    icon: "badge",
    treatment: "standard",
  },
] satisfies readonly HomepageCategory[];

export type FeaturedService = {
  name: string;
  category: string;
  summary: string;
  price: string;
  delivery: string;
  href: string;
  label: string;
  modes: readonly string[];
};

export const featuredServices = [
  {
    name: "Skill training request",
    category: "Power levelling",
    summary:
      "Choose a skill goal and prepare the account details needed for a tailored service scope.",
    price: "Custom quote",
    delivery: "Schedule confirmed after review",
    href: "/#support",
    label: "Plan a request",
    modes: ["Normal", "Ironman", "HCIM", "UIM"],
  },
  {
    name: "Quest progression",
    category: "Questing",
    summary:
      "Build a quest shortlist and review prerequisites before the order is configured.",
    price: "Estimate after configuration",
    delivery: "Requirements reviewed first",
    href: "/#support",
    label: "Explore questing",
    modes: ["Normal", "Ironman"],
  },
  {
    name: "PvM support",
    category: "Bossing and PvM",
    summary:
      "Start with the encounter, account mode and relevant requirements for a clear quote.",
    price: "Custom quote",
    delivery: "Scope agreed before scheduling",
    href: "/#support",
    label: "Discuss PvM",
    modes: ["Normal", "Ironman", "HCIM"],
  },
  {
    name: "Diary progression",
    category: "Achievement diaries",
    summary:
      "Organise region and tier goals while keeping missing skills and quests visible.",
    price: "Estimate after configuration",
    delivery: "Plan confirmed after review",
    href: "/#support",
    label: "View diary options",
    modes: ["Normal", "Ironman"],
  },
] satisfies readonly FeaturedService[];

export const processBenefits = [
  {
    title: "Clear order communication",
    description:
      "Keep the service scope, requirements and next action understandable from the start.",
  },
  {
    title: "Progress visibility",
    description:
      "Follow the planned order state and meaningful milestones from one consistent place.",
  },
  {
    title: "Privacy-conscious handling",
    description:
      "Account and order information is limited to the people and steps that require it.",
  },
] as const;

export const orderSteps = [
  {
    number: "01",
    title: "Select a service",
    description:
      "Choose a category and the type of progress you want help with.",
  },
  {
    number: "02",
    title: "Configure the order",
    description:
      "Share the account mode, targets and relevant requirements for review.",
  },
  {
    number: "03",
    title: "Confirm securely",
    description:
      "Review the scope and use the agreed communication path before work begins.",
  },
  {
    number: "04",
    title: "Track completion",
    description:
      "Follow order status and stay connected as the service progresses.",
  },
] as const;

export type MarketplaceSearchItem = {
  label: string;
  description: string;
  href: string;
  keywords: readonly string[];
};

export const marketplaceSearchItems = [
  {
    label: "Questing",
    description: "Individual quests and planned progression routes",
    href: "/#questing",
    keywords: ["quests", "quest", "requirements"],
  },
  {
    label: "Power levelling",
    description: "Skill targets and training requests",
    href: "/#power-levelling",
    keywords: ["skills", "skilling", "levels", "xp"],
  },
  {
    label: "Raids and bossing",
    description: "PvM encounters and configurable support",
    href: "/#bossing-pvm",
    keywords: ["raids", "bosses", "pvm", "combat"],
  },
  {
    label: "Gold and items",
    description: "Planned marketplace flows for gold and items",
    href: "/#gold-service",
    keywords: ["gold", "gp", "items"],
  },
  {
    label: "Achievement diaries",
    description: "Region and tier progression planning",
    href: "/#achievement-diaries",
    keywords: ["diaries", "diary", "regions"],
  },
  {
    label: "Account services",
    description: "Marketplace and custom account-build requests",
    href: "/#accounts-service",
    keywords: ["accounts", "builds", "account"],
  },
] satisfies readonly MarketplaceSearchItem[];

export const expertiseAreas = [
  {
    title: "Quest specialists",
    description: "Quest paths, prerequisites and account-aware progression.",
    icon: "scroll",
  },
  {
    title: "PvM specialists",
    description: "Bossing, raids and encounter-focused service planning.",
    icon: "swords",
  },
  {
    title: "Skilling specialists",
    description: "Level, XP and method-based training requests.",
    icon: "activity",
  },
  {
    title: "Account-service support",
    description: "Account marketplace and custom-build request guidance.",
    icon: "badge",
  },
] satisfies ReadonlyArray<{
  title: string;
  description: string;
  icon: HomepageCategoryIcon;
}>;

// Development-safe preview content only. This is not a real customer order.
export const orderTrackingPreview = {
  demo: true,
  title: "Milestone service plan",
  category: "Questing and progression",
  status: "In progress",
  progress: 64,
  activity: "Secure message available",
  nextMilestone: "Requirement review",
} as const;

export type FeedbackPreview = {
  context: string;
  quote: string;
  attribution: string;
  demo: true;
};

// Development-only content. Replace every entry with client-approved feedback before launch.
export const feedbackPreviews = [
  {
    context: "Quest service layout preview",
    quote:
      "Approved customer feedback will appear here once the client supplies launch-ready review content.",
    attribution: "Demo content — not a customer review",
    demo: true,
  },
  {
    context: "Support experience layout preview",
    quote:
      "This card demonstrates the intended reading rhythm without inventing a customer, rating or claim.",
    attribution: "Demo content — not a customer review",
    demo: true,
  },
  {
    context: "Service progress layout preview",
    quote:
      "The finished section can hold concise, verified feedback while keeping its source clearly identified.",
    attribution: "Demo content — not a customer review",
    demo: true,
  },
] satisfies readonly FeedbackPreview[];

export type FaqItem = {
  question: string;
  answer: string;
};

export const homepageFaqs = [
  {
    question: "How does an OSRS Services order work?",
    answer:
      "Start by choosing a service area and sharing the details needed to understand your goal. The scope, requirements and price are reviewed before the service is confirmed. Full ordering and checkout tools will be introduced in a later project task.",
  },
  {
    question: "What information will I need to provide?",
    answer:
      "That depends on the service. Typical details include your account mode, current progress, target and relevant unlocks or requirements. You should never provide a RuneScape password for a public eligibility lookup.",
  },
  {
    question: "How will we communicate during an order?",
    answer:
      "The planned workflow keeps order updates and support communication connected to the request. A configurable Discord contact option may also be offered where appropriate; no unverified invitation link is published here.",
  },
  {
    question: "Which game modes can be supported?",
    answer:
      "The platform is being designed to represent normal, Ironman, Hardcore Ironman and Ultimate Ironman requirements. Availability and scope can vary by service and must be confirmed before ordering.",
  },
  {
    question: "How is account security approached?",
    answer:
      "The service workflow is designed around limited access, privacy-conscious communication and permission-aware staff operations. Only information necessary for the agreed service should be shared through the approved order process.",
  },
  {
    question: "What happens when a service needs a custom quote?",
    answer:
      "A custom quote allows the team to review the account state, goal and service complexity before presenting a scope. It avoids displaying invented or unsuitable fixed pricing on the homepage.",
  },
] satisfies readonly FaqItem[];
