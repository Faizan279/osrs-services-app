import type { PrismaClient } from "../src/generated/prisma/client";

const MARKET_ID = "goldmarkettask009seed";
const DRAFT_RATE_SET_ID = "goldratesettask009draft";

const goldDescription =
  "Gold trading is configured for reviewed estimates only. Staff must approve live availability, rates and trade instructions before production trading is enabled.";

const publicTradeInstructions =
  "Submit your requested trade after reviewing the estimate. Support will confirm the final price, delivery details and availability before any trade begins. Never provide a password, PIN or authenticator code.";

const internalInstructions =
  "Task 009 seed data is intentionally non-live. Review rates, stock, capacity, secure-service pricing and instructions before enabling public gold estimates.";

const draftRates = [
  {
    id: "goldratebuytask009",
    direction: "CUSTOMER_BUYS_GOLD" as const,
    rateMinorUnitsPerMillion: 20,
    minimumQuantityGp: 10_000_000n,
    maximumQuantityGp: 500_000_000n,
    automaticReviewMaximumGp: 100_000_000n,
  },
  {
    id: "goldrateselltask009",
    direction: "CUSTOMER_SELLS_GOLD" as const,
    rateMinorUnitsPerMillion: 15,
    minimumQuantityGp: 10_000_000n,
    maximumQuantityGp: 500_000_000n,
    automaticReviewMaximumGp: 100_000_000n,
  },
] as const;

const presetSeeds = [
  ["gold-buy-10m", "CUSTOMER_BUYS_GOLD", "10M", 10_000_000n, 10],
  ["gold-buy-50m", "CUSTOMER_BUYS_GOLD", "50M", 50_000_000n, 20],
  ["gold-buy-100m", "CUSTOMER_BUYS_GOLD", "100M", 100_000_000n, 30],
  ["gold-buy-500m", "CUSTOMER_BUYS_GOLD", "500M", 500_000_000n, 40],
  ["gold-sell-10m", "CUSTOMER_SELLS_GOLD", "10M", 10_000_000n, 10],
  ["gold-sell-50m", "CUSTOMER_SELLS_GOLD", "50M", 50_000_000n, 20],
  ["gold-sell-100m", "CUSTOMER_SELLS_GOLD", "100M", 100_000_000n, 30],
  ["gold-sell-500m", "CUSTOMER_SELLS_GOLD", "500M", 500_000_000n, 40],
] as const;

export async function seedGold(prisma: PrismaClient) {
  const service = await prisma.catalogueService.findUnique({
    where: { seededKey: "gold-trading" },
    select: { id: true },
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
    select: { id: true },
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
        effectiveStart: new Date("2026-07-25T00:00:00.000Z"),
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
}
