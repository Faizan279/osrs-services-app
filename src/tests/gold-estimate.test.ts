import { describe, expect, it } from "vitest";

import {
  calculateGoldEstimate,
  calculateRateMinorUnits,
  formatGoldQuantity,
  GoldValidationError,
  goldRateRevisionSnapshot,
  normalizeGoldEstimateSnapshot,
  normalizePublishedGoldRateRevision,
  parseGoldQuantity,
  withGoldGlobalPricing,
  type GoldMarketEstimateConfig,
  type PublishedGoldRateRevisionSnapshotV1,
} from "@/lib/gold/estimate";

const now = new Date("2026-07-25T12:00:00.000Z");

function market(
  overrides: Partial<GoldMarketEstimateConfig> = {},
): GoldMarketEstimateConfig {
  return {
    id: "goldmarket1",
    stableKey: "gold-main-market",
    serviceId: "service1",
    serviceSlug: "gold-trading",
    categoryId: "category1",
    categorySlug: "gold",
    publicName: "OSRS Gold Trading",
    slug: "gold-trading",
    currencyCode: "USD",
    availabilityState: "AVAILABLE",
    publicTradeInstructions:
      "Support confirms the final trade before any gold changes hands.",
    rsnRequired: true,
    secureServiceEnabled: true,
    secureServicePricingMode: "FIXED_MINOR_UNITS",
    secureServiceFixedMinorUnits: 199,
    secureServiceBps: 0,
    secureServiceCustomerBuys: true,
    secureServiceCustomerSells: true,
    quoteValidityMinutes: 15,
    stockQuantityGp: "200000000",
    buyingCapacityGp: "150000000",
    ...overrides,
  };
}

function revision(
  overrides: Partial<PublishedGoldRateRevisionSnapshotV1> = {},
): PublishedGoldRateRevisionSnapshotV1 {
  return {
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
    ...overrides,
  };
}

describe("gold quantity parsing", () => {
  it("parses million-GP display strings into whole GP BigInts", () => {
    expect(parseGoldQuantity("10")).toBe(10_000_000n);
    expect(parseGoldQuantity("50M")).toBe(50_000_000n);
    expect(parseGoldQuantity("1.5 million")).toBe(1_500_000n);
    expect(parseGoldQuantity("123456gp")).toBe(123_456n);
    expect(formatGoldQuantity(1_500_000n)).toBe("1.5M GP");
  });

  it("rejects malformed, zero, negative, over-precise and oversized quantities", () => {
    for (const value of ["", "abc", "1..2m", "0", "-1m", "+1m"]) {
      expect(() => parseGoldQuantity(value)).toThrow(GoldValidationError);
    }
    expect(() => parseGoldQuantity("1.1234567m")).toThrow(GoldValidationError);
    expect(() => parseGoldQuantity("501m", 500_000_000n)).toThrow(
      GoldValidationError,
    );
  });

  it("rounds rate calculations half up to integer minor units", () => {
    expect(
      calculateRateMinorUnits({
        rateMinorUnitsPerMillion: 333,
        quantityGp: 1_500_000n,
      }),
    ).toBe(500);
    expect(
      calculateRateMinorUnits({
        rateMinorUnitsPerMillion: 25,
        quantityGp: 50_000_000n,
      }),
    ).toBe(1_250);
  });
});

