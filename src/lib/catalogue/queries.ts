import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { catalogueGameModes } from "@/lib/catalogue/constants";
import {
  safeRequirementNumber,
  type RequirementNumericValue,
} from "@/lib/catalogue/numeric";
import {
  matchesCatalogueSearch,
  publicOfferingSelect,
  publicServiceSelect,
} from "@/lib/catalogue/public-select";
import { stagedCatalogueAggregateSchema } from "@/lib/catalogue/staging";
import { prisma } from "@/lib/db/prisma";

function serializeRequirementValue<
  T extends { requiredValue: RequirementNumericValue },
>(requirement: T) {
  return {
    ...requirement,
    requiredValue: safeRequirementNumber(requirement.requiredValue),
  };
}

function serializePublicService<
  T extends { requirements: Array<{ requiredValue: RequirementNumericValue }> },
>(service: T) {
  return {
    ...service,
    requirements: service.requirements.map(serializeRequirementValue),
  };
}

function serializePublicOffering<
  T extends { requirements: Array<{ requiredValue: RequirementNumericValue }> },
>(offering: T) {
  return {
    ...offering,
    requirements: offering.requirements.map(serializeRequirementValue),
  };
}

export function publicCatalogueWhere(
  now = new Date(),
): Prisma.CatalogueServiceWhereInput {
  return {
    publicationStatus: "PUBLISHED",
    category: { isActive: true },
    AND: [
      { OR: [{ publishAt: null }, { publishAt: { lte: now } }] },
      { OR: [{ unpublishAt: null }, { unpublishAt: { gt: now } }] },
    ],
  };
}

export async function getPublicCategories(now = new Date()) {
  return prisma.catalogueCategory.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      _count: {
        select: { services: { where: publicCatalogueWhere(now) } },
      },
    },
  });
}

export async function getPublicServices({
  search,
  categorySlug,
  now = new Date(),
}: {
  search?: string;
  categorySlug?: string;
  now?: Date;
}) {
  const services = await prisma.catalogueService.findMany({
    where: {
      ...publicCatalogueWhere(now),
      ...(categorySlug
        ? { category: { slug: categorySlug, isActive: true } }
        : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { shortSummary: { contains: search } },
              { content: { contains: search } },
            ],
          }
        : {}),
    },
    orderBy: [{ isFeatured: "desc" }, { displayOrder: "asc" }, { name: "asc" }],
    select: publicServiceSelect,
  });

  const visibleServices = search
    ? services.filter((service) => matchesCatalogueSearch(service, search))
    : services;
  return visibleServices.map(serializePublicService);
}

export async function getPublicCategory(slug: string, now = new Date()) {
  const category = await prisma.catalogueCategory.findFirst({
    where: { slug, isActive: true },
    include: {
      services: {
        where: publicCatalogueWhere(now),
        orderBy: [
          { isFeatured: "desc" },
          { displayOrder: "asc" },
          { name: "asc" },
        ],
        select: publicServiceSelect,
      },
    },
  });
  if (!category) return null;
  return {
    ...category,
    services: category.services.map(serializePublicService),
  };
}

export async function getPublicService(
  categorySlug: string,
  serviceSlug: string,
  now = new Date(),
) {
  const service = await prisma.catalogueService.findFirst({
    where: {
      ...publicCatalogueWhere(now),
      slug: serviceSlug,
      category: { slug: categorySlug, isActive: true },
    },
    select: publicServiceSelect,
  });
  return service ? serializePublicService(service) : null;
}

