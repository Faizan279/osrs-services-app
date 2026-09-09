import type { Prisma, PrismaClient } from "../src/generated/prisma/client";
import { goldRateRevisionSnapshot } from "../src/lib/gold/estimate";
import {
  loadReferenceSnapshot,
  requireReferenceRecord,
  type FirstSellerReferenceSnapshot,
  type ReferenceRecord,
} from "./reference-snapshot";

const MARKET_ID = "goldmarkettask009seed";
const DRAFT_RATE_SET_ID = "goldratesettask009draft";
const PUBLISHED_RATE_SET_ID = "goldratesetfinalref";
const PUBLISHED_REVISION_ID = "goldrevisionfinalref1";

const goldDescription =
  "Gold trading is configured for reviewed estimates only. Staff must approve live availability, rates and trade instructions before production trading is enabled.";

const publicTradeInstructions =
  "Submit your requested trade after reviewing the estimate. Support will confirm the final price, delivery details and availability before any trade begins. Never provide a password, PIN or authenticator code.";

const internalInstructions =
  "Gold rates are seeded from the committed public reference snapshot for review. Stock, capacity, secure-service pricing and instructions remain non-live until staff approval.";

const presetSeeds = [
  ["gold-buy-10m", "CUSTOMER_BUYS_GOLD", "10M", 10_000_000n, 10],
  ["gold-buy-50m", "CUSTOMER_BUYS_GOLD", "50M", 50_000_000n, 20],
  ["gold-buy-100m", "CUSTOMER_BUYS_GOLD", "100M", 100_000_000n, 30],
  ["gold-buy-500m", "CUSTOMER_BUYS_GOLD", "500M", 500_000_000n, 40],
  ["gold-buy-1b", "CUSTOMER_BUYS_GOLD", "1B", 1_000_000_000n, 50],
  ["gold-sell-10m", "CUSTOMER_SELLS_GOLD", "10M", 10_000_000n, 10],
  ["gold-sell-50m", "CUSTOMER_SELLS_GOLD", "50M", 50_000_000n, 20],
  ["gold-sell-100m", "CUSTOMER_SELLS_GOLD", "100M", 100_000_000n, 30],
  ["gold-sell-500m", "CUSTOMER_SELLS_GOLD", "500M", 500_000_000n, 40],
  ["gold-sell-1b", "CUSTOMER_SELLS_GOLD", "1B", 1_000_000_000n, 50],
] as const;

function millionGp(value: unknown, fallback: bigint) {
  return typeof value === "number" && Number.isFinite(value)
    ? BigInt(Math.round(value)) * 1_000_000n
    : fallback;
}

function goldRateFromReference(
  record: ReferenceRecord,
  id: string,
  effectiveStart: Date,
) {
  const minimumQuantityGp = millionGp(record.minimumQuantityM, 10_000_000n);
  const maximumQuantityGp = millionGp(
    record.maximumQuantityM,
    1_000_000_000_000n,
  );
  return {
    id,
    direction: record.direction as "CUSTOMER_BUYS_GOLD" | "CUSTOMER_SELLS_GOLD",
    rateMinorUnitsPerMillion: record.priceCents,
    minimumQuantityGp,
    maximumQuantityGp,
    automaticReviewMaximumGp:
      maximumQuantityGp < 100_000_000n ? maximumQuantityGp : 100_000_000n,
    volumeDiscounts: [],
    effectiveStart,
    effectiveEnd: null,
    enabled: true,
    needsClientReview: true,
  };
}

function referenceGoldRates(
  snapshot: FirstSellerReferenceSnapshot,
  idPrefix: "draft" | "published",
) {
  const capturedAt = new Date(snapshot.capturedAt);
  const buy = requireReferenceRecord(
    snapshot,
    "gold",
    "gold-rate",
    "buy-osrs-gold",
  );
  const sell = requireReferenceRecord(
    snapshot,
    "gold",
    "gold-rate",
    "sell-osrs-gold",
  );
  return [
    goldRateFromReference(buy, `goldrate${idPrefix}buyref`, capturedAt),
    goldRateFromReference(sell, `goldrate${idPrefix}sellref`, capturedAt),
  ];
}

