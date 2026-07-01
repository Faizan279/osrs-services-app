import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  matchesCatalogueSearch,
  publicServiceSelect,
} from "@/lib/catalogue/public-select";
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
      include: { category: true, gameModes: true },
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
  return prisma.catalogueService.findUnique({
    where: { id },
    include: {
      category: true,
      gameModes: { orderBy: { gameMode: "asc" } },
      requirements: { orderBy: [{ displayOrder: "asc" }, { title: "asc" }] },
      mediaReferences: {
        orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
      },
      revisions: {
        orderBy: { revisionNumber: "desc" },
        include: { actor: { select: { name: true, email: true } } },
      },
      createdBy: { select: { name: true, email: true } },
      updatedBy: { select: { name: true, email: true } },
    },
  });
}