export async function getPublicCatalogueCardService({
  categorySlug,
  serviceSlug,
  search = "",
  gameMode,
  facets = [],
  sort = "featured",
  page = 1,
  pageSize = 9,
  now = new Date(),
}: {
  categorySlug: string;
  serviceSlug: string;
  search?: string;
  gameMode?: string;
  facets?: Array<{ key: string; value: string }>;
  sort?: "featured" | "name" | "order";
  page?: number;
  pageSize?: number;
  now?: Date;
}) {
  const service = await getPublicService(categorySlug, serviceSlug, now);
  if (!service || service.engineType !== "CATALOGUE_CARD") return null;
  const requestedGameMode = gameMode?.toUpperCase();
  const supportedGameMode =
    requestedGameMode &&
    catalogueGameModes.includes(requestedGameMode as never) &&
    service.gameModes.some(({ gameMode }) => gameMode === requestedGameMode)
      ? requestedGameMode
      : null;
  const boundedPage = Math.max(1, page);
  const boundedPageSize = Math.min(24, Math.max(1, pageSize));
  const where: Prisma.CatalogueOfferingWhereInput = {
    serviceId: service.id,
    isActive: true,
    ...(search
      ? {
          OR: [
            { name: { contains: search.slice(0, 80) } },
            { shortSummary: { contains: search.slice(0, 80) } },
            { description: { contains: search.slice(0, 80) } },
          ],
        }
      : {}),
    ...(supportedGameMode
      ? {
          OR: [
            { gameModes: { none: {} } },
            { gameModes: { some: { gameMode: supportedGameMode as never } } },
          ],
        }
      : {}),
    ...(facets.length
      ? {
          AND: facets.map((facet) => ({
            facets: { some: { facetKey: facet.key, facetValue: facet.value } },
          })),
        }
      : {}),
  };
  const orderBy: Prisma.CatalogueOfferingOrderByWithRelationInput[] =
    sort === "name"
      ? [{ name: "asc" }]
      : sort === "order"
        ? [{ displayOrder: "asc" }, { name: "asc" }]
        : [{ isFeatured: "desc" }, { displayOrder: "asc" }, { name: "asc" }];
  const [offerings, total, facetRows] = await Promise.all([
    supportedGameMode || !gameMode
      ? prisma.catalogueOffering.findMany({
          where,
          orderBy,
          skip: (boundedPage - 1) * boundedPageSize,
          take: boundedPageSize,
          select: publicOfferingSelect,
        })
      : Promise.resolve([]),
    supportedGameMode || !gameMode
      ? prisma.catalogueOffering.count({ where })
      : Promise.resolve(0),
    prisma.catalogueOfferingFacet.findMany({
      where: { offering: { serviceId: service.id, isActive: true } },
      orderBy: [{ facetKey: "asc" }, { displayOrder: "asc" }, { label: "asc" }],
      select: { facetKey: true, facetValue: true, label: true },
      distinct: ["facetKey", "facetValue"],
    }),
  ]);
  return {
    service,
    offerings: offerings.map((offering) => ({
      ...serializePublicOffering(offering),
      effectiveGameModes:
        offering.gameModes.length > 0 ? offering.gameModes : service.gameModes,
    })),
    total,
    page: boundedPage,
    pages: Math.max(1, Math.ceil(total / boundedPageSize)),
    pageSize: boundedPageSize,
    availableFacets: facetRows,
  };
}

export async function getCatalogueOverview() {
  const [categories, drafts, published, archived, limited, review, activity] =
    await Promise.all([
      prisma.catalogueCategory.count(),
      prisma.catalogueService.count({ where: { publicationStatus: "DRAFT" } }),
      prisma.catalogueService.count({
        where: { publicationStatus: "PUBLISHED" },
      }),
      prisma.catalogueService.count({
        where: { publicationStatus: "ARCHIVED" },
      }),
      prisma.catalogueService.count({
        where: { availabilityState: { in: ["PAUSED", "UNAVAILABLE"] } },
      }),
      prisma.catalogueService.count({ where: { needsClientReview: true } }),
      prisma.auditLog.findMany({
        where: {
          targetType: { in: ["CatalogueCategory", "CatalogueService"] },
        },
        orderBy: { createdAt: "desc" },
        take: 8,
        include: { actor: { select: { name: true, email: true } } },
      }),
    ]);

  return { categories, drafts, published, archived, limited, review, activity };
}

export async function getAdminCategories(search = "", active = "") {
  return prisma.catalogueCategory.findMany({
    where: {
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { slug: { contains: search } },
            ],
          }
        : {}),
      ...(active === "true"
        ? { isActive: true }
        : active === "false"
          ? { isActive: false }
          : {}),
    },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { services: true } },
    },
  });
}

