import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  matchesCatalogueSearch,
  publicOfferingSelect,
  publicServiceSelect,
} from "@/lib/catalogue/public-select";
import { stagedCatalogueAggregateSchema } from "@/lib/catalogue/staging";
import { prisma } from "@/lib/db/prisma";

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

  if (!search) return services;
  return services.filter((service) => matchesCatalogueSearch(service, search));
}

export async function getPublicCategory(slug: string, now = new Date()) {
  return prisma.catalogueCategory.findFirst({
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
}

export async function getPublicService(
  categorySlug: string,
  serviceSlug: string,
  now = new Date(),
) {
  return prisma.catalogueService.findFirst({
    where: {
      ...publicCatalogueWhere(now),
      slug: serviceSlug,
      category: { slug: categorySlug, isActive: true },
    },
    select: publicServiceSelect,
  });
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
    ...(gameMode
      ? {
          OR: [
            { gameModes: { none: {} } },
            { gameModes: { some: { gameMode: gameMode as never } } },
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
    prisma.catalogueOffering.findMany({
      where,
      orderBy,
      skip: (boundedPage - 1) * boundedPageSize,
      take: boundedPageSize,
      select: publicOfferingSelect,
    }),
    prisma.catalogueOffering.count({ where }),
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
      ...offering,
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
      key: { in: ["catalogue_card_engine_enabled", "rsn_eligibility_enabled"] },
    },
    select: { key: true, enabled: true },
  });
  return Object.fromEntries(
    flags.map((flag) => [flag.key, flag.enabled]),
  ) as Record<string, boolean>;
}
