import type { Prisma } from "@/generated/prisma/client";

export const publicRequirementSelect = {
  id: true,
  title: true,
  description: true,
  type: true,
  isRequired: true,
  displayOrder: true,
  verificationMode: true,
  customerGuidance: true,
  metricKey: true,
  comparisonOperator: true,
  requiredValue: true,
  recommendedService: {
    select: {
      name: true,
      slug: true,
      publicationStatus: true,
      publishAt: true,
      unpublishAt: true,
      category: { select: { slug: true, isActive: true } },
    },
  },
} satisfies Prisma.CatalogueRequirementSelect;

// Explicitly omit private notes, legacy metadata and actor relations.
export const publicServiceSelect = {
  id: true,
  name: true,
  slug: true,
  canonicalSlug: true,
  shortSummary: true,
  content: true,
  serviceType: true,
  engineType: true,
  publicationStatus: true,
  availabilityState: true,
  isFeatured: true,
  isQuoteOnly: true,
  displayOrder: true,
  publicPreparationNotes: true,
  seoTitle: true,
  seoDescription: true,
  publishAt: true,
  unpublishAt: true,
  updatedAt: true,
  category: {
    select: {
      id: true,
      name: true,
      slug: true,
      shortDescription: true,
      description: true,
      iconKey: true,
      imagePath: true,
      displayOrder: true,
      isActive: true,
      seoTitle: true,
      seoDescription: true,
    },
  },
  gameModes: { orderBy: { gameMode: "asc" as const } },
  requirements: {
    orderBy: [{ displayOrder: "asc" as const }, { title: "asc" as const }],
    select: publicRequirementSelect,
  },
  mediaReferences: {
    where: { isPrimary: true },
    take: 1,
    select: { assetPath: true, altText: true },
  },
} satisfies Prisma.CatalogueServiceSelect;

export const publicOfferingSelect = {
  id: true,
  slug: true,
  name: true,
  shortSummary: true,
  description: true,
  displayOrder: true,
  isActive: true,
  isFeatured: true,
  groupLabel: true,
  tierLabel: true,
  quantityEnabled: true,
  quantityUnit: true,
  minimumQuantity: true,
  maximumQuantity: true,
  gameModes: { orderBy: { gameMode: "asc" as const } },
  facets: {
    orderBy: [{ displayOrder: "asc" as const }, { label: "asc" as const }],
  },
  requirements: {
    orderBy: [{ displayOrder: "asc" as const }, { title: "asc" as const }],
    select: {
      id: true,
      title: true,
      description: true,
      type: true,
      isRequired: true,
      displayOrder: true,
      verificationMode: true,
      customerGuidance: true,
      metricKey: true,
      comparisonOperator: true,
      requiredValue: true,
      recommendedService: {
        select: {
          name: true,
          slug: true,
          publicationStatus: true,
          publishAt: true,
          unpublishAt: true,
          category: { select: { slug: true, isActive: true } },
        },
      },
    },
  },
} satisfies Prisma.CatalogueOfferingSelect;

export function publicPrimaryMedia(service: {
  mediaReferences: { assetPath: string; altText: string }[];
}) {
  return service.mediaReferences[0] ?? null;
}

export function matchesCatalogueSearch(
  service: { name: string; shortSummary: string; content: string },
  search: string,
) {
  const terms = search.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  const words = [service.name, service.shortSummary, service.content]
    .join(" ")
    .toLowerCase()
    .match(/[a-z0-9]+/g);
  if (!terms.length || !words) return !terms.length;
  return terms.every((term) =>
    words.some(
      (word) => word === term || word === `${term}s` || term === `${word}s`,
    ),
  );
}
