import { describe, expect, it } from "vitest";

import {
  applyBasisPoints,
  applyGlobalPricing,
  normalizePriceSnapshotV1,
  normalizePublishedPricingRevision,
  PricingValidationError,
  selectApplicableRules,
  type PricingRuleSnapshot,
  type PricingSource,
  type PublishedPricingRevisionSnapshotV1,
} from "@/lib/pricing/engine";

function source(overrides: Partial<PricingSource> = {}): PricingSource {
  return {
    serviceId: "service1",
    serviceSlug: "fire-cape",
    categoryId: "category1",
    categorySlug: "combat",
    engineType: "PREMIUM_SERVICE_CONFIGURATOR",
    currency: "USD",
    baseSubtotalCents: 10_000,
    basePricingLines: [{ label: "Base engine subtotal", amountCents: 10_000 }],
    selectedReferences: {
      packageSlug: "standard-fire-cape",
      gameMode: "NORMAL",
    },
    engineConfigurationRevision: {
      id: "premiumconfig1",
      version: 3,
    },
    ...overrides,
  };
}

function rule(overrides: Partial<PricingRuleSnapshot>): PricingRuleSnapshot {
  return {
    id: "rule1",
    publicLabel: "Global adjustment",
    enabled: true,
    ruleType: "FIXED_ADDITION",
    amountCents: 100,
    valueBps: null,
    priority: 0,
    exclusiveGroupKey: null,
    effectiveStart: null,
    effectiveEnd: null,
    applicability: [
      {
        scope: "GLOBAL",
        engineType: null,
        categoryId: null,
        serviceId: null,
      },
    ],
    ...overrides,
  };
}

function revision(
  rules: PricingRuleSnapshot[],
): PublishedPricingRevisionSnapshotV1 {
  return {
    schemaVersion: 1,
    ruleSetId: "ruleset1",
    revisionId: "revision1",
    revisionNumber: 1,
    currencyCode: "USD",
    publishedAt: "2026-07-23T00:00:00.000Z",
    rules,
  };
}

