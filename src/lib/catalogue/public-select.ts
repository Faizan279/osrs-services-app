import type { Prisma } from "@/generated/prisma/client";

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
  primaryMediaPath: true,
  seoTitle: true,
  seoDescription: true,
  publishAt: true,
  unpublishAt: true,
  updatedAt: true,
  category: true,
  gameModes: { orderBy: { gameMode: "asc" as const } },
  requirements: {
    orderBy: [{ displayOrder: "asc" as const }, { title: "asc" as const }],
  },
  mediaReferences: {
    orderBy: [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }],
  },
} satisfies Prisma.CatalogueServiceSelect;

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