export async function getAdminCategory(id: string) {
  return prisma.catalogueCategory.findUnique({
    where: { id },
    include: { _count: { select: { services: true } } },
  });
}

export async function getAdminServices({
  search = "",
  category = "",
  status = "",
  availability = "",
  engine = "",
  featured = "",
  sort = "updated",
  page = 1,
  pageSize = 12,
}: {
  search?: string;
  category?: string;
  status?: string;
  availability?: string;
  engine?: string;
  featured?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
}) {
  const where: Prisma.CatalogueServiceWhereInput = {
    ...(search
      ? {
          OR: [
            { name: { contains: search } },
            { slug: { contains: search } },
            { shortSummary: { contains: search } },
          ],
        }
      : {}),
    ...(category ? { categoryId: category } : {}),
    ...(status ? { publicationStatus: status as never } : {}),
    ...(availability ? { availabilityState: availability as never } : {}),
    ...(engine ? { engineType: engine as never } : {}),
    ...(featured === "true" ? { isFeatured: true } : {}),
    ...(featured === "false" ? { isFeatured: false } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.catalogueService.findMany({
      where,
      orderBy:
        sort === "name"
          ? [{ name: "asc" }]
          : sort === "order"
            ? [{ displayOrder: "asc" }, { name: "asc" }]
            : [{ updatedAt: "desc" }, { name: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        category: true,
        gameModes: true,
        stage: { select: { id: true, version: true } },
      },
    }),
    prisma.catalogueService.count({ where }),
  ]);

  return {
    items,
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

export async function getAdminService(id: string) {
  const service = await prisma.catalogueService.findUnique({
    where: { id },
    include: {
      category: true,
      stage: true,
      gameModes: { orderBy: { gameMode: "asc" } },
      requirements: { orderBy: [{ displayOrder: "asc" }, { title: "asc" }] },
      mediaReferences: {
        orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
      },
      offerings: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        include: {
          gameModes: { orderBy: { gameMode: "asc" } },
          facets: { orderBy: [{ displayOrder: "asc" }, { label: "asc" }] },
          requirements: {
            orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
          },
        },
      },
      skillingRule: true,
      skillingSkills: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        include: {
          methods: {
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          },
        },
      },
      bossingRule: true,
      bossingBosses: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        include: {
          methods: {
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
            include: {
              statRequirements: {
                orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
              },
              gearRequirements: {
                orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
              },
            },
          },
        },
      },
      premiumConfig: true,
      premiumPackages: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        include: {
          requirementGroups: {
            orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
            include: {
              requirements: {
                orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
              },
            },
          },
          faqs: {
            orderBy: [{ displayOrder: "asc" }, { question: "asc" }],
          },
        },
      },
      premiumOptions: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        include: { actor: { select: { name: true, email: true } } },
      },
      createdBy: { select: { name: true, email: true } },
      updatedBy: { select: { name: true, email: true } },
    },
  });
  if (!service) return null;
  const hasPublicationHistory = service.revisions.some(
    ({ event }) => event === "PUBLISHED" || event === "REPUBLISHED",
  );
  if (!service.stage) {
    return {
      ...service,
      hasPendingChanges: false as const,
      hasPublicationHistory,
      publishedVersion: null,
    };
  }

  const snapshot = stagedCatalogueAggregateSchema.parse(service.stage.snapshot);
  const category =
    snapshot.service.categoryId === service.categoryId
      ? service.category
      : await prisma.catalogueCategory.findUniqueOrThrow({
          where: { id: snapshot.service.categoryId },
        });
  return {
    ...service,
    ...snapshot.service,
    publishAt: snapshot.service.publishAt
      ? new Date(snapshot.service.publishAt)
      : null,
    unpublishAt: snapshot.service.unpublishAt
      ? new Date(snapshot.service.unpublishAt)
      : null,
    category,
    gameModes: snapshot.gameModes.map((gameMode) => ({ gameMode })),
    requirements: snapshot.requirements,
    mediaReferences: snapshot.mediaReferences,
    offerings: snapshot.offerings.map((offering) => ({
      ...offering,
      gameModes: offering.gameModes.map((gameMode) => ({ gameMode })),
    })),
    skillingRule: snapshot.skilling?.rule ?? null,
    skillingSkills:
      snapshot.skilling?.skills.map((skill) => ({
        ...skill,
        methods: skill.methods,
      })) ?? [],
    bossingRule: snapshot.bossing?.rule ?? null,
    bossingBosses:
      snapshot.bossing?.bosses.map((boss) => ({
        ...boss,
        methods: boss.methods,
      })) ?? [],
    premiumConfig: snapshot.premium?.rule ?? null,
    premiumPackages:
      snapshot.premium?.packages.map((premiumPackage) => ({
        ...premiumPackage,
        requirementGroups: premiumPackage.requirementGroups,
        faqs: premiumPackage.faqs,
      })) ?? [],
    premiumOptions: snapshot.premium?.options ?? [],
    version: service.stage.version,
    updatedAt: service.stage.updatedAt,
    hasPendingChanges: true as const,
    hasPublicationHistory,
    publishedVersion: {
      name: service.name,
      category: service.category,
      slug: service.slug,
      version: service.version,
      updatedAt: service.updatedAt,
    },
  };
}