describe("global pricing engine", () => {
  it("stacks fixed, percentage, minimum and maximum rules in the published order", () => {
    const result = applyGlobalPricing({
      source: source(),
      revision: revision([
        rule({
          id: "fixed",
          publicLabel: "Fixed service fee",
          ruleType: "FIXED_ADDITION",
          amountCents: 1_000,
        }),
        rule({
          id: "percent",
          publicLabel: "Demand adjustment",
          ruleType: "PERCENTAGE_ADDITION",
          amountCents: null,
          valueBps: 1_000,
        }),
        rule({
          id: "minimum",
          publicLabel: "Minimum total",
          ruleType: "MINIMUM_TOTAL",
          amountCents: 15_000,
        }),
        rule({
          id: "maximum",
          publicLabel: "Maximum total",
          ruleType: "MAXIMUM_TOTAL",
          amountCents: 14_000,
        }),
      ]),
      now: new Date("2026-07-23T12:00:00.000Z"),
    });

    expect(result.estimatedTotalCents).toBe(14_000);
    expect(result.estimatedTotal).toBe("$140.00");
    expect(result.globalAdjustmentLines).toEqual([
      { label: "Fixed service fee", amountCents: 1_000, ruleId: "fixed" },
      { label: "Demand adjustment", amountCents: 1_100, ruleId: "percent" },
    ]);
    expect(result.minimumMaximumAdjustmentLines).toEqual([
      { label: "Minimum total", amountCents: 2_900, ruleId: "minimum" },
      { label: "Maximum total", amountCents: -1_000, ruleId: "maximum" },
    ]);
    expect(result.priceSnapshot).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        finalEstimatedTotalCents: 14_000,
        repricingRequired: false,
      }),
    );
  });

  it("rounds percentage rules half up to whole cents", () => {
    expect(applyBasisPoints(101, 500)).toBe(5);
    expect(applyBasisPoints(101, 550)).toBe(6);
  });

  it("selects by priority, then specificity, then stable rule id", () => {
    const rules = [
      rule({
        id: "global",
        publicLabel: "Global",
        priority: 10,
        exclusiveGroupKey: "delivery",
      }),
      rule({
        id: "service",
        publicLabel: "Service",
        priority: 10,
        exclusiveGroupKey: "delivery",
        applicability: [
          {
            scope: "SERVICE",
            engineType: null,
            categoryId: null,
            serviceId: "service1",
          },
        ],
      }),
      rule({
        id: "engine",
        publicLabel: "Engine",
        priority: -1,
        exclusiveGroupKey: "regional",
        applicability: [
          {
            scope: "ENGINE_TYPE",
            engineType: "PREMIUM_SERVICE_CONFIGURATOR",
            categoryId: null,
            serviceId: null,
          },
        ],
      }),
      rule({
        id: "category",
        publicLabel: "Category",
        priority: -1,
        exclusiveGroupKey: "regional",
        applicability: [
          {
            scope: "CATEGORY",
            engineType: null,
            categoryId: "category1",
            serviceId: null,
          },
        ],
      }),
    ];

    expect(
      selectApplicableRules({
        source: source(),
        rules,
        now: new Date("2026-07-23T12:00:00.000Z"),
      }).map(({ rule: selectedRule }) => selectedRule.id),
    ).toEqual(["category", "service"]);
  });

  it("ignores disabled, future, expired and nonmatching rules", () => {
    const result = applyGlobalPricing({
      source: source(),
      revision: revision([
        rule({ id: "disabled", enabled: false, amountCents: 50_000 }),
        rule({
          id: "future",
          amountCents: 50_000,
          effectiveStart: "2026-08-01T00:00:00.000Z",
        }),
        rule({
          id: "expired",
          amountCents: 50_000,
          effectiveEnd: "2026-07-01T00:00:00.000Z",
        }),
        rule({
          id: "other-service",
          amountCents: 50_000,
          applicability: [
            {
              scope: "SERVICE",
              engineType: null,
              categoryId: null,
              serviceId: "other-service",
            },
          ],
        }),
        rule({
          id: "current",
          publicLabel: "Current rule",
          amountCents: 250,
        }),
      ]),
      now: new Date("2026-07-23T12:00:00.000Z"),
    });

    expect(result.estimatedTotalCents).toBe(10_250);
    expect(result.globalAdjustmentLines).toEqual([
      { label: "Current rule", amountCents: 250, ruleId: "current" },
    ]);
  });

  it("normalizes immutable snapshots and rejects unknown schema versions", () => {
    const result = applyGlobalPricing({
      source: source(),
      revision: revision([]),
      now: new Date("2026-07-23T12:00:00.000Z"),
    });

    expect(normalizePriceSnapshotV1(result.priceSnapshot)).toEqual(
      result.priceSnapshot,
    );
    expect(normalizePublishedPricingRevision(revision([]))).toEqual(
      revision([]),
    );
    expect(() =>
      normalizePublishedPricingRevision({ schemaVersion: 999 }),
    ).toThrow(PricingValidationError);
    expect(() => normalizePriceSnapshotV1({ schemaVersion: 999 })).toThrow(
      PricingValidationError,
    );
    expect(() =>
      normalizePublishedPricingRevision(
        revision([
          rule({
            applicability: [
              {
                scope: "ENGINE_TYPE",
                engineType: "UNKNOWN_ENGINE" as never,
                categoryId: null,
                serviceId: null,
              },
            ],
          }),
        ]),
      ),
    ).toThrow(PricingValidationError);
  });

  it("guards against unsafe money overflow", () => {
    expect(() =>
      applyGlobalPricing({
        source: source({
          baseSubtotalCents: 100_000_000,
          basePricingLines: [
            { label: "Very large subtotal", amountCents: 100_000_000 },
          ],
        }),
        revision: revision([rule({ amountCents: 1 })]),
      }),
    ).toThrow(PricingValidationError);
  });

  it("rejects currency mismatches before producing a price snapshot", () => {
    expect(() =>
      applyGlobalPricing({
        source: source({ currency: "USD" }),
        revision: { ...revision([]), currencyCode: "GBP" },
      }),
    ).toThrow(PricingValidationError);
  });
});
