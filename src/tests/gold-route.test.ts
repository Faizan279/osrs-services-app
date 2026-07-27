import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  featureFlagFindUnique: vi.fn(),
  goldMarketFindFirst: vi.fn(),
  goldRateRevisionFindFirst: vi.fn(),
  pricingRevisionFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    featureFlag: { findUnique: mocks.featureFlagFindUnique },
    goldMarket: { findFirst: mocks.goldMarketFindFirst },
    goldRateRevision: { findFirst: mocks.goldRateRevisionFindFirst },
    pricingRevision: { findFirst: mocks.pricingRevisionFindFirst },
  },
}));

let POST: typeof import("@/app/api/gold/estimate/route").POST;

const publishedGoldRevision = {
  schemaVersion: 1,
  market: {
    id: "goldmarket1",
    stableKey: "gold-main-market",
    slug: "gold-trading",
    serviceId: "service1",
    serviceSlug: "gold-trading",
    categoryId: "category1",
    categorySlug: "gold",
    publicName: "OSRS Gold Trading",
    currencyCode: "USD",
  },
  revision: {
    id: "goldrevision1",
    revisionNumber: 1,
    publishedAt: "2026-07-25T00:00:00.000Z",
  },
  rates: [
    {
      direction: "CUSTOMER_BUYS_GOLD",
      rateMinorUnitsPerMillion: 25,
      minimumQuantityGp: "10000000",
      maximumQuantityGp: "500000000",
      automaticReviewMaximumGp: "100000000",
      effectiveStart: "2026-07-24T00:00:00.000Z",
      effectiveEnd: null,
      enabled: true,
    },
    {
      direction: "CUSTOMER_SELLS_GOLD",
      rateMinorUnitsPerMillion: 18,
      minimumQuantityGp: "10000000",
      maximumQuantityGp: "500000000",
      automaticReviewMaximumGp: "100000000",
      effectiveStart: "2026-07-24T00:00:00.000Z",
      effectiveEnd: null,
      enabled: true,
    },
  ],
};

const market = {
  id: "goldmarket1",
  stableKey: "gold-main-market",
  serviceId: "service1",
  publicName: "OSRS Gold Trading",
  slug: "gold-trading",
  description: "Reviewed gold trading estimates.",
  currencyCode: "USD",
  availabilityState: "AVAILABLE",
  publicTradeInstructions:
    "Support confirms the final trade before any gold changes hands.",
  internalInstructions: "private",
  rsnRequired: true,
  secureServiceEnabled: true,
  secureServicePricingMode: "FIXED_MINOR_UNITS",
  secureServiceFixedMinorUnits: 199,
  secureServiceBps: 0,
  secureServiceCustomerBuys: true,
  secureServiceCustomerSells: true,
  quoteValidityMinutes: 15,
  stockQuantityGp: 200_000_000n,
  buyingCapacityGp: 150_000_000n,
  stockVersion: 1,
  draftVersion: 1,
  needsClientReview: true,
  service: {
    id: "service1",
    slug: "gold-trading",
    categoryId: "category1",
    category: { id: "category1", slug: "gold" },
  },
  quantityPresets: [
    {
      id: "preset50",
      direction: "CUSTOMER_BUYS_GOLD",
      publicLabel: "50M",
      quantityGp: 50_000_000n,
      sortOrder: 10,
      enabled: true,
    },
  ],
};

const globalPricingRevision = {
  schemaVersion: 1,
  ruleSetId: "globalpricingdraftseed",
  revisionId: "pricingrevision1",
  revisionNumber: 1,
  currencyCode: "USD",
  publishedAt: "2026-07-25T00:00:00.000Z",
  rules: [
    {
      id: "goldglobal",
      publicLabel: "Gold handling",
      enabled: true,
      ruleType: "FIXED_ADDITION",
      amountCents: 125,
      valueBps: null,
      priority: 0,
      exclusiveGroupKey: null,
      effectiveStart: null,
      effectiveEnd: null,
      applicability: [
        {
          scope: "ENGINE_TYPE",
          engineType: "GOLD_ENGINE",
          categoryId: null,
          serviceId: null,
        },
      ],
    },
  ],
};

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/gold/estimate", {
    method: "POST",
    body: JSON.stringify({
      serviceId: "service1",
      marketId: "goldmarket1",
      direction: "CUSTOMER_BUYS_GOLD",
      quantity: "50m",
      secureServiceSelected: false,
      rsn: "Valid Rsn",
      ...body,
    }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.featureFlagFindUnique.mockImplementation(({ where }) =>
    Promise.resolve({
      enabled: where.key === "gold_engine_enabled",
    }),
  );
  mocks.goldMarketFindFirst.mockResolvedValue(market);
  mocks.goldRateRevisionFindFirst.mockResolvedValue({
    snapshot: publishedGoldRevision,
  });
  mocks.pricingRevisionFindFirst.mockResolvedValue(null);
});

beforeAll(async () => {
  ({ POST } = await import("@/app/api/gold/estimate/route"));
});

describe("gold estimate route", () => {
  it("calculates a server-authoritative estimate and ignores client totals", async () => {
    const response = await POST(
      request({
        rateMinorUnitsPerMillion: 1,
        estimatedTotalMinorUnits: 1,
        availabilityState: "AVAILABLE",
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.ok).toBe(true);
    expect(body.estimate.estimatedTotalMinorUnits).toBe(1_250);
    expect(body.estimate.estimatedTotal).toBe("$12.50");
    expect(body.estimate.snapshot.quantityGp).toBe("50000000");
    expect(JSON.stringify(body)).not.toMatch(
      /internal|Valid Rsn|rateMinorUnitsPerMillion":1/,
    );
  });

  it("uses server-side preset quantities instead of the submitted quantity", async () => {
    const response = await POST(
      request({ presetId: "preset50", quantity: "999m" }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.estimate.quantityGp).toBe("50000000");
    expect(body.estimate.estimatedTotalMinorUnits).toBe(1_250);
  });

  it("applies global pricing only to customer-buy estimates", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: true });
    mocks.pricingRevisionFindFirst.mockResolvedValue({
      snapshot: globalPricingRevision,
    });

    const buyResponse = await POST(request({}) as never);
    const buyBody = await buyResponse.json();
    const sellResponse = await POST(
      request({ direction: "CUSTOMER_SELLS_GOLD" }) as never,
    );
    const sellBody = await sellResponse.json();

    expect(buyBody.estimate.estimatedTotalMinorUnits).toBe(1_375);
    expect(buyBody.estimate.lineItems).toEqual(
      expect.arrayContaining([{ label: "Gold handling", amountCents: 125 }]),
    );
    expect(sellBody.estimate.estimatedTotalMinorUnits).toBe(900);
    expect(sellBody.estimate.lineItems).toEqual([
      { label: "Gold purchase payout", amountCents: 900 },
    ]);
  });

  it("returns controlled validation errors for disabled flag, RSN and rates", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: false });
    const disabled = await POST(request({}) as never);
    expect(disabled.status).toBe(400);
    expect(await disabled.json()).toEqual(
      expect.objectContaining({ ok: false }),
    );

    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: true });
    const invalidRsn = await POST(request({ rsn: "bad!" }) as never);
    expect(invalidRsn.status).toBe(400);
    expect((await invalidRsn.json()).message).toMatch(/letters/i);

    mocks.goldRateRevisionFindFirst.mockResolvedValue(null);
    const noRevision = await POST(request({}) as never);
    expect(noRevision.status).toBe(400);
    expect((await noRevision.json()).message).toMatch(/published revision/i);
  });
});
