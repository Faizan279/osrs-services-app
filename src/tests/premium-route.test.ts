import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  catalogueServiceFindFirst: vi.fn(),
  featureFlagFindUnique: vi.fn(),
  configuredRsnProvider: vi.fn(),
  consumePublicLookupLimit: vi.fn(),
  lookupPublicStats: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    catalogueService: { findFirst: mocks.catalogueServiceFindFirst },
    featureFlag: { findUnique: mocks.featureFlagFindUnique },
    publicRateLimitBucket: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/eligibility/lookup", () => ({
  lookupPublicStats: mocks.lookupPublicStats,
}));

vi.mock("@/lib/eligibility/provider", () => ({
  configuredRsnProvider: mocks.configuredRsnProvider,
  RsnNotFoundError: class RsnNotFoundError extends Error {},
  RsnProviderDataError: class RsnProviderDataError extends Error {},
  RsnProviderUnavailableError: class RsnProviderUnavailableError extends Error {},
}));

vi.mock("@/lib/eligibility/rate-limit", () => ({
  consumePublicLookupLimit: mocks.consumePublicLookupLimit,
  requestIdentity: () => ({ identity: "client:test", setCookie: null }),
}));

let POST: typeof import("@/app/api/premium/estimate/route").POST;

const rule = {
  configuratorType: "FIRE_CAPE" as const,
  enabled: true,
  normalModeMultiplierBps: 0,
  ironmanMultiplierBps: 1_000,
  hardcoreIronmanMultiplierBps: 2_000,
  ultimateIronmanMultiplierBps: 3_000,
  discordStreamEnabled: true,
  discordStreamPercentBps: 200,
  rsnEligibilityEnabled: true,
  supportsManualStatFallback: true,
  standardDeliveryEnabled: true,
  standardDeliveryLabel: "Standard",
  standardDeliveryDescription: null,
  standardDeliveryEstimate: "Confirmed before checkout",
  standardDeliveryMultiplierBps: 0,
  standardDeliveryFixedFeeCents: 0,
  priorityDeliveryEnabled: true,
  priorityDeliveryLabel: "Priority",
  priorityDeliveryDescription: null,
  priorityDeliveryEstimate: "Faster estimate",
  priorityDeliveryMultiplierBps: 1_500,
  priorityDeliveryFixedFeeCents: 250,
  expressDeliveryEnabled: false,
  expressDeliveryLabel: "Express",
  expressDeliveryDescription: null,
  expressDeliveryEstimate: null,
  expressDeliveryMultiplierBps: 3_000,
  expressDeliveryFixedFeeCents: 0,
  needsClientReview: true,
};

const premiumPackage = {
  id: "package1",
  slug: "standard-fire-cape",
  name: "Standard Fire Cape run",
  enabled: true,
  basePriceCents: 10_000,
  minimumPriceCents: 12_000,
  setupFeeCents: 500,
  estimatedHours: 3,
  customerGearRequired: true,
  customerGearLabel: "Customer-provided gear",
  gearUnconfirmedAdjustmentCents: 1_500,
  requirementGroups: [
    {
      requirements: [
        {
          id: "premium-requirement-ranged",
          label: "Ranged level",
          description: "Recommended Ranged level.",
          requirementType: "SKILL" as const,
          isRequired: true,
          displayOrder: 10,
          verificationMode: "AUTOMATIC" as const,
          metricKey: "skill.ranged.level",
          comparisonOperator: "GREATER_THAN_OR_EQUAL" as const,
          requiredValue: 70,
          customerGuidance: null,
        },
        {
          id: "premium-requirement-gear",
          label: "Gear confirmation",
          description: "Customer confirms gear without sharing secrets.",
          requirementType: "GEAR" as const,
          isRequired: true,
          displayOrder: 20,
          verificationMode: "CUSTOMER_CONFIRMED" as const,
          metricKey: null,
          comparisonOperator: null,
          requiredValue: null,
          customerGuidance: "Do not provide a RuneScape password.",
        },
      ],
    },
  ],
  faqs: [],
};

const option = {
  id: "option1",
  packageId: null,
  slug: "supply-support",
  name: "Supply support",
  enabled: true,
  optionType: "SUPPLIES" as const,
  pricingMode: "FIXED_FEE" as const,
  fixedPriceCents: 1_000,
  percentBps: 0,
  perUnitPriceCents: 0,
  minimumQuantity: 1,
  maximumQuantity: 1,
  defaultQuantity: 1,
};

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/premium/estimate", {
    method: "POST",
    body: JSON.stringify({
      serviceId: "service1",
      packageSlug: "standard-fire-cape",
      optionSelections: [],
      gameMode: "NORMAL",
      customerGearConfirmed: true,
      includeDiscordStream: false,
      deliverySpeed: "STANDARD",
      ...body,
    }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.featureFlagFindUnique.mockResolvedValue({ enabled: true });
  mocks.consumePublicLookupLimit.mockResolvedValue(true);
  mocks.configuredRsnProvider.mockReturnValue({ id: "test-provider" });
  mocks.lookupPublicStats.mockResolvedValue({
    cached: false,
    profile: {
      normalizedRsn: "validrsn",
      displayName: "ValidRsn",
      fetchedAt: "2026-07-19T00:00:00.000Z",
      provider: "test-provider",
      totalLevel: 1000,
      totalXp: 0,
      skillLevels: { ranged: 70 },
      skillXp: {},
      activityScores: {},
    },
  });
  mocks.catalogueServiceFindFirst.mockResolvedValue({
    id: "service1",
    gameModes: [{ gameMode: "NORMAL" }],
    premiumConfig: rule,
    premiumPackages: [premiumPackage],
    premiumOptions: [option],
  });
});

