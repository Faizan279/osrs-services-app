import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { publicCatalogueWhere } from "@/lib/catalogue/queries";
import { prisma } from "@/lib/db/prisma";
import {
  GOLD_ENGINE_FEATURE_FLAG,
  goldTradeDirectionLabels,
} from "@/lib/gold/constants";
import {
  calculateGoldEstimate,
  formatGoldQuantity,
  GoldValidationError,
  normalizePublishedGoldRateRevision,
  parseGoldQuantity,
  safeGoldJson,
  withGoldGlobalPricing,
  type GoldEstimateResult,
  type GoldMarketEstimateConfig,
  type GoldTradeDirection,
  type PublishedGoldRateRevisionSnapshotV1,
} from "@/lib/gold/estimate";
import { applyPublishedPricingIfEnabled } from "@/lib/pricing/server";
import type { PricingLine } from "@/lib/pricing/engine";

type GoldMarketForEstimate = Prisma.GoldMarketGetPayload<{
  include: {
    service: { include: { category: true } };
    quantityPresets: true;
  };
}>;

type PublicGoldService = Prisma.CatalogueServiceGetPayload<{
  include: {
    category: true;
    gameModes: true;
    requirements: true;
  };
}>;

export type GoldEstimateRequest = {
  serviceId?: string;
  marketId?: string;
  direction: GoldTradeDirection;
  quantity: string;
  presetId?: string;
  secureServiceSelected: boolean;
  rsn?: string;
};

export type PublicGoldTradingService = {
  service: PublicGoldService;
  market: ReturnType<typeof publicMarket>;
  presets: Array<{
    id: string;
    direction: GoldTradeDirection;
    publicLabel: string;
    quantityGp: string;
    quantityLabel: string;
    sortOrder: number;
  }>;
  latestRevision: PublishedGoldRateRevisionSnapshotV1 | null;
  featureEnabled: boolean;
};

function publicMarket(market: GoldMarketForEstimate) {
  return {
    id: market.id,
    stableKey: market.stableKey,
    publicName: market.publicName,
    slug: market.slug,
    description: market.description,
    currencyCode: market.currencyCode,
    availabilityState: market.availabilityState,
    publicTradeInstructions: market.publicTradeInstructions,
    rsnRequired: market.rsnRequired,
    secureServiceEnabled: market.secureServiceEnabled,
    secureServicePricingMode: market.secureServicePricingMode,
    secureServiceFixedMinorUnits: market.secureServiceFixedMinorUnits,
    secureServiceBps: market.secureServiceBps,
    secureServiceCustomerBuys: market.secureServiceCustomerBuys,
    secureServiceCustomerSells: market.secureServiceCustomerSells,
    quoteValidityMinutes: market.quoteValidityMinutes,
    stockQuantityGp: market.stockQuantityGp.toString(),
    buyingCapacityGp: market.buyingCapacityGp.toString(),
    stockVersion: market.stockVersion,
    draftVersion: market.draftVersion,
    needsClientReview: market.needsClientReview,
  };
}

export function goldMarketEstimateConfig(
  market: GoldMarketForEstimate,
): GoldMarketEstimateConfig {
  return {
    stableKey: market.stableKey,
    id: market.id,
    serviceId: market.serviceId,
    serviceSlug: market.service.slug,
    categoryId: market.service.categoryId,
    categorySlug: market.service.category.slug,
    publicName: market.publicName,
    slug: market.slug,
    currencyCode: market.currencyCode,
    availabilityState: market.availabilityState,
    publicTradeInstructions: market.publicTradeInstructions,
    rsnRequired: market.rsnRequired,
    secureServiceEnabled: market.secureServiceEnabled,
    secureServicePricingMode: market.secureServicePricingMode,
    secureServiceFixedMinorUnits: market.secureServiceFixedMinorUnits,
    secureServiceBps: market.secureServiceBps,
    secureServiceCustomerBuys: market.secureServiceCustomerBuys,
    secureServiceCustomerSells: market.secureServiceCustomerSells,
    quoteValidityMinutes: market.quoteValidityMinutes,
    stockQuantityGp: market.stockQuantityGp.toString(),
    buyingCapacityGp: market.buyingCapacityGp.toString(),
  };
}

export async function loadLatestPublishedGoldRevision(marketId: string) {
  const revision = await prisma.goldRateRevision.findFirst({
    where: { marketId },
    orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
    select: { snapshot: true },
  });
  if (!revision) return null;
  return normalizePublishedGoldRateRevision(revision.snapshot);
}

async function goldFlagEnabled() {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: GOLD_ENGINE_FEATURE_FLAG },
    select: { enabled: true },
  });
  return Boolean(flag?.enabled);
}

export async function getPublicGoldTradingService({
  categorySlug,
  serviceSlug,
  now = new Date(),
}: {
  categorySlug: string;
  serviceSlug: string;
  now?: Date;
}): Promise<PublicGoldTradingService | null> {
  const service = await prisma.catalogueService.findFirst({
    where: {
      ...publicCatalogueWhere(now),
      slug: serviceSlug,
      engineType: "GOLD_ENGINE",
      category: { slug: categorySlug, isActive: true },
    },
    include: {
      category: true,
      gameModes: { orderBy: { gameMode: "asc" } },
      requirements: { orderBy: [{ displayOrder: "asc" }, { title: "asc" }] },
    },
  });
  if (!service) return null;

  const [market, featureEnabled] = await Promise.all([
    prisma.goldMarket.findUnique({
      where: { serviceId: service.id },
      include: {
        service: { include: { category: true } },
        quantityPresets: {
          where: { enabled: true },
          orderBy: [{ direction: "asc" }, { sortOrder: "asc" }],
        },
      },
    }),
    goldFlagEnabled(),
  ]);
  if (!market) return null;
  const latestRevision = await loadLatestPublishedGoldRevision(market.id);
  return {
    service,
    market: publicMarket(market),
    presets: market.quantityPresets.map((preset) => ({
      id: preset.id,
      direction: preset.direction,
      publicLabel: preset.publicLabel,
      quantityGp: preset.quantityGp.toString(),
      quantityLabel: formatGoldQuantity(preset.quantityGp),
      sortOrder: preset.sortOrder,
    })),
    latestRevision,
    featureEnabled,
  };
}