export async function seedGold(prisma: PrismaClient) {
  const snapshot = loadReferenceSnapshot();
  const capturedAt = new Date(snapshot.capturedAt);
  const draftRates = referenceGoldRates(snapshot, "draft");
  const publishedRates = referenceGoldRates(snapshot, "published");
  const service = await prisma.catalogueService.findUnique({
    where: { seededKey: "gold-trading" },
    select: {
      id: true,
      slug: true,
      category: { select: { id: true, slug: true } },
    },
  });
  if (!service) return;

  const market = await prisma.goldMarket.upsert({
    where: { stableKey: "gold-main-market" },
    create: {
      id: MARKET_ID,
      stableKey: "gold-main-market",
      serviceId: service.id,
      publicName: "OSRS Gold Trading",
      slug: "gold-trading",
      description: goldDescription,
      currencyCode: "USD",
      availabilityState: "PAUSED",
      publicTradeInstructions,
      internalInstructions,
      rsnRequired: true,
      secureServiceEnabled: false,
      secureServicePricingMode: "DISABLED",
      secureServiceFixedMinorUnits: 0,
      secureServiceBps: 0,
      secureServiceCustomerBuys: true,
      secureServiceCustomerSells: false,
      quoteValidityMinutes: 15,
      stockQuantityGp: 0n,
      buyingCapacityGp: 0n,
      needsClientReview: true,
    },
    update: {},
    select: {
      id: true,
      stableKey: true,
      serviceId: true,
      publicName: true,
      slug: true,
      currencyCode: true,
      availabilityState: true,
      publicTradeInstructions: true,
      rsnRequired: true,
      secureServiceEnabled: true,
      secureServicePricingMode: true,
      secureServiceFixedMinorUnits: true,
      secureServiceBps: true,
      secureServiceCustomerBuys: true,
      secureServiceCustomerSells: true,
      quoteValidityMinutes: true,
      stockQuantityGp: true,
      buyingCapacityGp: true,
    },
  });

  const existingDraft = await prisma.goldRateSet.findFirst({
    where: { marketId: market.id, status: "DRAFT" },
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  const draftRateSet =
    existingDraft ??
    (await prisma.goldRateSet.create({
      data: {
        id: DRAFT_RATE_SET_ID,
        marketId: market.id,
        status: "DRAFT",
        internalNotes:
          "Representative draft rates only. Publish only after staff confirms current values.",
        needsClientReview: true,
      },
      select: { id: true },
    }));

  for (const rate of draftRates) {
    await prisma.goldRate.upsert({
      where: {
        rateSetId_direction: {
          rateSetId: draftRateSet.id,
          direction: rate.direction,
        },
      },
      create: {
        id: rate.id,
        rateSetId: draftRateSet.id,
        direction: rate.direction,
        rateMinorUnitsPerMillion: rate.rateMinorUnitsPerMillion,
        minimumQuantityGp: rate.minimumQuantityGp,
        maximumQuantityGp: rate.maximumQuantityGp,
        automaticReviewMaximumGp: rate.automaticReviewMaximumGp,
        effectiveStart: rate.effectiveStart,
        enabled: true,
        needsClientReview: true,
      },
      update: {},
    });
  }

  const existingPublished = await prisma.goldRateSet.findFirst({
    where: { marketId: market.id, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: { id: true },
  });
  const publishedRateSet =
    existingPublished ??
    (await prisma.goldRateSet.create({
      data: {
        id: PUBLISHED_RATE_SET_ID,
        marketId: market.id,
        status: "PUBLISHED",
        version: 1,
        publishedAt: capturedAt,
        internalNotes:
          "Published reference rates from committed FirstSeller public snapshot. Review stock and availability before live trading.",
        needsClientReview: true,
      },
      select: { id: true },
    }));

  for (const rate of publishedRates) {
    await prisma.goldRate.upsert({
      where: {
        rateSetId_direction: {
          rateSetId: publishedRateSet.id,
          direction: rate.direction,
        },
      },
      create: {
        id: rate.id,
        rateSetId: publishedRateSet.id,
        direction: rate.direction,
        rateMinorUnitsPerMillion: rate.rateMinorUnitsPerMillion,
        minimumQuantityGp: rate.minimumQuantityGp,
        maximumQuantityGp: rate.maximumQuantityGp,
        automaticReviewMaximumGp: rate.automaticReviewMaximumGp,
        effectiveStart: rate.effectiveStart,
        enabled: true,
        needsClientReview: true,
      },
      update: {},
    });
  }

  for (const [
    seededKey,
    direction,
    publicLabel,
    quantityGp,
    sortOrder,
  ] of presetSeeds) {
    await prisma.goldQuantityPreset.upsert({
      where: { seededKey },
      create: {
        seededKey,
        marketId: market.id,
        direction,
        publicLabel,
        quantityGp,
        sortOrder,
        enabled: true,
        needsClientReview: true,
      },
      update: {},
    });
  }

  const existingRevision = await prisma.goldRateRevision.findFirst({
    where: { marketId: market.id, revisionNumber: 1 },
    select: { id: true },
  });
  if (!existingRevision) {
    await prisma.goldRateRevision.create({
      data: {
        id: PUBLISHED_REVISION_ID,
        marketId: market.id,
        rateSetId: publishedRateSet.id,
        revisionNumber: 1,
        snapshotSchemaVersion: 1,
        snapshot: goldRateRevisionSnapshot({
          market: {
            id: market.id,
            stableKey: market.stableKey,
            serviceId: market.serviceId,
            serviceSlug: service.slug,
            categoryId: service.category.id,
            categorySlug: service.category.slug,
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
            stockQuantityGp: market.stockQuantityGp,
            buyingCapacityGp: market.buyingCapacityGp,
          },
          revisionId: PUBLISHED_REVISION_ID,
          revisionNumber: 1,
          publishedAt: capturedAt,
          rates: publishedRates.map((rate) => ({
            direction: rate.direction,
            rateMinorUnitsPerMillion: rate.rateMinorUnitsPerMillion,
            minimumQuantityGp: rate.minimumQuantityGp,
            maximumQuantityGp: rate.maximumQuantityGp,
            automaticReviewMaximumGp: rate.automaticReviewMaximumGp,
            effectiveStart: rate.effectiveStart,
            effectiveEnd: null,
            enabled: true,
          })),
        }) as unknown as Prisma.InputJsonValue,
        publishedAt: capturedAt,
      },
    });
  }
}
