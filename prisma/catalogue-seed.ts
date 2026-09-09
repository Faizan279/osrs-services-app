import {
  loadReferenceSnapshot,
  referenceRecords,
  requireReferenceRecord,
  slugify,
  stableKey,
  stableReferenceKey,
  type FirstSellerReferenceSnapshot,
  type ReferenceRecord,
} from "./reference-snapshot";

export type CatalogueSeedClient = {
  catalogueCategory: {
    upsert(args: {
      where: { seededKey: string };
      create: {
        seededKey: string;
        name: string;
        slug: string;
        shortDescription: string;
        description: string;
        iconKey: string;
        displayOrder: number;
        isActive: true;
        seoTitle: string;
        seoDescription: string;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  catalogueService: {
    upsert(args: {
      where: { seededKey: string };
      create: {
        seededKey: string;
        categoryId: string;
        name: string;
        slug: string;
        canonicalSlug: string;
        shortSummary: string;
        content: string;
        serviceType: "SERVICE";
        engineType:
          | "CATALOGUE_CARD"
          | "SKILLING_CALCULATOR"
          | "BOSSING_ENGINE"
          | "PREMIUM_SERVICE_CONFIGURATOR"
          | "GOLD_ENGINE";
        publicationStatus: "PUBLISHED";
        availabilityState: "AVAILABLE";
        isFeatured: boolean;
        isQuoteOnly: true;
        displayOrder: number;
        publicPreparationNotes: string;
        seoTitle: string;
        seoDescription: string;
        needsClientReview: true;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  catalogueServiceGameMode: {
    createMany(args: {
      data: Array<{
        serviceId: string;
        gameMode:
          "NORMAL" | "IRONMAN" | "HARDCORE_IRONMAN" | "ULTIMATE_IRONMAN";
      }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
  catalogueRequirement: {
    createMany(args: {
      data: Array<{
        seededKey: string;
        serviceId: string;
        title: string;
        description: string;
        type: "SKILL" | "QUEST" | "ACTIVITY" | "ACCOUNT";
        isRequired: boolean;
        displayOrder: number;
        verificationMode:
          "AUTOMATIC" | "CUSTOMER_CONFIRMED" | "SUPPORT_VERIFIED";
      }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
  catalogueOffering: {
    upsert(args: {
      where: { seededKey: string };
      create: {
        seededKey: string;
        serviceId: string;
        slug: string;
        name: string;
        shortSummary: string;
        description: string;
        displayOrder: number;
        isActive: true;
        isFeatured: boolean;
        needsClientReview: true;
        groupLabel?: string;
        tierLabel?: string;
        quantityEnabled: boolean;
        quantityUnit?: string;
        minimumQuantity?: number;
        maximumQuantity?: number;
        basePriceCents?: number;
        pricingUnit?: string;
        referenceSourceKey?: string;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  catalogueOfferingFacet: {
    createMany(args: {
      data: Array<{
        offeringId: string;
        facetKey: string;
        facetValue: string;
        label: string;
        displayOrder: number;
      }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
  catalogueOfferingGameMode: {
    createMany(args: {
      data: Array<{
        offeringId: string;
        gameMode:
          "NORMAL" | "IRONMAN" | "HARDCORE_IRONMAN" | "ULTIMATE_IRONMAN";
      }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
  catalogueOfferingRequirement: {
    createMany(args: {
      data: Array<{
        seededKey: string;
        offeringId: string;
        title: string;
        description: string;
        type: "SKILL" | "QUEST" | "ITEM" | "ACTIVITY" | "ACCOUNT" | "OTHER";
        isRequired: boolean;
        displayOrder: number;
        verificationMode: "CUSTOMER_CONFIRMED" | "SUPPORT_VERIFIED";
        customerGuidance: string;
      }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
  skillingCalculatorRule: {
    upsert(args: {
      where: { serviceId: string };
      create: SkillingRuleSeedCreate;
      update: Record<string, never>;
    }): Promise<unknown>;
  };
  skillingSkillConfig: {
    upsert(args: {
      where: { seededKey: string };
      create: {
        seededKey: string;
        serviceId: string;
        skillKey: SkillingSkillKey;
        name: string;
        enabled: boolean;
        displayOrder: number;
        iconKey: string;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  skillingTrainingMethod: {
    upsert(args: {
      where: { seededKey: string };
      create: {
        seededKey: string;
        serviceId: string;
        skillConfigId: string;
        slug: string;
        name: string;
        shortDescription: string;
        enabled: true;
        displayOrder: number;
        minimumLevel: number;
        maximumLevel: number;
        xpPerHour: number;
        basePriceCentsPerMillionXp: number;
        minimumPriceCents: number;
        fixedFeeCents: number;
        suppliesEnabled: boolean;
        suppliesLabel?: string;
        suppliesFeeCents: number;
        notes: string;
        needsClientReview: true;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  bossingCalculatorRule: {
    upsert(args: {
      where: { serviceId: string };
      create: BossingRuleSeedCreate;
      update: Record<string, never>;
    }): Promise<unknown>;
  };
  bossingBossConfig: {
    upsert(args: {
      where: { seededKey: string };
      create: {
        seededKey: string;
        serviceId: string;
        bossKey: string;
        name: string;
        enabled: boolean;
        displayOrder: number;
        groupLabel: string;
        iconKey: string;
        description: string;
        needsClientReview: true;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  bossingMethod: {
    upsert(args: {
      where: { seededKey: string };
      create: {
        seededKey: string;
        serviceId: string;
        bossId: string;
        slug: string;
        name: string;
        shortDescription: string;
        enabled: true;
        displayOrder: number;
        priceMode: BossingPriceMode;
        minimumKillCount: number;
        maximumKillCount?: number;
        basePriceCentsPerKill: number;
        fixedPackagePriceCents: number;
        minimumPriceCents: number;
        setupFeeCents: number;
        difficultyTierLabel: string;
        expectedRequirementsSummary: string;
        gearNotes: string;
        supplyNotes: string;
        suppliesEnabled: boolean;
        suppliesLabel?: string;
        suppliesFeeCents: number;
        customerGearRequired: boolean;
        customerGearLabel?: string;
        gearAdjustmentCents: number;
        estimatedKillsPerHour: number;
        needsClientReview: true;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  bossingStatRequirement: {
    createMany(args: {
      data: Array<{
        seededKey: string;
        methodId: string;
        metricKey: string;
        label: string;
        requiredLevel: number;
        displayOrder: number;
        verificationMode: "AUTOMATIC";
        customerGuidance: string;
        needsClientReview: true;
      }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
  bossingGearRequirement: {
    createMany(args: {
      data: Array<{
        seededKey: string;
        methodId: string;
        label: string;
        description: string;
        isRequired: boolean;
        displayOrder: number;
        verificationMode: "CUSTOMER_CONFIRMED" | "SUPPORT_VERIFIED";
        customerGuidance: string;
        needsClientReview: true;
      }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
  premiumServiceConfig: {
    upsert(args: {
      where: { serviceId: string };
      create: PremiumRuleSeedCreate;
      update: Record<string, never>;
      select?: { id: true };
    }): Promise<{ id: string }>;
  };
  premiumPackage: {
    upsert(args: {
      where: { seededKey: string };
      create: {
        seededKey: string;
        serviceId: string;
        configId: string;
        slug: string;
        name: string;
        shortDescription: string;
        enabled: true;
        displayOrder: number;
        basePriceCents: number;
        minimumPriceCents: number;
        setupFeeCents: number;
        estimatedHours: number | null;
        difficultyTierLabel: string;
        requirementsSummary: string;
        gearNotes: string;
        unlockNotes: string;
        customerGearRequired: boolean;
        customerGearLabel: string;
        gearUnconfirmedAdjustmentCents: number;
        needsClientReview: boolean;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  premiumOption: {
    upsert(args: {
      where: { seededKey: string };
      create: {
        seededKey: string;
        serviceId: string;
        configId: string;
        packageId?: string;
        slug: string;
        name: string;
        description: string;
        enabled: true;
        displayOrder: number;
        optionType: "ADDON" | "SUPPLIES" | "GEAR_SUPPORT" | "UNLOCK_SUPPORT";
        pricingMode: "FIXED_FEE" | "PERCENT_OF_BASE" | "PER_UNIT";
        fixedPriceCents: number;
        percentBps: number;
        perUnitPriceCents: number;
        minimumQuantity: number;
        maximumQuantity: number;
        defaultQuantity: number;
        customerInputRequired: boolean;
        needsClientReview: boolean;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  premiumRequirementGroup: {
    upsert(args: {
      where: { seededKey: string };
      create: {
        seededKey: string;
        serviceId: string;
        configId: string;
        packageId: string;
        title: string;
        description: string;
        displayOrder: number;
        needsClientReview: true;
      };
      update: Record<string, never>;
      select: { id: true };
    }): Promise<{ id: string }>;
  };
  premiumRequirement: {
    createMany(args: {
      data: Array<{
        seededKey: string;
        groupId: string;
        label: string;
        description: string;
        isRequired: boolean;
        displayOrder: number;
        verificationMode:
          "AUTOMATIC" | "CUSTOMER_CONFIRMED" | "SUPPORT_VERIFIED";
        requirementType:
          | "SKILL"
          | "QUEST"
          | "ITEM"
          | "ACTIVITY"
          | "ACCOUNT"
          | "GEAR"
          | "UNLOCK"
          | "OTHER";
        metricKey?: string | null;
        comparisonOperator?:
          | "GREATER_THAN_OR_EQUAL"
          | "GREATER_THAN"
          | "EQUAL"
          | "LESS_THAN_OR_EQUAL"
          | "LESS_THAN"
          | null;
        requiredValue?: number | null;
        customerGuidance: string;
        needsClientReview: boolean;
      }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
  premiumFaq: {
    createMany(args: {
      data: Array<{
        seededKey: string;
        serviceId: string;
        configId: string;
        packageId: string;
        question: string;
        answer: string;
        enabled: true;
        displayOrder: number;
        needsClientReview: true;
      }>;
      skipDuplicates: true;
    }): Promise<unknown>;
  };
};

type SkillingSkillKey =
  | "ATTACK"
  | "STRENGTH"
  | "DEFENCE"
  | "RANGED"
  | "PRAYER"
  | "MAGIC"
  | "RUNECRAFT"
  | "CONSTRUCTION"
  | "HITPOINTS"
  | "AGILITY"
  | "HERBLORE"
  | "THIEVING"
  | "CRAFTING"
  | "FLETCHING"
  | "SLAYER"
  | "HUNTER"
  | "MINING"
  | "SMITHING"
  | "FISHING"
  | "COOKING"
  | "FIREMAKING"
  | "WOODCUTTING"
  | "FARMING";

type SkillingRuleSeedCreate = {
  serviceId: string;
  normalModeMultiplierBps: number;
  ironmanMultiplierBps: number;
  hardcoreIronmanMultiplierBps: number;
  ultimateIronmanMultiplierBps: number;
  discordStreamEnabled: true;
  discordStreamPercentBps: number;
  standardDeliveryEnabled: true;
  standardDeliveryLabel: string;
  standardDeliveryDescription: string;
  standardDeliveryEstimate: string;
  standardDeliveryMultiplierBps: number;
  standardDeliveryFixedFeeCents: number;
  priorityDeliveryEnabled: boolean;
  priorityDeliveryLabel: string;
  priorityDeliveryDescription: string;
  priorityDeliveryEstimate: string | null;
  priorityDeliveryMultiplierBps: number;
  priorityDeliveryFixedFeeCents: number;
  expressDeliveryEnabled: boolean;
  expressDeliveryLabel: string;
  expressDeliveryDescription: string;
  expressDeliveryEstimate: string | null;
  expressDeliveryMultiplierBps: number;
  expressDeliveryFixedFeeCents: number;
  needsClientReview: true;
};

type BossingPriceMode = "PER_KILL" | "FIXED_PACKAGE";

type BossingRuleSeedCreate = SkillingRuleSeedCreate;

type PremiumRuleSeedCreate = SkillingRuleSeedCreate & {
  configuratorType:
    | "FIRE_CAPE"
    | "INFERNAL_CAPE"
    | "COLOSSEUM"
    | "YAMA"
    | "ROYAL_TITANS"
    | "CORRUPTED_GAUNTLET"
    | "DOOM_OF_MOKHAIOTL"
    | "RAIDS"
    | "CUSTOM";
  enabled: boolean;
  rsnEligibilityEnabled: boolean;
  supportsManualStatFallback: boolean;
};

export const catalogueCategorySeeds = [
  ["power-levelling", "Power Levelling", "activity"],
  ["quests", "Quests", "scroll"],
  ["achievement-diaries", "Achievement Diaries", "map"],
  ["combat-achievements", "Combat Achievements", "badge"],
  ["minigames", "Minigames", "flag"],
  ["bossing-pvm", "Bossing and PvM", "swords"],
  ["premium-services", "Premium Services", "crown"],
  ["gold", "Gold", "coins"],
  ["ironman-gathering", "Ironman Gathering", "pickaxe"],
  ["items-miscellaneous", "Items and Miscellaneous", "package"],
] as const;

const catalogueServiceSeeds = [
  {
    key: "skill-training-request",
    categoryKey: "power-levelling",
    name: "Skill training request",
    slug: "skill-training-request",
    summary:
      "Plan a skill progression request around current progress, targets and account mode.",
    content:
      "Choose the skill and progression target that need support. Requirements and the service scope are reviewed before a final estimate is confirmed.",
    engineType: "SKILLING_CALCULATOR" as const,
    featured: true,
    order: 10,
    modes: [
      "NORMAL",
      "IRONMAN",
      "HARDCORE_IRONMAN",
      "ULTIMATE_IRONMAN",
    ] as const,
    requirements: [
      {
        key: "skill-training-target",
        title: "Current and target progress",
        description: "Provide the current and target level or XP for review.",
        type: "SKILL" as const,
        required: true,
        verification: "CUSTOMER_CONFIRMED" as const,
      },
    ],
  },
  {
    key: "quest-progression",
    categoryKey: "quests",
    name: "Quest progression",
    slug: "quest-progression",
    summary:
      "Prepare an individual quest or progression route with prerequisites reviewed first.",
    content:
      "Quest support begins with the requested quest list, account mode and known prerequisites. The final scope is confirmed after requirement review.",
    engineType: "CATALOGUE_CARD" as const,
    featured: true,
    order: 20,
    modes: ["NORMAL", "IRONMAN"] as const,
    requirements: [
      {
        key: "quest-prerequisites",
        title: "Quest prerequisites",
        description:
          "Confirm prerequisite quests, levels and account restrictions.",
        type: "QUEST" as const,
        required: true,
        verification: "SUPPORT_VERIFIED" as const,
      },
    ],
  },
  {
    key: "pvm-support",
    categoryKey: "bossing-pvm",
    name: "PvM support",
    slug: "pvm-support",
    summary:
      "Describe the encounter and account context needed for a clear PvM service scope.",
    content:
      "PvM requests are reviewed around the encounter, account mode and relevant preparation. Availability and a final estimate are confirmed before any order step.",
    engineType: "BOSSING_ENGINE" as const,
    featured: true,
    order: 30,
    modes: ["NORMAL", "IRONMAN", "HARDCORE_IRONMAN"] as const,
    requirements: [
      {
        key: "pvm-preparation",
        title: "Encounter preparation",
        description: "Share relevant stats, unlocks and preparation details.",
        type: "ACTIVITY" as const,
        required: true,
        verification: "SUPPORT_VERIFIED" as const,
      },
    ],
  },
  {
    key: "fire-cape-premium",
    categoryKey: "premium-services",
    name: "Fire Cape premium service",
    slug: "fire-cape-premium-service",
    summary:
      "Configure a reviewed Fire Cape request around package, account mode, gear confirmation and optional add-ons.",
    content:
      "Premium Fire Cape requests are scoped around the selected package, public combat stats, account mode, customer-confirmed gear and support-verified unlocks. Representative package prices are seeded for validation only and require client review before public launch.",
    engineType: "PREMIUM_SERVICE_CONFIGURATOR" as const,
    featured: true,
    order: 35,
    modes: ["NORMAL", "IRONMAN", "HARDCORE_IRONMAN"] as const,
    requirements: [
      {
        key: "fire-cape-account-context",
        title: "Account and gear context",
        description:
          "Confirm account mode, public combat stats and available gear before staff review.",
        type: "ACTIVITY" as const,
        required: true,
        verification: "SUPPORT_VERIFIED" as const,
      },
    ],
  },
  {
    key: "infernal-cape-premium",
    categoryKey: "premium-services",
    name: "Infernal Cape Service",
    slug: "infernal-cape-service",
    summary:
      "Configure an Infernal Cape request around public combat stats, weapon setup, account mode and available support options.",
    content:
      "Infernal Cape requests use the dedicated premium configurator. Published reference pricing is a review seed only; staff can manage weapon packages, requirements, account-mode adjustments, enabled service methods and optional support before launch.",
    engineType: "PREMIUM_SERVICE_CONFIGURATOR" as const,
    featured: true,
    order: 37,
    modes: ["NORMAL", "IRONMAN"] as const,
    requirements: [
      {
        key: "infernal-account-context",
        title: "Infernal account and gear context",
        description:
          "Confirm public combat levels, account build, weapon setup, prayers, supplies and non-public unlocks before service begins.",
        type: "ACTIVITY" as const,
        required: true,
        verification: "SUPPORT_VERIFIED" as const,
      },
    ],
  },
  {
    key: "gold-trading",
    categoryKey: "gold",
    name: "Gold trading",
    slug: "gold-trading",
    summary:
      "Estimate buy and sell gold trades using staff-published rates, limits and availability checks.",
    content:
      "Gold trading estimates use only staff-published rates, configured quantity limits, current stock or buying-capacity checks and review-safe trade instructions. No inventory is reserved, no order is created and no final trade is confirmed until support reviews the request.",
    engineType: "GOLD_ENGINE" as const,
    featured: true,
    order: 36,
    modes: ["NORMAL"] as const,
    requirements: [
      {
        key: "gold-rsn",
        title: "RuneScape name",
        description:
          "Provide your RuneScape name for staff review. Never provide a password, PIN or authenticator code.",
        type: "ACCOUNT" as const,
        required: true,
        verification: "CUSTOMER_CONFIRMED" as const,
      },
    ],
  },
  {
    key: "diary-progression",
    categoryKey: "achievement-diaries",
    name: "Diary progression",
    slug: "diary-progression",
    summary:
      "Organise region and tier goals while keeping missing requirements visible.",
    content:
      "Achievement diary support is scoped by region, tier and the prerequisites still needed. Requirements are reviewed before the final estimate is confirmed.",
    engineType: "CATALOGUE_CARD" as const,
    featured: false,
    order: 40,
    modes: [
      "NORMAL",
      "IRONMAN",
      "HARDCORE_IRONMAN",
      "ULTIMATE_IRONMAN",
    ] as const,
    requirements: [
      {
        key: "diary-requirements",
        title: "Diary requirements",
        description: "Confirm the region, tier and known missing requirements.",
        type: "ACCOUNT" as const,
        required: true,
        verification: "CUSTOMER_CONFIRMED" as const,
      },
    ],
  },
  {
    key: "combat-achievement-packages",
    categoryKey: "combat-achievements",
    name: "Combat achievement packages",
    slug: "combat-achievement-packages",
    summary:
      "Review a combat-achievement tier or selected task list with account preparation kept visible.",
    content:
      "Choose a package and share the relevant combat context. Public statistics can support part of the review, while unlocks and gear remain support-verified.",
    engineType: "CATALOGUE_CARD" as const,
    featured: false,
    order: 50,
    modes: ["NORMAL", "IRONMAN", "HARDCORE_IRONMAN"] as const,
    requirements: [
      {
        key: "combat-context",
        title: "Combat preparation",
        description:
          "Share relevant unlocks, gear constraints and selected tasks for review.",
        type: "ACTIVITY" as const,
        required: true,
        verification: "SUPPORT_VERIFIED" as const,
      },
    ],
  },
  {
    key: "minigame-support",
    categoryKey: "minigames",
    name: "Minigame support",
    slug: "minigame-support",
    summary:
      "Browse selected minigame packages with role, account-mode and quantity details made clear.",
    content:
      "Select a supported minigame package and review its preparation notes. The final scope is confirmed by support before any order step.",
    engineType: "CATALOGUE_CARD" as const,
    featured: false,
    order: 60,
    modes: [
      "NORMAL",
      "IRONMAN",
      "HARDCORE_IRONMAN",
      "ULTIMATE_IRONMAN",
    ] as const,
    requirements: [
      {
        key: "minigame-access",
        title: "Minigame access",
        description:
          "Confirm access, relevant unlocks and account restrictions.",
        type: "ACTIVITY" as const,
        required: true,
        verification: "CUSTOMER_CONFIRMED" as const,
      },
    ],
  },
  {
    key: "ironman-gathering-support",
    categoryKey: "ironman-gathering",
    name: "Ironman gathering support",
    slug: "ironman-gathering-support",
    summary:
      "Browse Ironman gathering and supply-support requests with quantity and requirement review.",
    content:
      "Ironman gathering requests are scoped around account mode, current unlocks, quantity and collection restrictions. Staff confirms availability and final timing before any order step.",
    engineType: "CATALOGUE_CARD" as const,
    featured: false,
    order: 70,
    modes: ["IRONMAN", "HARDCORE_IRONMAN", "ULTIMATE_IRONMAN"] as const,
    requirements: [
      {
        key: "ironman-gathering-context",
        title: "Gathering context",
        description:
          "Confirm current unlocks, area access, restrictions and the requested quantity.",
        type: "ACTIVITY" as const,
        required: true,
        verification: "SUPPORT_VERIFIED" as const,
      },
    ],
  },
] as const;

const catalogueOfferingSeeds = [
  {
    key: "quest:rfd",
    serviceKey: "quest-progression",
    slug: "recipe-for-disaster",
    name: "Recipe for Disaster",
    summary:
      "A long-form quest package with prerequisite progress reviewed before support begins.",
    description:
      "Review the requested subquests and remaining prerequisite progress with support.",
    order: 10,
    featured: true,
    group: "Quest package",
    tier: "Long-form",
    reference: ["quests", "quest", "recipe-for-disaster"] as const,
    modes: ["NORMAL", "IRONMAN"] as const,
    facets: [
      ["difficulty", "advanced", "Advanced"],
      ["package-type", "multi-part", "Multi-part"],
    ] as const,
    requirement: [
      "Quest progress",
      "Confirm completed subquests and prerequisite quests.",
      "QUEST",
      "CUSTOMER_CONFIRMED",
    ] as const,
  },
  {
    key: "quest:dragon-slayer-ii",
    serviceKey: "quest-progression",
    slug: "dragon-slayer-ii",
    name: "Dragon Slayer II",
    summary:
      "A grandmaster quest request with account requirements reviewed in one place.",
    description:
      "Public skill statistics may be checked separately; quest unlocks remain customer-confirmed.",
    order: 20,
    featured: false,
    group: "Individual quest",
    tier: "Grandmaster",
    reference: ["quests", "quest", "dragon-slayer-ii"] as const,
    modes: ["NORMAL", "IRONMAN"] as const,
    facets: [
      ["difficulty", "grandmaster", "Grandmaster"],
      ["package-type", "single-quest", "Single quest"],
    ] as const,
    requirement: [
      "Quest prerequisites",
      "Confirm prerequisite quest completion before review.",
      "QUEST",
      "CUSTOMER_CONFIRMED",
    ] as const,
  },
  {
    key: "diary:ardougne-easy",
    serviceKey: "diary-progression",
    slug: "ardougne-easy",
    name: "Ardougne Easy Diary",
    summary:
      "An entry-tier regional diary package with missing tasks reviewed clearly.",
    description:
      "Diary completion cannot be inferred from public statistics and must be confirmed.",
    order: 10,
    featured: false,
    group: "Ardougne",
    tier: "Easy",
    reference: ["diaries", "achievement-diary", "ardougne-easy"] as const,
    modes: [] as const,
    facets: [
      ["region", "ardougne", "Ardougne"],
      ["tier", "easy", "Easy"],
    ] as const,
    requirement: [
      "Diary progress",
      "Confirm which Ardougne Easy tasks remain.",
      "ACCOUNT",
      "CUSTOMER_CONFIRMED",
    ] as const,
  },
  {
    key: "diary:kandarin-hard",
    serviceKey: "diary-progression",
    slug: "kandarin-hard",
    name: "Kandarin Hard Diary",
    summary:
      "A hard-tier regional package with skills, quests and item context reviewed together.",
    description:
      "Support verifies non-public unlock and item requirements before confirming scope.",
    order: 20,
    featured: true,
    group: "Kandarin",
    tier: "Hard",
    reference: ["diaries", "achievement-diary", "kandarin-hard"] as const,
    modes: [] as const,
    facets: [
      ["region", "kandarin", "Kandarin"],
      ["tier", "hard", "Hard"],
    ] as const,
    requirement: [
      "Unlock review",
      "Share relevant unlocks and untradeable item context.",
      "ITEM",
      "SUPPORT_VERIFIED",
    ] as const,
  },
  {
    key: "combat:easy-tier",
    serviceKey: "combat-achievement-packages",
    slug: "easy-tier-package",
    name: "Easy tier package",
    summary:
      "A selected Easy combat-achievement task package for support review.",
    description:
      "Choose the task scope and share any restrictions that affect the account.",
    order: 10,
    featured: true,
    group: "Tier package",
    tier: "Easy",
    reference: [
      "combat-achievements",
      "combat-achievement-tier",
      "easy",
    ] as const,
    modes: ["NORMAL", "IRONMAN"] as const,
    facets: [
      ["tier", "easy", "Easy"],
      ["package-type", "tier-package", "Tier package"],
    ] as const,
    requirement: [
      "Task scope",
      "Confirm the selected combat-achievement tasks.",
      "ACTIVITY",
      "SUPPORT_VERIFIED",
    ] as const,
  },
  {
    key: "combat:medium-tier",
    serviceKey: "combat-achievement-packages",
    slug: "medium-tier-package",
    name: "Medium tier package",
    summary:
      "A selected Medium combat-achievement task package with preparation review.",
    description:
      "Support reviews gear and unlock constraints without claiming public verification.",
    order: 20,
    featured: false,
    group: "Tier package",
    tier: "Medium",
    reference: [
      "combat-achievements",
      "combat-achievement-tier",
      "medium",
    ] as const,
    modes: ["NORMAL", "IRONMAN", "HARDCORE_IRONMAN"] as const,
    facets: [
      ["tier", "medium", "Medium"],
      ["package-type", "tier-package", "Tier package"],
    ] as const,
    requirement: [
      "Preparation review",
      "Share gear and unlock constraints with support.",
      "ITEM",
      "SUPPORT_VERIFIED",
    ] as const,
  },
  {
    key: "minigame:barbarian-assault",
    serviceKey: "minigame-support",
    slug: "barbarian-assault-role-support",
    name: "Barbarian Assault role support",
    summary:
      "Select a role-focused Barbarian Assault package and review access requirements.",
    description:
      "Role progress and account access are confirmed by the customer and support.",
    order: 10,
    featured: true,
    group: "Team minigame",
    tier: "Role package",
    reference: ["minigames", "minigame", "barbarian-assault"] as const,
    modes: [] as const,
    facets: [
      ["activity-type", "team", "Team activity"],
      ["package-type", "role-support", "Role support"],
    ] as const,
    requirement: [
      "Role progress",
      "Confirm the requested role and current progress.",
      "ACTIVITY",
      "CUSTOMER_CONFIRMED",
    ] as const,
  },
  {
    key: "minigame:pest-control",
    serviceKey: "minigame-support",
    slug: "pest-control-points",
    name: "Pest Control points",
    summary:
      "Configure a points target within the supported range for manual review.",
    description:
      "Quantity config records the requested point target only; it does not calculate price.",
    order: 20,
    featured: false,
    group: "Combat minigame",
    tier: "Points package",
    reference: ["minigames", "minigame", "pest-control"] as const,
    modes: ["NORMAL", "IRONMAN"] as const,
    facets: [
      ["activity-type", "combat", "Combat"],
      ["package-type", "points", "Points"],
    ] as const,
    quantity: { unit: "points", minimum: 100, maximum: 4_000 },
    requirement: [
      "Boat access",
      "Confirm the account can access the intended Pest Control boat.",
      "ACTIVITY",
      "CUSTOMER_CONFIRMED",
    ] as const,
  },
] as const;

const skillingSkillSeeds: Array<{
  key: SkillingSkillKey;
  name: string;
  icon: string;
  enabled: boolean;
}> = [
  { key: "ATTACK", name: "Attack", icon: "sword", enabled: true },
  { key: "STRENGTH", name: "Strength", icon: "strength", enabled: true },
  { key: "DEFENCE", name: "Defence", icon: "shield", enabled: true },
  { key: "RANGED", name: "Ranged", icon: "bow", enabled: true },
  { key: "PRAYER", name: "Prayer", icon: "prayer", enabled: true },
  { key: "MAGIC", name: "Magic", icon: "magic", enabled: true },
  { key: "RUNECRAFT", name: "Runecraft", icon: "rune", enabled: true },
  { key: "CONSTRUCTION", name: "Construction", icon: "house", enabled: true },
  { key: "HITPOINTS", name: "Hitpoints", icon: "heart", enabled: true },
  { key: "AGILITY", name: "Agility", icon: "footprints", enabled: true },
  { key: "HERBLORE", name: "Herblore", icon: "flask", enabled: true },
  { key: "THIEVING", name: "Thieving", icon: "mask", enabled: true },
  { key: "CRAFTING", name: "Crafting", icon: "gem", enabled: true },
  { key: "FLETCHING", name: "Fletching", icon: "arrow", enabled: true },
  { key: "SLAYER", name: "Slayer", icon: "skull", enabled: true },
  { key: "HUNTER", name: "Hunter", icon: "trap", enabled: true },
  { key: "MINING", name: "Mining", icon: "pickaxe", enabled: true },
  { key: "SMITHING", name: "Smithing", icon: "anvil", enabled: true },
  { key: "FISHING", name: "Fishing", icon: "fish", enabled: true },
  { key: "COOKING", name: "Cooking", icon: "flame", enabled: true },
  { key: "FIREMAKING", name: "Firemaking", icon: "campfire", enabled: true },
  { key: "WOODCUTTING", name: "Woodcutting", icon: "axe", enabled: true },
  { key: "FARMING", name: "Farming", icon: "sprout", enabled: true },
];

const skillingMethodSeeds = [
  {
    key: "attack:melee-training-review",
    skillKey: "ATTACK" as const,
    slug: "melee-training-review",
    name: "Melee training review",
    summary:
      "A flexible combat-training route for early to late account progression.",
    order: 10,
    min: 1,
    max: 99,
    xpPerHour: 45_000,
    centsPerMillion: 2400,
    minimumCents: 500,
    fixedCents: 0,
    supplies: { label: "Food and potion supply support", cents: 350 },
  },
  {
    key: "agility:rooftop-course-route",
    skillKey: "AGILITY" as const,
    slug: "rooftop-course-route",
    name: "Rooftop course route",
    summary:
      "A course-based Agility plan with marks, unlocks and route constraints reviewed.",
    order: 20,
    min: 10,
    max: 90,
    xpPerHour: 35_000,
    centsPerMillion: 3200,
    minimumCents: 700,
    fixedCents: 0,
  },
  {
    key: "mining:motherlode-route",
    skillKey: "MINING" as const,
    slug: "motherlode-route",
    name: "Motherlode Mine route",
    summary:
      "A Mining progression option for accounts that can access Motherlode Mine.",
    order: 30,
    min: 30,
    max: 99,
    xpPerHour: 28_000,
    centsPerMillion: 2800,
    minimumCents: 700,
    fixedCents: 0,
  },
  {
    key: "cooking:bankstanding-route",
    skillKey: "COOKING" as const,
    slug: "bankstanding-route",
    name: "Bankstanding cooking route",
    summary:
      "A bankstanding Cooking route for accounts with supplies or reviewed material support.",
    order: 40,
    min: 1,
    max: 99,
    xpPerHour: 180_000,
    centsPerMillion: 1200,
    minimumCents: 400,
    fixedCents: 0,
    supplies: { label: "Cooking material support", cents: 500 },
  },
] as const;

const bossingBossSeeds = [
  {
    key: "giant-mole",
    name: "Giant Mole",
    group: "Entry bossing",
    icon: "swords",
    description:
      "Representative entry PvM configuration for calculator validation. Needs client review before public launch.",
    enabled: true,
    order: 10,
    methods: [
      {
        key: "standard-kills",
        slug: "standard-kills",
        name: "Standard kill support",
        summary:
          "A simple kill-count request using configured per-kill pricing and public combat stat checks.",
        order: 10,
        priceMode: "PER_KILL" as const,
        minKills: 1,
        maxKills: 250,
        centsPerKill: 20,
        packageCents: 0,
        minimumCents: 20,
        setupCents: 0,
        tier: "Entry",
        requirements:
          "Public combat stats can be checked. Gear and Falador access remain customer/support confirmed.",
        gearNotes:
          "Customer confirms suitable combat gear. Support verifies unlocks that cannot be read from public stats.",
        supplyNotes:
          "Food, stamina and teleport support can be configured as a reviewed supply option.",
        supplies: { label: "Food, stamina and teleport supplies", cents: 250 },
        gear: {
          label: "Customer provides standard combat gear",
          adjustmentCents: 300,
        },
        killsPerHour: 45,
        stats: [
          ["skill.attack.level", "Attack level", 60],
          ["skill.strength.level", "Strength level", 60],
          ["skill.defence.level", "Defence level", 50],
        ] as const,
        gearRequirements: [
          [
            "Combat gear confirmation",
            "Confirm the account has appropriate weapon, armour, food and teleports available.",
            "CUSTOMER_CONFIRMED",
          ],
          [
            "Access review",
            "Falador hard diary and travel conveniences are support reviewed when relevant; they are not inferred from RSN.",
            "SUPPORT_VERIFIED",
          ],
        ] as const,
      },
    ],
  },
  {
    key: "barrows",
    name: "Barrows",
    group: "Classic PvM",
    icon: "shield",
    description:
      "Representative Barrows run configuration for staged bossing calculator validation.",
    enabled: true,
    order: 20,
    methods: [
      {
        key: "chest-runs",
        slug: "chest-runs",
        name: "Chest run package",
        summary:
          "A package-style PvM request with configured bounds and manual unlock review.",
        order: 10,
        priceMode: "PER_KILL" as const,
        minKills: 1,
        maxKills: 1000,
        centsPerKill: 30,
        packageCents: 0,
        minimumCents: 30,
        setupCents: 0,
        tier: "Classic",
        requirements:
          "Public magic/ranged stats can be checked. Quest, route and gear context remains support reviewed.",
        gearNotes:
          "Customer confirms magic/ranged gear and prayer supplies before quote finalization.",
        supplyNotes:
          "Supply option covers reviewed prayer potion and teleport support only when configured.",
        supplies: { label: "Prayer potion and teleport support", cents: 450 },
        gear: {
          label: "Customer provides Barrows-ready gear",
          adjustmentCents: 500,
        },
        killsPerHour: 18,
        stats: [
          ["skill.magic.level", "Magic level", 55],
          ["skill.prayer.level", "Prayer level", 43],
        ] as const,
        gearRequirements: [
          [
            "Barrows gear confirmation",
            "Confirm staff, ranged switch, food and prayer supplies before review.",
            "CUSTOMER_CONFIRMED",
          ],
          [
            "Quest and access review",
            "Required quests, teleport routes and diary conveniences are support verified.",
            "SUPPORT_VERIFIED",
          ],
        ] as const,
      },
    ],
  },
  {
    key: "zulrah",
    name: "Zulrah",
    group: "Advanced PvM",
    icon: "target",
    description:
      "Advanced PvM configuration with staff-reviewed access, gear and unlock requirements.",
    enabled: true,
    order: 30,
    methods: [
      {
        key: "reviewed-kills",
        slug: "reviewed-kills",
        name: "Reviewed kill support",
        summary:
          "An advanced kill-count request with higher stat checks and explicit support-verified unlocks.",
        order: 10,
        priceMode: "PER_KILL" as const,
        minKills: 1,
        maxKills: 1000,
        centsPerKill: 40,
        packageCents: 0,
        minimumCents: 40,
        setupCents: 0,
        tier: "Advanced",
        requirements:
          "Public Ranged, Magic and Hitpoints levels can be checked. Quest completion and gear ownership are not inferred.",
        gearNotes:
          "Customer confirms suitable gear and support verifies non-public quest/unlock context.",
        supplyNotes: "Supply support is optional and client-review priced.",
        supplies: { label: "Advanced supply support", cents: 700 },
        gear: {
          label: "Customer provides Zulrah-ready gear",
          adjustmentCents: 900,
        },
        killsPerHour: 20,
        stats: [
          ["skill.ranged.level", "Ranged level", 75],
          ["skill.magic.level", "Magic level", 75],
          ["skill.hitpoints.level", "Hitpoints level", 70],
        ] as const,
        gearRequirements: [
          [
            "Gear and switches confirmation",
            "Confirm mage/ranged gear, recoil handling and supplies. Ownership is never inferred from public stats.",
            "CUSTOMER_CONFIRMED",
          ],
          [
            "Regicide and access review",
            "Quest completion, fairy ring access and other unlocks are support verified.",
            "SUPPORT_VERIFIED",
          ],
        ] as const,
      },
    ],
  },
] as const;

const premiumPackageSeeds = [
  {
    key: "standard-fire-cape",
    slug: "standard-fire-cape",
    name: "Standard Fire Cape run",
    summary:
      "Representative Jad completion package using reviewed combat stats and customer-confirmed gear.",
    order: 10,
    baseCents: 1000,
    minimumCents: 1000,
    setupCents: 0,
    hours: 2,
    tier: "Standard",
    requirements:
      "Public Ranged, Defence, Prayer and Hitpoints levels can be checked. Gear, unlocks and supplies remain customer/support confirmed.",
    gearNotes:
      "Customer confirms a suitable ranged setup, food, prayer potions and teleports. Gear ownership is not inferred from RSN.",
    unlockNotes:
      "Fight Caves access, membership and wave-route preferences are reviewed by support without requesting passwords.",
    gear: {
      label: "Customer provides Fire Cape-ready gear",
      adjustmentCents: 700,
    },
    groups: [
      {
        key: "stats",
        title: "Public combat stats",
        description:
          "Allow-listed public stats that can be checked by RSN when enabled.",
        requirements: [
          [
            "skill.ranged.level",
            "Ranged level",
            "Recommended 70 Ranged for this representative package.",
            70,
          ],
          [
            "skill.defence.level",
            "Defence level",
            "Recommended 40 Defence for this representative package.",
            40,
          ],
          [
            "skill.prayer.level",
            "Prayer level",
            "Recommended 43 Prayer for protection prayers.",
            43,
          ],
          [
            "skill.hitpoints.level",
            "Hitpoints level",
            "Recommended 60 Hitpoints for safer wave handling.",
            60,
          ],
        ] as const,
      },
      {
        key: "gear-unlocks",
        title: "Gear and unlock review",
        description:
          "Non-public requirements that must be confirmed by the customer or support.",
        requirements: [
          [
            "Gear confirmation",
            "Confirm ranged weapon, armour, food, prayer potion and teleport availability.",
            "CUSTOMER_CONFIRMED",
          ],
          [
            "Access review",
            "Membership, Fight Caves access and non-public unlock context are support verified.",
            "SUPPORT_VERIFIED",
          ],
        ] as const,
      },
    ],
    faqs: [
      [
        "Can RSN lookup confirm my gear?",
        "No. Public stats can be checked when enabled, but gear, bank, inventory, quests and diary completion are never inferred.",
      ],
      [
        "Do you need my RuneScape password?",
        "No. This configurator never asks for a RuneScape password, bank PIN or authentication code.",
      ],
    ] as const,
  },
  {
    key: "prepared-fire-cape",
    slug: "prepared-fire-cape",
    name: "Prepared account Fire Cape run",
    summary:
      "Representative package for accounts that already confirm stronger stats, unlocks and supplies.",
    order: 20,
    baseCents: 1000,
    minimumCents: 1000,
    setupCents: 0,
    hours: 1,
    tier: "Prepared",
    requirements:
      "Higher public combat stats can be checked, while account unlocks and gear remain review-only.",
    gearNotes:
      "Customer confirms stronger ranged gear and adequate supplies before final review.",
    unlockNotes:
      "Support reviews non-public unlocks and route preferences before confirming scope.",
    gear: {
      label: "Customer confirms prepared gear and supplies",
      adjustmentCents: 400,
    },
    groups: [
      {
        key: "stats",
        title: "Prepared public stats",
        description:
          "Allow-listed public stats for the prepared account representative package.",
        requirements: [
          [
            "skill.ranged.level",
            "Ranged level",
            "Recommended 75 Ranged for the prepared package.",
            75,
          ],
          [
            "skill.prayer.level",
            "Prayer level",
            "Recommended 43 Prayer for protection prayers.",
            43,
          ],
          [
            "skill.hitpoints.level",
            "Hitpoints level",
            "Recommended 70 Hitpoints for safer wave handling.",
            70,
          ],
        ] as const,
      },
      {
        key: "gear-unlocks",
        title: "Prepared gear review",
        description:
          "Customer and support confirmation for gear and non-public readiness.",
        requirements: [
          [
            "Prepared gear confirmation",
            "Confirm stronger ranged gear, supplies and teleports are available.",
            "CUSTOMER_CONFIRMED",
          ],
          [
            "Support readiness review",
            "Support verifies non-public access and route context without inferring it from RSN.",
            "SUPPORT_VERIFIED",
          ],
        ] as const,
      },
    ],
    faqs: [
      [
        "Why is this package lower?",
        "The representative prepared package assumes stronger confirmed readiness, but all seeded values still need client review.",
      ],
    ] as const,
  },
] as const;

const premiumOptionSeeds = [
  {
    key: "supply-support",
    slug: "supply-support",
    name: "Supply support",
    description:
      "Representative reviewed supply support for food, potions and teleports.",
    order: 10,
    type: "SUPPLIES" as const,
    pricingMode: "FIXED_FEE" as const,
    fixedCents: 500,
    percentBps: 0,
    unitCents: 0,
    min: 1,
    max: 1,
    defaultQuantity: 1,
  },
  {
    key: "gear-gap-review",
    slug: "gear-gap-review",
    name: "Gear gap support review",
    description:
      "Representative support review when customer gear confirmation needs extra preparation.",
    order: 20,
    type: "GEAR_SUPPORT" as const,
    pricingMode: "PERCENT_OF_BASE" as const,
    fixedCents: 0,
    percentBps: 1000,
    unitCents: 0,
    min: 1,
    max: 1,
    defaultQuantity: 1,
  },
  {
    key: "extra-attempt-window",
    slug: "extra-attempt-window",
    name: "Extra attempt window",
    description:
      "Representative per-attempt planning buffer for accounts that may need additional review.",
    order: 30,
    type: "ADDON" as const,
    pricingMode: "PER_UNIT" as const,
    fixedCents: 0,
    percentBps: 0,
    unitCents: 650,
    min: 1,
    max: 3,
    defaultQuantity: 1,
  },
] as const;

const referenceCatalogueSources = [
  {
    categoryKey: "quests",
    serviceKey: "quest-progression",
    recordTypes: ["quest"],
    groupLabel: "Quest",
    requirementType: "QUEST" as const,
    requirementTitle: "Quest prerequisites",
    requirementDescription:
      "Confirm prerequisite quests, levels and account restrictions before review.",
    modes: ["NORMAL", "IRONMAN"] as const,
    orderOffset: 1000,
  },
  {
    categoryKey: "diaries",
    serviceKey: "diary-progression",
    recordTypes: ["achievement-diary"],
    groupLabel: "Achievement diary",
    requirementType: "ACCOUNT" as const,
    requirementTitle: "Diary progress",
    requirementDescription:
      "Confirm completed tasks and any missing non-public requirements.",
    modes: [
      "NORMAL",
      "IRONMAN",
      "HARDCORE_IRONMAN",
      "ULTIMATE_IRONMAN",
    ] as const,
    orderOffset: 2000,
  },
  {
    categoryKey: "combat-achievements",
    serviceKey: "combat-achievement-packages",
    recordTypes: ["combat-achievement-tier", "combat-achievement-task"],
    groupLabel: "Combat achievement",
    requirementType: "ACTIVITY" as const,
    requirementTitle: "Combat task scope",
    requirementDescription:
      "Confirm task selection, gear constraints and unlock context with support.",
    modes: ["NORMAL", "IRONMAN", "HARDCORE_IRONMAN"] as const,
    orderOffset: 3000,
  },
  {
    categoryKey: "minigames",
    serviceKey: "minigame-support",
    recordTypes: ["minigame"],
    groupLabel: "Minigame",
    requirementType: "ACTIVITY" as const,
    requirementTitle: "Minigame access",
    requirementDescription:
      "Confirm access, role, unlocks and account restrictions before review.",
    modes: [
      "NORMAL",
      "IRONMAN",
      "HARDCORE_IRONMAN",
      "ULTIMATE_IRONMAN",
    ] as const,
    orderOffset: 4000,
  },
  {
    categoryKey: "ironman",
    serviceKey: "ironman-gathering-support",
    recordTypes: ["ironman-gathering"],
    groupLabel: "Ironman gathering",
    requirementType: "ACTIVITY" as const,
    requirementTitle: "Gathering requirements",
    requirementDescription:
      "Confirm account restrictions, unlocks and the requested quantity.",
    modes: ["IRONMAN", "HARDCORE_IRONMAN", "ULTIMATE_IRONMAN"] as const,
    orderOffset: 5000,
  },
] as const;

const skillKeyByReferenceName = new Map<string, SkillingSkillKey>(
  skillingSkillSeeds.map((skill) => [skill.name.toLowerCase(), skill.key]),
);

function referenceLabel(value: string) {
  return value
    .split(/[-_]+/g)
    .filter(Boolean)
    .map((part) => `${part[0]?.toUpperCase() ?? ""}${part.slice(1)}`)
    .join(" ");
}

function trimField(value: string, maxLength: number) {
  return value.length <= maxLength ? value : value.slice(0, maxLength - 1);
}

function referenceOfferingSeededKey(
  serviceKey: string,
  record: ReferenceRecord,
) {
  return stableKey(
    "reference-offering",
    [serviceKey, record.recordType, record.slug],
    140,
  );
}

function referenceOfferingRequirementKey(
  serviceKey: string,
  record: ReferenceRecord,
) {
  return stableKey(
    "reference-offering-requirement",
    [serviceKey, record.recordType, record.slug],
    160,
  );
}

async function seedReferenceCatalogueOfferings(
  prisma: CatalogueSeedClient,
  serviceIds: Map<string, string>,
  snapshot: FirstSellerReferenceSnapshot,
) {
  for (const source of referenceCatalogueSources) {
    const serviceId = serviceIds.get(source.serviceKey);
    if (!serviceId) continue;
    let displayOffset = 0;
    for (const record of referenceRecords(snapshot, source.categoryKey).filter(
      (item) =>
        (source.recordTypes as readonly string[]).includes(item.recordType),
    )) {
      const sourceKey = stableReferenceKey(source.categoryKey, record);
      displayOffset += 1;
      const quantity = numberFieldForSeed(record, "baseQuantity");
      const seededKey = referenceOfferingSeededKey(source.serviceKey, record);
      const metadataFacets: Array<{
        offeringId: string;
        facetKey: string;
        facetValue: string;
        label: string;
        displayOrder: number;
      }> = [];
      const offering = await prisma.catalogueOffering.upsert({
        where: { seededKey },
        create: {
          seededKey,
          serviceId,
          slug: trimField(`reference-${record.slug}`, 180),
          name: trimField(record.name, 191),
          shortSummary: trimField(
            `${record.name} reference option with final scope confirmed by support.`,
            500,
          ),
          description:
            "This option is seeded from the committed public reference snapshot. Staff confirms requirements, timing and final quote before any order step.",
          displayOrder: source.orderOffset + displayOffset,
          isActive: true,
          isFeatured: displayOffset <= 3,
          needsClientReview: true,
          groupLabel: source.groupLabel,
          tierLabel: record.subcategory
            ? trimField(record.subcategory, 120)
            : referenceLabel(record.recordType).slice(0, 120),
          basePriceCents: record.priceCents,
          pricingUnit: record.pricingUnit ?? undefined,
          referenceSourceKey: sourceKey,
          quantityEnabled: quantity != null,
          ...(quantity != null
            ? {
                quantityUnit: record.pricingUnit ?? "quantity",
                minimumQuantity: quantity,
              }
            : {}),
        },
        update: {},
        select: { id: true },
      });
      if (typeof record.questPoints === "number") {
        metadataFacets.push({
          offeringId: offering.id,
          facetKey: "quest-points",
          facetValue: String(Math.max(0, Math.round(record.questPoints))),
          label: String(Math.max(0, Math.round(record.questPoints))),
          displayOrder: 40,
        });
      }
      if (
        source.categoryKey === "quests" &&
        typeof record.subcategory === "string" &&
        record.subcategory.trim()
      ) {
        metadataFacets.push({
          offeringId: offering.id,
          facetKey: "difficulty",
          facetValue: slugify(record.subcategory),
          label: trimField(referenceLabel(record.subcategory), 160),
          displayOrder: 45,
        });
      }
      if (typeof record.area === "string" && record.area.trim()) {
        metadataFacets.push({
          offeringId: offering.id,
          facetKey: "region",
          facetValue: slugify(record.area),
          label: trimField(record.area, 160),
          displayOrder: 40,
        });
      }
      if (typeof record.tier === "string" && record.tier.trim()) {
        metadataFacets.push({
          offeringId: offering.id,
          facetKey: "tier",
          facetValue: slugify(record.tier),
          label: trimField(referenceLabel(record.tier), 160),
          displayOrder: 50,
        });
      }
      if (source.categoryKey === "diaries") {
        metadataFacets.push({
          offeringId: offering.id,
          facetKey: "dependency-behavior",
          facetValue: "require-complete",
          label: "Earlier tiers must already be completed",
          displayOrder: 60,
        });
      }

      await prisma.catalogueOfferingFacet.createMany({
        data: [
          {
            offeringId: offering.id,
            facetKey: "reference-category",
            facetValue: slugify(source.categoryKey),
            label: referenceLabel(source.categoryKey),
            displayOrder: 10,
          },
          ...(record.subcategory
            ? [
                {
                  offeringId: offering.id,
                  facetKey: "reference-group",
                  facetValue: slugify(record.subcategory),
                  label: trimField(record.subcategory, 160),
                  displayOrder: 20,
                },
              ]
            : []),
          {
            offeringId: offering.id,
            facetKey: "record-type",
            facetValue: slugify(record.recordType),
            label: referenceLabel(record.recordType),
            displayOrder: 30,
          },
          ...metadataFacets,
        ],
        skipDuplicates: true,
      });

      await prisma.catalogueOfferingGameMode.createMany({
        data: source.modes.map((gameMode) => ({
          offeringId: offering.id,
          gameMode,
        })),
        skipDuplicates: true,
      });

      await prisma.catalogueOfferingRequirement.createMany({
        data: [
          {
            seededKey: referenceOfferingRequirementKey(
              source.serviceKey,
              record,
            ),
            offeringId: offering.id,
            title: source.requirementTitle,
            description: source.requirementDescription,
            type: source.requirementType,
            isRequired: true,
            displayOrder: 10,
            verificationMode: "SUPPORT_VERIFIED",
            customerGuidance:
              "Support reviews this requirement before confirming the final quote.",
          },
        ],
        skipDuplicates: true,
      });
    }
  }
}

function numberFieldForSeed(record: ReferenceRecord, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, Math.round(value))
    : null;
}

function skillingSkillKey(record: ReferenceRecord) {
  return typeof record.subcategory === "string"
    ? skillKeyByReferenceName.get(record.subcategory.toLowerCase())
    : undefined;
}

async function seedReferenceSkillingMethods(
  prisma: CatalogueSeedClient,
  serviceId: string,
  skillIds: Map<SkillingSkillKey, string>,
  snapshot: FirstSellerReferenceSnapshot,
) {
  let displayOffset = 1000;
  for (const record of referenceRecords(
    snapshot,
    "skilling",
    "skilling-level-band",
  )) {
    const skillKey = skillingSkillKey(record);
    if (!skillKey) continue;
    displayOffset += 1;
    const seededKey = stableKey(
      "skill-training-reference",
      [skillKey, record.slug],
      160,
    );
    const minimumLevel = referenceLevelField(record, "minimum") ?? 1;
    const maximumLevel = referenceLevelField(record, "maximum") ?? 99;
    const methodName =
      typeof record["method"] === "string" ? record["method"] : record.name;
    await prisma.skillingTrainingMethod.upsert({
      where: { seededKey },
      create: {
        seededKey,
        serviceId,
        skillConfigId: skillIds.get(skillKey)!,
        slug: trimField(record.slug, 180),
        name: trimField(`${record.name}`, 160),
        shortDescription: trimField(
          `${methodName} reference route. Requirements and materials are reviewed before final quote.`,
          500,
        ),
        enabled: true,
        displayOrder: displayOffset,
        minimumLevel,
        maximumLevel,
        xpPerHour: 1_000_000,
        basePriceCentsPerMillionXp: record.priceCents,
        minimumPriceCents: Math.max(record.priceCents, 1),
        fixedFeeCents: 0,
        suppliesEnabled: false,
        suppliesFeeCents: 0,
        notes:
          "Seeded from committed FirstSeller public reference snapshot for pricing parity validation.",
        needsClientReview: true,
      },
      update: {},
      select: { id: true },
    });
  }
}

function referenceLevelField(record: ReferenceRecord, field: string) {
  const value = record["levelRange"];
  if (typeof value !== "object" || value === null) return null;
  const nested = (value as Record<string, unknown>)[field];
  return typeof nested === "number" && Number.isFinite(nested)
    ? Math.round(nested)
    : null;
}

async function seedReferenceBossingMethods(
  prisma: CatalogueSeedClient,
  serviceId: string,
  snapshot: FirstSellerReferenceSnapshot,
) {
  let displayOffset = 1000;
  for (const record of referenceRecords(snapshot, "pvm", "pvm-kill")) {
    displayOffset += 1;
    const bossSeededKey = stableKey(
      "pvm-support-reference",
      [record.slug],
      160,
    );
    const bossRecord = await prisma.bossingBossConfig.upsert({
      where: { seededKey: bossSeededKey },
      create: {
        seededKey: bossSeededKey,
        serviceId,
        bossKey: trimField(`reference-${record.slug}`, 120),
        name: trimField(record.name, 160),
        enabled: true,
        displayOrder: displayOffset,
        groupLabel: "Reference PvM",
        iconKey: "swords",
        description:
          "Public reference boss entry with account preparation and gear reviewed by support.",
        needsClientReview: true,
      },
      update: {},
      select: { id: true },
    });
    await prisma.bossingMethod.upsert({
      where: {
        seededKey: stableKey(
          "pvm-support-reference-method",
          [record.slug, "standard-kills"],
          180,
        ),
      },
      create: {
        seededKey: stableKey(
          "pvm-support-reference-method",
          [record.slug, "standard-kills"],
          180,
        ),
        serviceId,
        bossId: bossRecord.id,
        slug: "standard-kills",
        name: "Standard kill support",
        shortDescription:
          "Per-kill reference pricing with final requirements confirmed by support.",
        enabled: true,
        displayOrder: 10,
        priceMode: "PER_KILL",
        minimumKillCount: 1,
        maximumKillCount: 1000,
        basePriceCentsPerKill: record.priceCents,
        fixedPackagePriceCents: 0,
        minimumPriceCents: Math.max(record.priceCents, 1),
        setupFeeCents: 0,
        difficultyTierLabel: "Reference",
        expectedRequirementsSummary:
          "Stats, quest access, unlocks, gear and supply readiness are reviewed before quote confirmation.",
        gearNotes:
          "Customer confirms gear; support verifies non-public unlock context.",
        supplyNotes: "Supply support remains separately reviewed.",
        suppliesEnabled: false,
        suppliesFeeCents: 0,
        customerGearRequired: true,
        customerGearLabel: "Customer confirms suitable encounter gear",
        gearAdjustmentCents: 0,
        estimatedKillsPerHour: 1,
        needsClientReview: true,
      },
      update: {},
      select: { id: true },
    });
  }
}

export async function seedCatalogue(prisma: CatalogueSeedClient) {
  const referenceSnapshot = loadReferenceSnapshot();
  const categoryIds = new Map<string, string>();
  const serviceIds = new Map<string, string>();

  for (const [
    index,
    [key, name, iconKey],
  ] of catalogueCategorySeeds.entries()) {
    const category = await prisma.catalogueCategory.upsert({
      where: { seededKey: key },
      create: {
        seededKey: key,
        name,
        slug: key,
        shortDescription: `Explore ${name.toLowerCase()} service paths and requirements.`,
        description:
          "Explore service options, preparation details and account requirements for this category.",
        iconKey,
        displayOrder: (index + 1) * 10,
        isActive: true,
        seoTitle: `${name} services`,
        seoDescription: `Explore ${name.toLowerCase()} service options from OSRS Services.`,
      },
      update: {},
      select: { id: true },
    });
    categoryIds.set(key, category.id);
  }

  for (const definition of catalogueServiceSeeds) {
    const service = await prisma.catalogueService.upsert({
      where: { seededKey: definition.key },
      create: {
        seededKey: definition.key,
        categoryId: categoryIds.get(definition.categoryKey)!,
        name: definition.name,
        slug: definition.slug,
        canonicalSlug: definition.slug,
        shortSummary: definition.summary,
        content: definition.content,
        serviceType: "SERVICE",
        engineType: definition.engineType,
        publicationStatus: "PUBLISHED",
        availabilityState: "AVAILABLE",
        isFeatured: definition.featured,
        isQuoteOnly: true,
        displayOrder: definition.order,
        publicPreparationNotes:
          "Prepare account mode, current progress and the intended goal for review.",
        seoTitle: `${definition.name} | OSRS Services`,
        seoDescription: definition.summary,
        needsClientReview: true,
      },
      update: {},
      select: { id: true },
    });
    serviceIds.set(definition.key, service.id);

    await prisma.catalogueServiceGameMode.createMany({
      data: definition.modes.map((gameMode) => ({
        serviceId: service.id,
        gameMode,
      })),
      skipDuplicates: true,
    });

    await prisma.catalogueRequirement.createMany({
      data: definition.requirements.map((requirement, index) => ({
        seededKey: `${definition.key}:${requirement.key}`,
        serviceId: service.id,
        title: requirement.title,
        description: requirement.description,
        type: requirement.type,
        isRequired: requirement.required,
        displayOrder: (index + 1) * 10,
        verificationMode: requirement.verification,
      })),
      skipDuplicates: true,
    });
  }

  for (const definition of catalogueOfferingSeeds) {
    const quantity = "quantity" in definition ? definition.quantity : undefined;
    const priceReference = (() => {
      if (!("reference" in definition)) return null;
      const [categoryKey, recordType, slug] = definition.reference;
      return {
        categoryKey,
        record: requireReferenceRecord(
          referenceSnapshot,
          categoryKey,
          recordType,
          slug,
        ),
      };
    })();
    const offering = await prisma.catalogueOffering.upsert({
      where: { seededKey: definition.key },
      create: {
        seededKey: definition.key,
        serviceId: serviceIds.get(definition.serviceKey)!,
        slug: definition.slug,
        name: definition.name,
        shortSummary: definition.summary,
        description: definition.description,
        displayOrder: definition.order,
        isActive: true,
        isFeatured: definition.featured,
        needsClientReview: true,
        groupLabel: definition.group,
        tierLabel: definition.tier,
        ...(priceReference
          ? {
              basePriceCents: priceReference.record.priceCents,
              pricingUnit: priceReference.record.pricingUnit ?? undefined,
              referenceSourceKey: stableReferenceKey(
                priceReference.categoryKey,
                priceReference.record,
              ),
            }
          : {}),
        quantityEnabled: Boolean(quantity),
        ...(quantity
          ? {
              quantityUnit: quantity.unit,
              minimumQuantity: quantity.minimum,
              maximumQuantity: quantity.maximum,
            }
          : {}),
      },
      update: {},
      select: { id: true },
    });
    await prisma.catalogueOfferingFacet.createMany({
      data: definition.facets.map(([facetKey, facetValue, label], index) => ({
        offeringId: offering.id,
        facetKey,
        facetValue,
        label,
        displayOrder: (index + 1) * 10,
      })),
      skipDuplicates: true,
    });
    await prisma.catalogueOfferingGameMode.createMany({
      data: definition.modes.map((gameMode) => ({
        offeringId: offering.id,
        gameMode,
      })),
      skipDuplicates: true,
    });
    const [title, description, type, verificationMode] = definition.requirement;
    await prisma.catalogueOfferingRequirement.createMany({
      data: [
        {
          seededKey: `${definition.key}:requirement`,
          offeringId: offering.id,
          title,
          description,
          type,
          isRequired: true,
          displayOrder: 10,
          verificationMode,
          customerGuidance:
            "Review this requirement before requesting support.",
        },
      ],
      skipDuplicates: true,
    });
  }

  await seedReferenceCatalogueOfferings(prisma, serviceIds, referenceSnapshot);

  const skillingServiceId = serviceIds.get("skill-training-request");
  if (skillingServiceId) {
    await prisma.skillingCalculatorRule.upsert({
      where: { serviceId: skillingServiceId },
      create: {
        serviceId: skillingServiceId,
        normalModeMultiplierBps: 0,
        ironmanMultiplierBps: 1000,
        hardcoreIronmanMultiplierBps: 2000,
        ultimateIronmanMultiplierBps: 3000,
        discordStreamEnabled: true,
        discordStreamPercentBps: 200,
        standardDeliveryEnabled: true,
        standardDeliveryLabel: "Standard",
        standardDeliveryDescription: "Standard review queue for skilling work.",
        standardDeliveryEstimate: "Estimate confirmed before checkout",
        standardDeliveryMultiplierBps: 0,
        standardDeliveryFixedFeeCents: 0,
        priorityDeliveryEnabled: false,
        priorityDeliveryLabel: "Priority",
        priorityDeliveryDescription: "Faster queue when staff capacity allows.",
        priorityDeliveryEstimate: "Faster estimate, client review required",
        priorityDeliveryMultiplierBps: 1500,
        priorityDeliveryFixedFeeCents: 0,
        expressDeliveryEnabled: false,
        expressDeliveryLabel: "Express",
        expressDeliveryDescription:
          "Fastest configured queue for eligible work.",
        expressDeliveryEstimate: "Fastest estimate, client review required",
        expressDeliveryMultiplierBps: 3000,
        expressDeliveryFixedFeeCents: 0,
        needsClientReview: true,
      },
      update: {},
    });

    const skillIds = new Map<SkillingSkillKey, string>();
    for (const [index, skill] of skillingSkillSeeds.entries()) {
      const record = await prisma.skillingSkillConfig.upsert({
        where: { seededKey: `skill-training:${skill.key.toLowerCase()}` },
        create: {
          seededKey: `skill-training:${skill.key.toLowerCase()}`,
          serviceId: skillingServiceId,
          skillKey: skill.key,
          name: skill.name,
          enabled: skill.enabled,
          displayOrder: (index + 1) * 10,
          iconKey: skill.icon,
        },
        update: {},
        select: { id: true },
      });
      skillIds.set(skill.key, record.id);
    }

    for (const method of skillingMethodSeeds) {
      const supplies = "supplies" in method ? method.supplies : undefined;
      await prisma.skillingTrainingMethod.upsert({
        where: { seededKey: `skill-training:${method.key}` },
        create: {
          seededKey: `skill-training:${method.key}`,
          serviceId: skillingServiceId,
          skillConfigId: skillIds.get(method.skillKey)!,
          slug: method.slug,
          name: method.name,
          shortDescription: method.summary,
          enabled: true,
          displayOrder: method.order,
          minimumLevel: method.min,
          maximumLevel: method.max,
          xpPerHour: method.xpPerHour,
          basePriceCentsPerMillionXp: method.centsPerMillion,
          minimumPriceCents: method.minimumCents,
          fixedFeeCents: method.fixedCents,
          suppliesEnabled: Boolean(supplies),
          ...(supplies
            ? {
                suppliesLabel: supplies.label,
                suppliesFeeCents: supplies.cents,
              }
            : { suppliesFeeCents: 0 }),
          notes:
            "Needs client review before launch. Seeded for calculator validation only.",
          needsClientReview: true,
        },
        update: {},
        select: { id: true },
      });
    }

    await seedReferenceSkillingMethods(
      prisma,
      skillingServiceId,
      skillIds,
      referenceSnapshot,
    );
  }

  const bossingServiceId = serviceIds.get("pvm-support");
  if (bossingServiceId) {
    await prisma.bossingCalculatorRule.upsert({
      where: { serviceId: bossingServiceId },
      create: {
        serviceId: bossingServiceId,
        normalModeMultiplierBps: 0,
        ironmanMultiplierBps: 1000,
        hardcoreIronmanMultiplierBps: 2000,
        ultimateIronmanMultiplierBps: 3000,
        discordStreamEnabled: true,
        discordStreamPercentBps: 200,
        standardDeliveryEnabled: true,
        standardDeliveryLabel: "Standard",
        standardDeliveryDescription: "Standard review queue for PvM work.",
        standardDeliveryEstimate: "Estimate confirmed before checkout",
        standardDeliveryMultiplierBps: 0,
        standardDeliveryFixedFeeCents: 0,
        priorityDeliveryEnabled: false,
        priorityDeliveryLabel: "Priority",
        priorityDeliveryDescription: "Faster queue when staff capacity allows.",
        priorityDeliveryEstimate: "Faster estimate, client review required",
        priorityDeliveryMultiplierBps: 1500,
        priorityDeliveryFixedFeeCents: 0,
        expressDeliveryEnabled: false,
        expressDeliveryLabel: "Express",
        expressDeliveryDescription:
          "Fastest configured queue for eligible PvM.",
        expressDeliveryEstimate: "Fastest estimate, client review required",
        expressDeliveryMultiplierBps: 3000,
        expressDeliveryFixedFeeCents: 0,
        needsClientReview: true,
      },
      update: {},
    });

    for (const [bossIndex, boss] of bossingBossSeeds.entries()) {
      const bossRecord = await prisma.bossingBossConfig.upsert({
        where: { seededKey: `pvm-support:${boss.key}` },
        create: {
          seededKey: `pvm-support:${boss.key}`,
          serviceId: bossingServiceId,
          bossKey: boss.key,
          name: boss.name,
          enabled: boss.enabled,
          displayOrder: boss.order || (bossIndex + 1) * 10,
          groupLabel: boss.group,
          iconKey: boss.icon,
          description: boss.description,
          needsClientReview: true,
        },
        update: {},
        select: { id: true },
      });

      for (const method of boss.methods) {
        const methodRecord = await prisma.bossingMethod.upsert({
          where: { seededKey: `pvm-support:${boss.key}:${method.key}` },
          create: {
            seededKey: `pvm-support:${boss.key}:${method.key}`,
            serviceId: bossingServiceId,
            bossId: bossRecord.id,
            slug: method.slug,
            name: method.name,
            shortDescription: method.summary,
            enabled: true,
            displayOrder: method.order,
            priceMode: method.priceMode,
            minimumKillCount: method.minKills,
            maximumKillCount: method.maxKills,
            basePriceCentsPerKill: method.centsPerKill,
            fixedPackagePriceCents: method.packageCents,
            minimumPriceCents: method.minimumCents,
            setupFeeCents: method.setupCents,
            difficultyTierLabel: method.tier,
            expectedRequirementsSummary: method.requirements,
            gearNotes: method.gearNotes,
            supplyNotes: method.supplyNotes,
            suppliesEnabled: Boolean(method.supplies),
            ...(method.supplies
              ? {
                  suppliesLabel: method.supplies.label,
                  suppliesFeeCents: method.supplies.cents,
                }
              : { suppliesFeeCents: 0 }),
            customerGearRequired: true,
            customerGearLabel: method.gear.label,
            gearAdjustmentCents: method.gear.adjustmentCents,
            estimatedKillsPerHour: method.killsPerHour,
            needsClientReview: true,
          },
          update: {},
          select: { id: true },
        });

        await prisma.bossingStatRequirement.createMany({
          data: method.stats.map(
            ([metricKey, label, requiredLevel], index) => ({
              seededKey: `pvm-support:${boss.key}:${method.key}:stat:${metricKey}`,
              methodId: methodRecord.id,
              metricKey,
              label,
              requiredLevel,
              displayOrder: (index + 1) * 10,
              verificationMode: "AUTOMATIC",
              customerGuidance:
                "This public stat can be checked by RSN when eligibility is enabled.",
              needsClientReview: true,
            }),
          ),
          skipDuplicates: true,
        });

        await prisma.bossingGearRequirement.createMany({
          data: method.gearRequirements.map(
            ([label, description, verificationMode], index) => ({
              seededKey: `pvm-support:${boss.key}:${method.key}:gear:${index + 1}`,
              methodId: methodRecord.id,
              label,
              description,
              isRequired: true,
              displayOrder: (index + 1) * 10,
              verificationMode,
              customerGuidance:
                verificationMode === "CUSTOMER_CONFIRMED"
                  ? "Confirm this before requesting review. Do not provide a RuneScape password."
                  : "Support verifies this requirement without inferring it from RSN.",
              needsClientReview: true,
            }),
          ),
          skipDuplicates: true,
        });
      }
    }

    await seedReferenceBossingMethods(
      prisma,
      bossingServiceId,
      referenceSnapshot,
    );

    const premiumServiceId = serviceIds.get("fire-cape-premium");
    if (!premiumServiceId) return;

    const premiumConfig = await prisma.premiumServiceConfig.upsert({
      where: { serviceId: premiumServiceId },
      create: {
        serviceId: premiumServiceId,
        configuratorType: "FIRE_CAPE",
        enabled: true,
        normalModeMultiplierBps: 0,
        ironmanMultiplierBps: 1000,
        hardcoreIronmanMultiplierBps: 2000,
        ultimateIronmanMultiplierBps: 3000,
        discordStreamEnabled: true,
        discordStreamPercentBps: 200,
        rsnEligibilityEnabled: true,
        supportsManualStatFallback: true,
        standardDeliveryEnabled: true,
        standardDeliveryLabel: "Standard",
        standardDeliveryDescription: "Standard review queue for premium work.",
        standardDeliveryEstimate: "Estimate confirmed before checkout",
        standardDeliveryMultiplierBps: 0,
        standardDeliveryFixedFeeCents: 0,
        priorityDeliveryEnabled: false,
        priorityDeliveryLabel: "Priority",
        priorityDeliveryDescription: "Faster queue when staff capacity allows.",
        priorityDeliveryEstimate: "Faster estimate, client review required",
        priorityDeliveryMultiplierBps: 1500,
        priorityDeliveryFixedFeeCents: 0,
        expressDeliveryEnabled: false,
        expressDeliveryLabel: "Express",
        expressDeliveryDescription:
          "Fastest configured queue for eligible premium work.",
        expressDeliveryEstimate: "Fastest estimate, client review required",
        expressDeliveryMultiplierBps: 3000,
        expressDeliveryFixedFeeCents: 0,
        needsClientReview: true,
      },
      update: {},
      select: { id: true },
    });

    const premiumPackageIds = new Map<string, string>();
    for (const premiumPackage of premiumPackageSeeds) {
      const packageRecord = await prisma.premiumPackage.upsert({
        where: { seededKey: `fire-cape-premium:${premiumPackage.key}` },
        create: {
          seededKey: `fire-cape-premium:${premiumPackage.key}`,
          serviceId: premiumServiceId,
          configId: premiumConfig.id,
          slug: premiumPackage.slug,
          name: premiumPackage.name,
          shortDescription: premiumPackage.summary,
          enabled: true,
          displayOrder: premiumPackage.order,
          basePriceCents: premiumPackage.baseCents,
          minimumPriceCents: premiumPackage.minimumCents,
          setupFeeCents: premiumPackage.setupCents,
          estimatedHours: premiumPackage.hours,
          difficultyTierLabel: premiumPackage.tier,
          requirementsSummary: premiumPackage.requirements,
          gearNotes: premiumPackage.gearNotes,
          unlockNotes: premiumPackage.unlockNotes,
          customerGearRequired: true,
          customerGearLabel: premiumPackage.gear.label,
          gearUnconfirmedAdjustmentCents: premiumPackage.gear.adjustmentCents,
          needsClientReview: true,
        },
        update: {},
        select: { id: true },
      });
      premiumPackageIds.set(premiumPackage.key, packageRecord.id);

      for (const [groupIndex, group] of premiumPackage.groups.entries()) {
        const groupRecord = await prisma.premiumRequirementGroup.upsert({
          where: {
            seededKey: `fire-cape-premium:${premiumPackage.key}:group:${group.key}`,
          },
          create: {
            seededKey: `fire-cape-premium:${premiumPackage.key}:group:${group.key}`,
            serviceId: premiumServiceId,
            configId: premiumConfig.id,
            packageId: packageRecord.id,
            title: group.title,
            description: group.description,
            displayOrder: (groupIndex + 1) * 10,
            needsClientReview: true,
          },
          update: {},
          select: { id: true },
        });

        const automaticRequirements =
          "requirements" in group && group.key === "stats"
            ? group.requirements.map(
                ([metricKey, label, description, requiredValue], index) => ({
                  seededKey: `fire-cape-premium:${premiumPackage.key}:${group.key}:auto:${metricKey}`,
                  groupId: groupRecord.id,
                  label,
                  description,
                  requirementType: "SKILL" as const,
                  isRequired: true,
                  displayOrder: (index + 1) * 10,
                  verificationMode: "AUTOMATIC" as const,
                  metricKey,
                  comparisonOperator: "GREATER_THAN_OR_EQUAL" as const,
                  requiredValue,
                  customerGuidance:
                    "This public stat can be checked by RSN when eligibility is enabled.",
                  needsClientReview: true,
                }),
              )
            : [];
        const manualRequirements =
          "requirements" in group && group.key !== "stats"
            ? group.requirements.map(
                ([label, description, verificationMode], index) => ({
                  seededKey: `fire-cape-premium:${premiumPackage.key}:${group.key}:manual:${index + 1}`,
                  groupId: groupRecord.id,
                  label,
                  description,
                  requirementType: label.toLowerCase().includes("gear")
                    ? ("GEAR" as const)
                    : ("UNLOCK" as const),
                  isRequired: true,
                  displayOrder: (index + 1) * 10,
                  verificationMode,
                  metricKey: null,
                  comparisonOperator: null,
                  requiredValue: null,
                  customerGuidance:
                    verificationMode === "CUSTOMER_CONFIRMED"
                      ? "Confirm this before requesting review. Do not provide a RuneScape password."
                      : "Support verifies this requirement without inferring it from RSN.",
                  needsClientReview: true,
                }),
              )
            : [];
        await prisma.premiumRequirement.createMany({
          data: [...automaticRequirements, ...manualRequirements],
          skipDuplicates: true,
        });
      }

      await prisma.premiumFaq.createMany({
        data: premiumPackage.faqs.map(([question, answer], index) => ({
          seededKey: `fire-cape-premium:${premiumPackage.key}:faq:${index + 1}`,
          serviceId: premiumServiceId,
          configId: premiumConfig.id,
          packageId: packageRecord.id,
          question,
          answer,
          enabled: true,
          displayOrder: (index + 1) * 10,
          needsClientReview: true,
        })),
        skipDuplicates: true,
      });
    }

    for (const option of premiumOptionSeeds) {
      await prisma.premiumOption.upsert({
        where: { seededKey: `fire-cape-premium:option:${option.key}` },
        create: {
          seededKey: `fire-cape-premium:option:${option.key}`,
          serviceId: premiumServiceId,
          configId: premiumConfig.id,
          packageId:
            option.key === "gear-gap-review"
              ? premiumPackageIds.get("standard-fire-cape")
              : undefined,
          slug: option.slug,
          name: option.name,
          description: option.description,
          enabled: true,
          displayOrder: option.order,
          optionType: option.type,
          pricingMode: option.pricingMode,
          fixedPriceCents: option.fixedCents,
          percentBps: option.percentBps,
          perUnitPriceCents: option.unitCents,
          minimumQuantity: option.min,
          maximumQuantity: option.max,
          defaultQuantity: option.defaultQuantity,
          customerInputRequired: option.pricingMode === "PER_UNIT",
          needsClientReview: true,
        },
        update: {},
        select: { id: true },
      });
    }

    const infernalServiceId = serviceIds.get("infernal-cape-premium");
    if (!infernalServiceId) return;
    const infernalReference = requireReferenceRecord(
      referenceSnapshot,
      "pvm",
      "pvm-kill",
      "inferno",
    );
    const infernalConfig = await prisma.premiumServiceConfig.upsert({
      where: { serviceId: infernalServiceId },
      create: {
        serviceId: infernalServiceId,
        configuratorType: "INFERNAL_CAPE",
        enabled: true,
        normalModeMultiplierBps: 0,
        ironmanMultiplierBps: 1000,
        hardcoreIronmanMultiplierBps: 2000,
        ultimateIronmanMultiplierBps: 3000,
        discordStreamEnabled: true,
        discordStreamPercentBps: 200,
        rsnEligibilityEnabled: false,
        supportsManualStatFallback: true,
        standardDeliveryEnabled: true,
        standardDeliveryLabel: "Normal login service",
        standardDeliveryDescription:
          "The enabled standard service method. Never provide a bank PIN or authenticator code.",
        standardDeliveryEstimate: "Timing confirmed from the selected setup",
        standardDeliveryMultiplierBps: 0,
        standardDeliveryFixedFeeCents: 0,
        priorityDeliveryEnabled: false,
        priorityDeliveryLabel: "Remote / Parsec service",
        priorityDeliveryDescription:
          "Disabled until the business explicitly enables and configures this method.",
        priorityDeliveryEstimate: null,
        priorityDeliveryMultiplierBps: 0,
        priorityDeliveryFixedFeeCents: 0,
        expressDeliveryEnabled: false,
        expressDeliveryLabel: "Express start",
        expressDeliveryDescription:
          "Disabled until capacity and pricing are approved.",
        expressDeliveryEstimate: null,
        expressDeliveryMultiplierBps: 0,
        expressDeliveryFixedFeeCents: 0,
        needsClientReview: true,
      },
      update: {},
      select: { id: true },
    });

    const infernalWeapons = [
      {
        key: "twisted-bow",
        name: "Twisted Bow setup",
        summary:
          "Infernal Cape configuration using a customer-confirmed Twisted Bow setup.",
        order: 10,
      },
      {
        key: "bowfa",
        name: "Bow of Faerdhinen setup",
        summary:
          "Infernal Cape configuration using a customer-confirmed Bowfa setup.",
        order: 20,
      },
      {
        key: "armadyl-crossbow",
        name: "Armadyl Crossbow setup",
        summary:
          "Infernal Cape configuration using a customer-confirmed ACB setup.",
        order: 30,
      },
    ] as const;

    for (const weapon of infernalWeapons) {
      const packageRecord = await prisma.premiumPackage.upsert({
        where: { seededKey: `infernal-cape-premium:${weapon.key}` },
        create: {
          seededKey: `infernal-cape-premium:${weapon.key}`,
          serviceId: infernalServiceId,
          configId: infernalConfig.id,
          slug: weapon.key,
          name: weapon.name,
          shortDescription: weapon.summary,
          enabled: true,
          displayOrder: weapon.order,
          basePriceCents: infernalReference.priceCents,
          minimumPriceCents: infernalReference.priceCents,
          setupFeeCents: 0,
          estimatedHours: null,
          difficultyTierLabel: "End-game",
          requirementsSummary:
            "Combat stats, prayers, supplies, access and the complete gear setup are reviewed before scheduling.",
          gearNotes:
            "The selected weapon package is customer-confirmed. Staff verifies the complete setup without inferring bank or inventory contents.",
          unlockNotes:
            "Inferno access and other non-public account details are support verified.",
          customerGearRequired: true,
          customerGearLabel: "Customer confirms the selected Infernal setup",
          gearUnconfirmedAdjustmentCents: 0,
          needsClientReview: true,
        },
        update: {},
        select: { id: true },
      });
      const group = await prisma.premiumRequirementGroup.upsert({
        where: { seededKey: `infernal-cape-premium:${weapon.key}:stats` },
        create: {
          seededKey: `infernal-cape-premium:${weapon.key}:stats`,
          serviceId: infernalServiceId,
          configId: infernalConfig.id,
          packageId: packageRecord.id,
          title: "Combat levels and setup",
          description:
            "Enter current public combat levels and confirm non-public gear separately.",
          displayOrder: 10,
          needsClientReview: true,
        },
        update: {},
        select: { id: true },
      });
      await prisma.premiumRequirement.createMany({
        data: [
          ["skill.ranged.level", "Ranged level", 70],
          ["skill.magic.level", "Magic level", 70],
          ["skill.defence.level", "Defence level", 1],
          ["skill.prayer.level", "Prayer level", 43],
        ].map(([metricKey, label, requiredValue], index) => ({
          seededKey: `infernal-cape-premium:${weapon.key}:${metricKey}`,
          groupId: group.id,
          label: String(label),
          description: `Enter the account's current ${String(label).toLowerCase()} for configuration review.`,
          requirementType: "SKILL" as const,
          isRequired: true,
          displayOrder: (index + 1) * 10,
          verificationMode: "AUTOMATIC" as const,
          metricKey: String(metricKey),
          comparisonOperator: "GREATER_THAN_OR_EQUAL" as const,
          requiredValue: Number(requiredValue),
          customerGuidance:
            "Use RSN lookup only when enabled; otherwise enter the public level manually.",
          needsClientReview: true,
        })),
        skipDuplicates: true,
      });
    }

    const infernalOptions = [
      [
        "rigour-unavailable",
        "Rigour unavailable",
        "Record that Rigour is not available.",
      ],
      [
        "blowpipe-unavailable",
        "Blowpipe unavailable",
        "Record that a Blowpipe is not available.",
      ],
      [
        "slayer-task",
        "Inferno Slayer task",
        "Record that an Inferno Slayer task is active.",
      ],
      ["pure-build", "Pure", "Configure this order for a Pure account build."],
      [
        "one-defence-build",
        "1 Defence",
        "Configure this order for a 1 Defence account build.",
      ],
      [
        "zerker-build",
        "Zerker",
        "Configure this order for a Zerker account build.",
      ],
      [
        "restricted-build",
        "Restricted Build",
        "Configure another restricted account build for support review.",
      ],
    ] as const;
    for (const [slug, name, description] of infernalOptions) {
      await prisma.premiumOption.upsert({
        where: { seededKey: `infernal-cape-premium:option:${slug}` },
        create: {
          seededKey: `infernal-cape-premium:option:${slug}`,
          serviceId: infernalServiceId,
          configId: infernalConfig.id,
          slug,
          name,
          description,
          enabled: true,
          displayOrder:
            infernalOptions.findIndex((item) => item[0] === slug) * 10 + 10,
          optionType: slug.includes("build")
            ? "UNLOCK_SUPPORT"
            : "GEAR_SUPPORT",
          pricingMode: "FIXED_FEE",
          fixedPriceCents: 0,
          percentBps: 0,
          perUnitPriceCents: 0,
          minimumQuantity: 1,
          maximumQuantity: 1,
          defaultQuantity: 1,
          customerInputRequired: false,
          needsClientReview: true,
        },
        update: {},
        select: { id: true },
      });
    }
  }
}