async function loadEstimateMarket(input: GoldEstimateRequest) {
  return prisma.goldMarket.findFirst({
    where: {
      ...(input.marketId ? { id: input.marketId } : {}),
      ...(input.serviceId ? { serviceId: input.serviceId } : {}),
      service: {
        ...publicCatalogueWhere(),
        engineType: "GOLD_ENGINE",
      },
    },
    include: {
      service: { include: { category: true } },
      quantityPresets: {
        where: { enabled: true },
        orderBy: [{ direction: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
}

function rateMaximumForDirection(
  revision: PublishedGoldRateRevisionSnapshotV1,
  direction: GoldTradeDirection,
) {
  return revision.rates.find((rate) => rate.direction === direction)
    ?.maximumQuantityGp;
}

function selectedQuantity({
  market,
  revision,
  input,
}: {
  market: GoldMarketForEstimate;
  revision: PublishedGoldRateRevisionSnapshotV1;
  input: GoldEstimateRequest;
}) {
  if (input.presetId) {
    const preset = market.quantityPresets.find(
      (candidate) =>
        candidate.id === input.presetId &&
        candidate.direction === input.direction &&
        candidate.enabled,
    );
    if (!preset) {
      throw new GoldValidationError(
        "Choose an available gold quantity preset.",
      );
    }
    return preset.quantityGp;
  }
  const maximum = rateMaximumForDirection(revision, input.direction);
  return parseGoldQuantity(input.quantity, maximum);
}

export async function calculateServerGoldEstimate(input: GoldEstimateRequest) {
  const flagEnabled = await goldFlagEnabled();
  if (!flagEnabled) {
    throw new GoldValidationError(
      "The Gold Trading Engine is temporarily unavailable.",
    );
  }
  if (!input.serviceId && !input.marketId) {
    throw new GoldValidationError("Choose an available gold market.");
  }

  const market = await loadEstimateMarket(input);
  if (!market) {
    throw new GoldValidationError("Choose an available gold market.");
  }
  if (market.rsnRequired && !input.rsn) {
    throw new GoldValidationError("Enter your RuneScape name.");
  }

  const revision = await loadLatestPublishedGoldRevision(market.id);
  if (!revision) {
    throw new GoldValidationError(
      "Gold rates are waiting for an approved published revision.",
    );
  }

  const quantityGp = selectedQuantity({ market, revision, input });
  let estimate = calculateGoldEstimate({
    market: goldMarketEstimateConfig(market),
    revision,
    direction: input.direction,
    quantityGp,
    secureServiceSelected: input.secureServiceSelected,
  });

  if (input.direction === "CUSTOMER_BUYS_GOLD") {
    const priced = await applyPublishedPricingIfEnabled({
      source: {
        serviceId: market.serviceId,
        serviceSlug: market.service.slug,
        categoryId: market.service.categoryId,
        categorySlug: market.service.category.slug,
        engineType: "GOLD_ENGINE",
        currency: market.currencyCode,
        baseSubtotalCents: estimate.estimatedTotalMinorUnits,
        basePricingLines: estimate.lineItems,
        selectedReferences: {
          direction: input.direction,
          presetId: input.presetId ?? null,
          quantityGp: estimate.quantityGp,
          secureServiceSelected: input.secureServiceSelected,
        },
        engineConfigurationRevision: {
          id: revision.revision.id,
          version: revision.revision.revisionNumber,
        },
      },
    });
    estimate = withGoldGlobalPricing(estimate, priced);
  }

  return estimate;
}

function publicLine(line: PricingLine) {
  return { label: line.label, amountCents: line.amountCents };
}

export function publicGoldEstimatePayload(estimate: GoldEstimateResult) {
  return {
    direction: estimate.direction,
    directionLabel: goldTradeDirectionLabels[estimate.direction],
    currency: estimate.currency,
    quantityGp: estimate.quantityGp,
    quantityLabel: estimate.quantityLabel,
    rateMinorUnitsPerMillion: estimate.rateMinorUnitsPerMillion,
    lineItems: estimate.lineItems.map(publicLine),
    baseTotalMinorUnits: estimate.baseTotalMinorUnits,
    secureServiceAdjustment: estimate.secureServiceAdjustment,
    estimatedTotalMinorUnits: estimate.estimatedTotalMinorUnits,
    estimatedTotal: estimate.estimatedTotal,
    availabilityState: estimate.availabilityState,
    manualReviewRequired: estimate.manualReviewRequired,
    availabilityMessage: estimate.availabilityMessage,
    finalPriceNote: estimate.finalPriceNote,
    tradeInstructions: estimate.tradeInstructions,
    validUntil: estimate.validUntil,
    snapshot: safeGoldJson(estimate.snapshot),
  };
}
