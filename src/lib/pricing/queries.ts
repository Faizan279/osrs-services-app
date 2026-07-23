import "server-only";

import { prisma } from "@/lib/db/prisma";
import {
  applyGlobalPricing,
  unchangedPricingResult,
  type PricingSource,
} from "@/lib/pricing/engine";
import { publishedRevisionSnapshot } from "@/lib/pricing/server";

export const pricingRuleInclude = {
  applicability: {
    include: {
      category: { select: { id: true, name: true, slug: true } },
      service: {
        select: {
          id: true,
          name: true,
          slug: true,
          engineType: true,
          category: { select: { slug: true, name: true } },
        },
      },
    },
  },
} as const;

export async function getPricingAdminOptions() {
  const [categories, services] = await Promise.all([
    prisma.catalogueCategory.findMany({
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
    prisma.catalogueService.findMany({
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        slug: true,
        engineType: true,
        categoryId: true,
        category: { select: { name: true, slug: true } },
      },
    }),
  ]);
  return { categories, services };
}

export async function getAdminPricingOverview() {
  const [draft, latestRevision, revisions, activity, flag] = await Promise.all([
    prisma.pricingRuleSet.findFirst({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "asc" },
      include: {
        rules: {
          orderBy: [{ priority: "asc" }, { publicLabel: "asc" }],
          include: pricingRuleInclude,
        },
      },
    }),
    prisma.pricingRevision.findFirst({
      orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
      include: { publishedBy: { select: { name: true, email: true } } },
    }),
    prisma.pricingRevision.findMany({
      orderBy: { revisionNumber: "desc" },
      take: 10,
      include: { publishedBy: { select: { name: true, email: true } } },
    }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: "pricing." } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.featureFlag.findUnique({
      where: { key: "global_pricing_enabled" },
      select: { enabled: true },
    }),
  ]);

  return {
    draft,
    latestRevision,
    revisions,
    activity,
    globalPricingEnabled: Boolean(flag?.enabled),
  };
}

export async function getPricingRuleForEditor(ruleId: string) {
  const [draft, rule, options] = await Promise.all([
    prisma.pricingRuleSet.findFirst({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "asc" },
    }),
    prisma.pricingRule.findUnique({
      where: { id: ruleId },
      include: pricingRuleInclude,
    }),
    getPricingAdminOptions(),
  ]);
  if (!draft || !rule || rule.ruleSetId !== draft.id) return null;
  return { draft, rule, options };
}

export async function getPricingRuleCreationContext() {
  const [draft, options] = await Promise.all([
    prisma.pricingRuleSet.findFirst({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "asc" },
    }),
    getPricingAdminOptions(),
  ]);
  return { draft, options };
}

export async function getPricingHistory() {
  return prisma.pricingRevision.findMany({
    orderBy: { revisionNumber: "desc" },
    include: { publishedBy: { select: { name: true, email: true } } },
  });
}

export async function getPricingPreview({
  serviceId,
  baseSubtotalCents,
  previewAt,
}: {
  serviceId?: string;
  baseSubtotalCents: number;
  previewAt: Date;
}) {
  const [draft, latestRevisionNumber] = await Promise.all([
    prisma.pricingRuleSet.findFirst({
      where: { status: "DRAFT" },
      orderBy: { createdAt: "asc" },
      include: {
        rules: {
          orderBy: [{ priority: "asc" }, { id: "asc" }],
          include: { applicability: true },
        },
      },
    }),
    prisma.pricingRevision.findFirst({
      orderBy: { revisionNumber: "desc" },
      select: { revisionNumber: true },
    }),
  ]);
  const service = serviceId
    ? await prisma.catalogueService.findUnique({
        where: { id: serviceId },
        select: {
          id: true,
          slug: true,
          categoryId: true,
          engineType: true,
          version: true,
          category: { select: { slug: true } },
        },
      })
    : await prisma.catalogueService.findFirst({
        orderBy: { name: "asc" },
        select: {
          id: true,
          slug: true,
          categoryId: true,
          engineType: true,
          version: true,
          category: { select: { slug: true } },
        },
      });
  if (!draft || !service) return null;
  const source: PricingSource = {
    serviceId: service.id,
    serviceSlug: service.slug,
    categoryId: service.categoryId,
    categorySlug: service.category.slug,
    engineType: service.engineType,
    currency: draft.currencyCode,
    baseSubtotalCents,
    basePricingLines: [
      { label: "Preview engine subtotal", amountCents: baseSubtotalCents },
    ],
    selectedReferences: {
      preview: true,
      serviceId: service.id,
      baseSubtotalCents,
    },
    engineConfigurationRevision: {
      id: service.id,
      version: service.version,
    },
  };
  if (!draft.rules.length) return unchangedPricingResult(source);
  const revision = publishedRevisionSnapshot({
    ruleSetId: draft.id,
    revisionId: draft.id,
    revisionNumber: (latestRevisionNumber?.revisionNumber ?? 0) + 1,
    currencyCode: draft.currencyCode,
    publishedAt: previewAt,
    rules: draft.rules,
  });
  return applyGlobalPricing({ source, revision, now: previewAt });
}
