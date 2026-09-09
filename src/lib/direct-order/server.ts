import "server-only";

import { publicCatalogueWhere } from "@/lib/catalogue/queries";
import type { DirectOrderOffering } from "@/lib/direct-order/core";
import { prisma } from "@/lib/db/prisma";

export async function getDirectOrderService(
  categorySlug: string,
  serviceSlug: string,
) {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: "catalogue_card_engine_enabled" },
    select: { enabled: true },
  });
  if (!flag?.enabled) return null;
  const service = await prisma.catalogueService.findFirst({
    where: {
      ...publicCatalogueWhere(),
      category: { slug: categorySlug, isActive: true },
      slug: serviceSlug,
      engineType: "CATALOGUE_CARD",
      availabilityState: "AVAILABLE",
    },
    select: {
      id: true,
      name: true,
      slug: true,
      shortSummary: true,
      content: true,
      version: true,
      category: { select: { name: true, slug: true } },
      gameModes: { orderBy: { gameMode: "asc" } },
      requirements: {
        orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          isRequired: true,
          customerGuidance: true,
        },
      },
      offerings: {
        where: { isActive: true, basePriceCents: { not: null } },
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          slug: true,
          name: true,
          shortSummary: true,
          description: true,
          groupLabel: true,
          tierLabel: true,
          quantityEnabled: true,
          quantityUnit: true,
          minimumQuantity: true,
          maximumQuantity: true,
          basePriceCents: true,
          pricingUnit: true,
          estimatedDeliveryText: true,
          referenceSourceKey: true,
          facets: {
            orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
            select: {
              facetKey: true,
              facetValue: true,
              label: true,
            },
          },
          requirements: {
            orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
            select: {
              id: true,
              title: true,
              description: true,
              isRequired: true,
              customerGuidance: true,
            },
          },
        },
      },
    },
  });
  if (!service) return null;

  // Seeded catalogue references may coexist with a curated override. Prefer the
  // referenced priced record while keeping client-authored unique offerings.
  const deduplicated = new Map<string, (typeof service.offerings)[number]>();
  for (const offering of service.offerings) {
    const key = offering.slug.replace(/^reference-/, "");
    const current = deduplicated.get(key);
    if (!current || offering.referenceSourceKey)
      deduplicated.set(key, offering);
  }
  const offerings: DirectOrderOffering[] = [...deduplicated.values()];

  return { ...service, offerings };
}