beforeAll(async () => {
  ({ POST } = await import("@/app/api/premium/estimate/route"));
});

describe("premium estimate route", () => {
  it("calculates a server-side estimate and ignores client-submitted prices", async () => {
    const response = await POST(
      request({
        optionSelections: [{ slug: "supply-support" }],
        estimatedTotalCents: 1,
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.ok).toBe(true);
    expect(body.estimate.estimatedTotalCents).toBe(13_500);
    expect(body.estimate.estimatedTotal).toBe("$135.00");
    expect(body.estimate.finalPriceNote).toBe(
      "Final price is confirmed before checkout.",
    );
    expect(JSON.stringify(body)).not.toMatch(
      /basePriceCents|premiumConfig|rule|needsClientReview/i,
    );
    expect(body.eligibility).toBeNull();
  });

  it("evaluates customer-entered manual stats with a self-reported label", async () => {
    const response = await POST(
      request({
        statCheckMode: "MANUAL",
        manualStats: [{ metricKey: "skill.ranged.level", value: 70 }],
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.eligibility).toEqual(
      expect.objectContaining({
        ok: true,
        source: "MANUAL_STATS",
        verificationLabel: "Customer-entered / not independently verified.",
      }),
    );
    expect(body.eligibility.results).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "premium-requirement-ranged",
          status: "MET",
          actualValue: 70,
        }),
        expect.objectContaining({
          id: "premium-requirement-gear",
          status: "CUSTOMER_CONFIRMATION_REQUIRED",
          actualValue: null,
        }),
      ]),
    );
  });

  it("rejects unknown, decimal and negative manual stats server-side", async () => {
    for (const manualStats of [
      [{ metricKey: "skill.slayer.level", value: 70 }],
      [{ metricKey: "skill.ranged.level", value: 70.5 }],
      [{ metricKey: "skill.ranged.level", value: -1 }],
    ]) {
      const response = await POST(
        request({ statCheckMode: "MANUAL", manualStats }) as never,
      );
      const body = await response.json();

      expect(response.status).toBe(400);
      expect(body.ok).toBe(false);
    }
  });

  it("uses official RSN results before manual stats when lookup succeeds", async () => {
    const response = await POST(
      request({
        statCheckMode: "MANUAL",
        rsn: "ValidRsn",
        manualStats: [{ metricKey: "skill.ranged.level", value: 1 }],
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.eligibility.source).toBe("OFFICIAL_PUBLIC_STATS");
    expect(body.eligibility.profile.displayName).toBe("ValidRsn");
    expect(body.eligibility.results).toContainEqual(
      expect.objectContaining({
        id: "premium-requirement-ranged",
        status: "MET",
        actualValue: 70,
      }),
    );
  });

  it("uses configured comparison operators for premium requirements", async () => {
    const automaticRequirement =
      premiumPackage.requirementGroups[0]!.requirements[0]!;
    const gearRequirement =
      premiumPackage.requirementGroups[0]!.requirements[1]!;
    mocks.catalogueServiceFindFirst.mockResolvedValue({
      id: "service1",
      gameModes: [{ gameMode: "NORMAL" }],
      premiumConfig: rule,
      premiumPackages: [
        {
          ...premiumPackage,
          requirementGroups: [
            {
              requirements: [
                {
                  ...automaticRequirement,
                  comparisonOperator: "GREATER_THAN" as const,
                  requiredValue: 70,
                },
                gearRequirement,
              ],
            },
          ],
        },
      ],
      premiumOptions: [option],
    });

    const response = await POST(
      request({
        statCheckMode: "MANUAL",
        manualStats: [{ metricKey: "skill.ranged.level", value: 70 }],
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.eligibility.results).toContainEqual(
      expect.objectContaining({
        id: "premium-requirement-ranged",
        status: "NOT_MET",
        actualValue: 70,
      }),
    );
  });

  it("works without RSN or manual stats", async () => {
    const response = await POST(
      request({ statCheckMode: "NONE", manualStats: [] }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(body.eligibility).toBeNull();
  });

  it("stops calculations when the premium feature flag is disabled", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: false });

    const response = await POST(request({}) as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("rejects disabled premium configs", async () => {
    mocks.catalogueServiceFindFirst.mockResolvedValue({
      id: "service1",
      gameModes: [{ gameMode: "NORMAL" }],
      premiumConfig: { ...rule, enabled: false },
      premiumPackages: [premiumPackage],
      premiumOptions: [option],
    });

    const response = await POST(request({}) as never);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(body.message).toMatch(/available premium package/i);
  });

  it("rejects unsupported game modes and unavailable options safely", async () => {
    const unsupportedMode = await POST(
      request({ gameMode: "IRONMAN" }) as never,
    );
    const unsupportedModeBody = await unsupportedMode.json();

    expect(unsupportedMode.status).toBe(400);
    expect(unsupportedModeBody.message).toMatch(/supported account mode/i);

    const missingOption = await POST(
      request({ optionSelections: [{ slug: "disabled-option" }] }) as never,
    );
    const missingOptionBody = await missingOption.json();

    expect(missingOption.status).toBe(400);
    expect(missingOptionBody.message).toMatch(/available premium option/i);
    expect(JSON.stringify(missingOptionBody)).not.toMatch(/Prisma|SQL/i);
  });

  it("returns a generic message for unexpected server errors", async () => {
    mocks.catalogueServiceFindFirst.mockRejectedValue(
      new Error("Prisma SQL CatalogueService failure"),
    );

    const response = await POST(request({}) as never);
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.message).toBe(
      "The estimate could not be calculated. Please try again.",
    );
    expect(JSON.stringify(body)).not.toMatch(/Prisma|SQL|CatalogueService/i);
  });
});
