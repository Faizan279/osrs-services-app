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
        engineType: "CATALOGUE_CARD" | "SKILLING_CALCULATOR" | "BOSSING_ENGINE";
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
] as const;

export async function seedCatalogue(prisma: CatalogueSeedClient) {
  const categoryIds = new Map<string, string>();

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
}