describe("gold estimate engine", () => {
  it("calculates customer-buy estimates from the published revision only", () => {
    const result = calculateGoldEstimate({
      market: market(),
      revision: revision(),
      direction: "CUSTOMER_BUYS_GOLD",
      quantityGp: 50_000_000n,
      secureServiceSelected: false,
      now,
    });

    expect(result.estimatedTotalMinorUnits).toBe(1_250);
    expect(result.estimatedTotal).toBe("$12.50");
    expect(result.lineItems).toEqual([
      { label: "Gold sale subtotal", amountCents: 1_250 },
    ]);
    expect(result.availabilityState).toBe("AVAILABLE");
    expect(result.manualReviewRequired).toBe(false);
    expect(result.snapshot.publishedGoldRateRevision).toEqual({
      id: "goldrevision1",
      revisionNumber: 1,
    });
  });

  it("calculates customer-sell payouts without customer-charge pricing", () => {
    const result = calculateGoldEstimate({
      market: market(),
      revision: revision(),
      direction: "CUSTOMER_SELLS_GOLD",
      quantityGp: 50_000_000n,
      secureServiceSelected: false,
      now,
    });

    expect(result.estimatedTotalMinorUnits).toBe(900);
    expect(result.estimatedTotal).toBe("$9.00");
    expect(result.lineItems).toEqual([
      { label: "Gold purchase payout", amountCents: 900 },
    ]);
  });

  it("marks manual review above the automatic threshold", () => {
    const result = calculateGoldEstimate({
      market: market(),
      revision: revision(),
      direction: "CUSTOMER_BUYS_GOLD",
      quantityGp: 150_000_000n,
      secureServiceSelected: false,
      now,
    });

    expect(result.manualReviewRequired).toBe(true);
    expect(result.availabilityState).toBe("MANUAL_REVIEW_REQUIRED");
    expect(result.availabilityMessage).toMatch(/manual review/i);
  });

  it("marks stock and buying-capacity shortages unavailable without throwing", () => {
    const stockResult = calculateGoldEstimate({
      market: market({ stockQuantityGp: "20" }),
      revision: revision(),
      direction: "CUSTOMER_BUYS_GOLD",
      quantityGp: 50_000_000n,
      secureServiceSelected: false,
      now,
    });
    const capacityResult = calculateGoldEstimate({
      market: market({ buyingCapacityGp: "20" }),
      revision: revision(),
      direction: "CUSTOMER_SELLS_GOLD",
      quantityGp: 50_000_000n,
      secureServiceSelected: false,
      now,
    });

    expect(stockResult.availabilityState).toBe("UNAVAILABLE");
    expect(capacityResult.availabilityState).toBe("UNAVAILABLE");
  });

  it("rejects paused markets, limits and unavailable rates", () => {
    expect(() =>
      calculateGoldEstimate({
        market: market({ availabilityState: "PAUSED" }),
        revision: revision(),
        direction: "CUSTOMER_BUYS_GOLD",
        quantityGp: 50_000_000n,
        secureServiceSelected: false,
        now,
      }),
    ).toThrow(GoldValidationError);
    expect(() =>
      calculateGoldEstimate({
        market: market(),
        revision: revision(),
        direction: "CUSTOMER_BUYS_GOLD",
        quantityGp: 1_000_000n,
        secureServiceSelected: false,
        now,
      }),
    ).toThrow(/at least/);
    expect(() =>
      calculateGoldEstimate({
        market: market(),
        revision: revision(),
        direction: "CUSTOMER_BUYS_GOLD",
        quantityGp: 501_000_000n,
        secureServiceSelected: false,
        now,
      }),
    ).toThrow(/at most/);
  });

  it("rejects disabled, future and expired published rates", () => {
    const disabled = revision({
      rates: [
        { ...revision().rates[0]!, enabled: false },
        revision().rates[1]!,
      ],
    });
    const future = revision({
      rates: [
        {
          ...revision().rates[0]!,
          effectiveStart: "2026-08-01T00:00:00.000Z",
        },
        revision().rates[1]!,
      ],
    });
    const expired = revision({
      rates: [
        {
          ...revision().rates[0]!,
          effectiveEnd: "2026-07-25T00:00:00.000Z",
        },
        revision().rates[1]!,
      ],
    });

    for (const candidate of [disabled, future, expired]) {
      expect(() =>
        calculateGoldEstimate({
          market: market(),
          revision: candidate,
          direction: "CUSTOMER_BUYS_GOLD",
          quantityGp: 50_000_000n,
          secureServiceSelected: false,
          now,
        }),
      ).toThrow(GoldValidationError);
    }
  });

  it("applies fixed and percentage secure-service adjustments only when allowed", () => {
    const fixedBuy = calculateGoldEstimate({
      market: market(),
      revision: revision(),
      direction: "CUSTOMER_BUYS_GOLD",
      quantityGp: 50_000_000n,
      secureServiceSelected: true,
      now,
    });
    const fixedSell = calculateGoldEstimate({
      market: market(),
      revision: revision(),
      direction: "CUSTOMER_SELLS_GOLD",
      quantityGp: 50_000_000n,
      secureServiceSelected: true,
      now,
    });
    const percentage = calculateGoldEstimate({
      market: market({
        secureServicePricingMode: "BASIS_POINTS",
        secureServiceFixedMinorUnits: 0,
        secureServiceBps: 1_000,
      }),
      revision: revision(),
      direction: "CUSTOMER_BUYS_GOLD",
      quantityGp: 50_000_000n,
      secureServiceSelected: true,
      now,
    });

    expect(fixedBuy.estimatedTotalMinorUnits).toBe(1_449);
    expect(fixedSell.estimatedTotalMinorUnits).toBe(701);
    expect(percentage.estimatedTotalMinorUnits).toBe(1_375);
    expect(() =>
      calculateGoldEstimate({
        market: market({ secureServiceEnabled: false }),
        revision: revision(),
        direction: "CUSTOMER_BUYS_GOLD",
        quantityGp: 50_000_000n,
        secureServiceSelected: true,
        now,
      }),
    ).toThrow(GoldValidationError);
    expect(() =>
      calculateGoldEstimate({
        market: market({ secureServiceCustomerSells: false }),
        revision: revision(),
        direction: "CUSTOMER_SELLS_GOLD",
        quantityGp: 50_000_000n,
        secureServiceSelected: true,
        now,
      }),
    ).toThrow(GoldValidationError);
  });

  it("appends global pricing lines only through the customer-buy adapter", () => {
    const buy = calculateGoldEstimate({
      market: market(),
      revision: revision(),
      direction: "CUSTOMER_BUYS_GOLD",
      quantityGp: 50_000_000n,
      secureServiceSelected: false,
      now,
    });
    const priced = withGoldGlobalPricing(buy, {
      globalAdjustmentLines: [
        { label: "Global handling", amountCents: 125, ruleId: "rule1" },
      ],
      minimumMaximumAdjustmentLines: [],
      estimatedTotalCents: 1_375,
      estimatedTotal: "$13.75",
      pricingRevision: { id: "pricingrevision1", revisionNumber: 1 },
    });

    expect(priced.estimatedTotalMinorUnits).toBe(1_375);
    expect(priced.snapshot.globalPricingAdjustmentLines).toEqual([
      { label: "Global handling", amountMinorUnits: 125 },
    ]);
    expect(priced.snapshot.publishedGlobalPricingRevision).toEqual({
      id: "pricingrevision1",
      revisionNumber: 1,
    });
  });

  it("rejects unsafe currency and money overflow", () => {
    expect(() =>
      calculateGoldEstimate({
        market: market({ currencyCode: "GBP" }),
        revision: revision(),
        direction: "CUSTOMER_BUYS_GOLD",
        quantityGp: 50_000_000n,
        secureServiceSelected: false,
        now,
      }),
    ).toThrow(GoldValidationError);
    expect(() =>
      calculateRateMinorUnits({
        rateMinorUnitsPerMillion: 100_000_000,
        quantityGp: 10_000_000_000_000_000n,
      }),
    ).toThrow(GoldValidationError);
  });

  it("creates JSON-safe published revisions and estimate snapshots", () => {
    const snapshot = goldRateRevisionSnapshot({
      market: market(),
      revisionId: "goldrevision2",
      revisionNumber: 2,
      publishedAt: now,
      rates: revision().rates,
    });
    const estimate = calculateGoldEstimate({
      market: market(),
      revision: snapshot,
      direction: "CUSTOMER_BUYS_GOLD",
      quantityGp: 50_000_000n,
      secureServiceSelected: false,
      now,
    });
    const serialized = JSON.stringify(estimate.snapshot);

    expect(normalizePublishedGoldRateRevision(snapshot)).toEqual(snapshot);
    expect(normalizeGoldEstimateSnapshot(estimate.snapshot)).toEqual(
      estimate.snapshot,
    );
    expect(serialized).toContain('"quantityGp":"50000000"');
    expect(serialized).not.toMatch(/rsn|password|internal/i);
    expect(() =>
      normalizePublishedGoldRateRevision({ schemaVersion: 999 }),
    ).toThrow(GoldValidationError);
    expect(() => normalizeGoldEstimateSnapshot({ schemaVersion: 999 })).toThrow(
      GoldValidationError,
    );
  });
});
