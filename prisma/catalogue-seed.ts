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
          | "PREMIUM_SERVICE_CONFIGURATOR";
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
        estimatedHours: number;
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
        metricKey?: string;
        requiredValue?: number;
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
  priorityDeliveryEstimate: string;
  priorityDeliveryMultiplierBps: number;
  priorityDeliveryFixedFeeCents: number;
  expressDeliveryEnabled: boolean;
  expressDeliveryLabel: string;
  expressDeliveryDescription: string;
  expressDeliveryEstimate: string;
  expressDeliveryMultiplierBps: number;
  expressDeliveryFixedFeeCents: number;
  needsClientReview: true;
};

type BossingPriceMode = "PER_KILL" | "FIXED_PACKAGE";

type BossingRuleSeedCreate = SkillingRuleSeedCreate;

type PremiumRuleSeedCreate = SkillingRuleSeedCreate & {
  rsnEligibilityEnabled: boolean;
};

export const catalogueCategorySeeds = [
  ["power-levelling", "Power Levelling", "activity"],
  ["quests", "Quests", "scroll"],
  ["achievement-diaries", "Achievement Diaries", "map"],
  ["combat-achievements", "Combat Achievements", "badge"],
  ["minigames", "Minigames", "flag"],
  ["bossing-pvm", "Bossing and PvM", "swords"],
  ["premium-services", "Premium Services", "crown"],
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
  { key: "STRENGTH", name: "Strength", icon: "strength", enabled: false },
  { key: "DEFENCE", name: "Defence", icon: "shield", enabled: false },
  { key: "RANGED", name: "Ranged", icon: "bow", enabled: false },
  { key: "PRAYER", name: "Prayer", icon: "prayer", enabled: false },
  { key: "MAGIC", name: "Magic", icon: "magic", enabled: false },
  { key: "RUNECRAFT", name: "Runecraft", icon: "rune", enabled: false },
  { key: "CONSTRUCTION", name: "Construction", icon: "house", enabled: false },
  { key: "HITPOINTS", name: "Hitpoints", icon: "heart", enabled: false },
  { key: "AGILITY", name: "Agility", icon: "footprints", enabled: true },
  { key: "HERBLORE", name: "Herblore", icon: "flask", enabled: false },
  { key: "THIEVING", name: "Thieving", icon: "mask", enabled: false },
  { key: "CRAFTING", name: "Crafting", icon: "gem", enabled: false },
  { key: "FLETCHING", name: "Fletching", icon: "arrow", enabled: false },
  { key: "SLAYER", name: "Slayer", icon: "skull", enabled: false },
  { key: "HUNTER", name: "Hunter", icon: "trap", enabled: false },
  { key: "MINING", name: "Mining", icon: "pickaxe", enabled: true },
  { key: "SMITHING", name: "Smithing", icon: "anvil", enabled: false },
  { key: "FISHING", name: "Fishing", icon: "fish", enabled: false },
  { key: "COOKING", name: "Cooking", icon: "flame", enabled: true },
  { key: "FIREMAKING", name: "Firemaking", icon: "campfire", enabled: false },
  { key: "WOODCUTTING", name: "Woodcutting", icon: "axe", enabled: false },
  { key: "FARMING", name: "Farming", icon: "sprout", enabled: false },
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
        centsPerKill: 65,
        packageCents: 0,
        minimumCents: 500,
        setupCents: 150,
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
        priceMode: "FIXED_PACKAGE" as const,
        minKills: 10,
        maxKills: 100,
        centsPerKill: 0,
        packageCents: 1800,
        minimumCents: 1800,
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
      "Representative advanced PvM configuration. Rates are placeholders that require client review.",
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
        minKills: 5,
        maxKills: 200,
        centsPerKill: 220,
        packageCents: 0,
        minimumCents: 1400,
        setupCents: 300,
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
    baseCents: 2499,
    minimumCents: 2499,
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
    baseCents: 1999,
    minimumCents: 1999,
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

export async function seedCatalogue(prisma: CatalogueSeedClient) {
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

    const premiumServiceId = serviceIds.get("fire-cape-premium");
    if (!premiumServiceId) return;

    const premiumConfig = await prisma.premiumServiceConfig.upsert({
      where: { serviceId: premiumServiceId },
      create: {
        serviceId: premiumServiceId,
        normalModeMultiplierBps: 0,
        ironmanMultiplierBps: 1000,
        hardcoreIronmanMultiplierBps: 2000,
        ultimateIronmanMultiplierBps: 3000,
        discordStreamEnabled: true,
        discordStreamPercentBps: 200,
        rsnEligibilityEnabled: true,
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
                  isRequired: true,
                  displayOrder: (index + 1) * 10,
                  verificationMode: "AUTOMATIC" as const,
                  metricKey,
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
                  isRequired: true,
                  displayOrder: (index + 1) * 10,
                  verificationMode,
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
  }
}