export async function getPrerequisiteServiceOptions(excludeServiceId: string) {
  return prisma.catalogueService.findMany({
    where: { publicationStatus: "PUBLISHED", id: { not: excludeServiceId } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

export async function getCatalogueFeatureFlags() {
  const flags = await prisma.featureFlag.findMany({
    where: {
      key: {
        in: [
          "catalogue_card_engine_enabled",
          "rsn_eligibility_enabled",
          "skilling_calculator_enabled",
          "bossing_calculator_enabled",
          "premium_configurator_enabled",
        ],
      },
    },
    select: { key: true, enabled: true },
  });
  return Object.fromEntries(
    flags.map((flag) => [flag.key, flag.enabled]),
  ) as Record<string, boolean>;
}

export async function getPublicSkillingCalculatorService({
  categorySlug,
  serviceSlug,
  now = new Date(),
}: {
  categorySlug: string;
  serviceSlug: string;
  now?: Date;
}) {
  const service = await getPublicService(categorySlug, serviceSlug, now);
  if (!service || service.engineType !== "SKILLING_CALCULATOR") return null;
  const [skills, rule] = await Promise.all([
    prisma.skillingSkillConfig.findMany({
      where: { serviceId: service.id, enabled: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        skillKey: true,
        name: true,
        iconKey: true,
        methods: {
          where: { enabled: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          select: {
            slug: true,
            name: true,
            shortDescription: true,
            minimumLevel: true,
            maximumLevel: true,
            xpPerHour: true,
            suppliesEnabled: true,
            suppliesLabel: true,
          },
        },
      },
    }),
    prisma.skillingCalculatorRule.findUnique({
      where: { serviceId: service.id },
      select: {
        discordStreamEnabled: true,
        standardDeliveryEnabled: true,
        standardDeliveryLabel: true,
        standardDeliveryDescription: true,
        standardDeliveryEstimate: true,
        priorityDeliveryEnabled: true,
        priorityDeliveryLabel: true,
        priorityDeliveryDescription: true,
        priorityDeliveryEstimate: true,
        expressDeliveryEnabled: true,
        expressDeliveryLabel: true,
        expressDeliveryDescription: true,
        expressDeliveryEstimate: true,
      },
    }),
  ]);
  return { service, skills, rule };
}

export async function getPublicBossingCalculatorService({
  categorySlug,
  serviceSlug,
  now = new Date(),
}: {
  categorySlug: string;
  serviceSlug: string;
  now?: Date;
}) {
  const service = await getPublicService(categorySlug, serviceSlug, now);
  if (!service || service.engineType !== "BOSSING_ENGINE") return null;
  const [bosses, rule] = await Promise.all([
    prisma.bossingBossConfig.findMany({
      where: { serviceId: service.id, enabled: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        bossKey: true,
        name: true,
        groupLabel: true,
        iconKey: true,
        description: true,
        methods: {
          where: { enabled: true },
          orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          select: {
            slug: true,
            name: true,
            shortDescription: true,
            priceMode: true,
            minimumKillCount: true,
            maximumKillCount: true,
            difficultyTierLabel: true,
            expectedRequirementsSummary: true,
            gearNotes: true,
            supplyNotes: true,
            suppliesEnabled: true,
            suppliesLabel: true,
            customerGearRequired: true,
            customerGearLabel: true,
            estimatedKillsPerHour: true,
            statRequirements: {
              orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
              select: {
                metricKey: true,
                label: true,
                requiredLevel: true,
                verificationMode: true,
                customerGuidance: true,
              },
            },
            gearRequirements: {
              orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
              select: {
                label: true,
                description: true,
                isRequired: true,
                verificationMode: true,
                customerGuidance: true,
              },
            },
          },
        },
      },
    }),
    prisma.bossingCalculatorRule.findUnique({
      where: { serviceId: service.id },
      select: {
        discordStreamEnabled: true,
        standardDeliveryEnabled: true,
        standardDeliveryLabel: true,
        standardDeliveryDescription: true,
        standardDeliveryEstimate: true,
        priorityDeliveryEnabled: true,
        priorityDeliveryLabel: true,
        priorityDeliveryDescription: true,
        priorityDeliveryEstimate: true,
        expressDeliveryEnabled: true,
        expressDeliveryLabel: true,
        expressDeliveryDescription: true,
        expressDeliveryEstimate: true,
      },
    }),
  ]);
  return { service, bosses, rule };
}

export async function getPublicPremiumConfiguratorService({
  categorySlug,
  serviceSlug,
  now = new Date(),
}: {
  categorySlug: string;
  serviceSlug: string;
  now?: Date;
}) {
  const service = await getPublicService(categorySlug, serviceSlug, now);
  if (!service || service.engineType !== "PREMIUM_SERVICE_CONFIGURATOR") {
    return null;
  }
  const [packages, options, rule] = await Promise.all([
    prisma.premiumPackage.findMany({
      where: { serviceId: service.id, enabled: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        slug: true,
        name: true,
        shortDescription: true,
        displayOrder: true,
        estimatedHours: true,
        difficultyTierLabel: true,
        requirementsSummary: true,
        gearNotes: true,
        unlockNotes: true,
        customerGearRequired: true,
        customerGearLabel: true,
        requirementGroups: {
          orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
          select: {
            title: true,
            description: true,
            requirements: {
              orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
              select: {
                label: true,
                description: true,
                requirementType: true,
                isRequired: true,
                verificationMode: true,
                metricKey: true,
                comparisonOperator: true,
                requiredValue: true,
                customerGuidance: true,
              },
            },
          },
        },
        faqs: {
          where: { enabled: true },
          orderBy: [{ displayOrder: "asc" }, { question: "asc" }],
          select: {
            question: true,
            answer: true,
          },
        },
      },
    }),
    prisma.premiumOption.findMany({
      where: { serviceId: service.id, enabled: true },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: {
        packageId: true,
        package: { select: { slug: true } },
        slug: true,
        name: true,
        description: true,
        displayOrder: true,
        optionType: true,
        pricingMode: true,
        minimumQuantity: true,
        maximumQuantity: true,
        defaultQuantity: true,
        customerInputRequired: true,
      },
    }),
    prisma.premiumServiceConfig.findFirst({
      where: { serviceId: service.id, enabled: true },
      select: {
        configuratorType: true,
        enabled: true,
        discordStreamEnabled: true,
        rsnEligibilityEnabled: true,
        supportsManualStatFallback: true,
        standardDeliveryEnabled: true,
        standardDeliveryLabel: true,
        standardDeliveryDescription: true,
        standardDeliveryEstimate: true,
        priorityDeliveryEnabled: true,
        priorityDeliveryLabel: true,
        priorityDeliveryDescription: true,
        priorityDeliveryEstimate: true,
        expressDeliveryEnabled: true,
        expressDeliveryLabel: true,
        expressDeliveryDescription: true,
        expressDeliveryEstimate: true,
      },
    }),
  ]);
  return { service, packages, options, rule };
}
