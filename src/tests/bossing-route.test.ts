import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  catalogueServiceFindFirst: vi.fn(),
  featureFlagFindUnique: vi.fn(),
  pricingRevisionFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    catalogueService: { findFirst: mocks.catalogueServiceFindFirst },
    featureFlag: { findUnique: mocks.featureFlagFindUnique },
    pricingRevision: { findFirst: mocks.pricingRevisionFindFirst },
  },
}));

let POST: typeof import("@/app/api/bossing/estimate/route").POST;

const rule = {
  id: "bossingrule1",
  normalModeMultiplierBps: 0,
  ironmanMultiplierBps: 1000,
  hardcoreIronmanMultiplierBps: 2000,
  ultimateIronmanMultiplierBps: 3000,
  discordStreamEnabled: true,
  discordStreamPercentBps: 200,
  standardDeliveryEnabled: true,
  standardDeliveryLabel: "Standard",
  standardDeliveryDescription: null,
  standardDeliveryEstimate: "Reviewed before checkout",
  standardDeliveryMultiplierBps: 0,
  standardDeliveryFixedFeeCents: 0,
  priorityDeliveryEnabled: true,
  priorityDeliveryLabel: "Priority",
  priorityDeliveryDescription: null,
  priorityDeliveryEstimate: null,
  priorityDeliveryMultiplierBps: 1500,
  priorityDeliveryFixedFeeCents: 0,
  expressDeliveryEnabled: false,
  expressDeliveryLabel: "Express",
  expressDeliveryDescription: null,
  expressDeliveryEstimate: null,
  expressDeliveryMultiplierBps: 3000,
  expressDeliveryFixedFeeCents: 0,
};

const method = {
  name: "Standard kill support",
  enabled: true,
  priceMode: "PER_KILL" as const,
  minimumKillCount: 1,
  maximumKillCount: 100,
  basePriceCentsPerKill: 100,
  fixedPackagePriceCents: 0,
  minimumPriceCents: 500,
  setupFeeCents: 0,
  suppliesEnabled: false,
  suppliesLabel: null,
  suppliesFeeCents: 0,
  customerGearRequired: false,
  customerGearLabel: null,
  gearAdjustmentCents: 0,
  estimatedKillsPerHour: 20,
  statRequirements: [],
  gearRequirements: [],
};

const globalPricingRevision = {
  schemaVersion: 1,
  ruleSetId: "globalpricingdraftseed",
  revisionId: "pricingrevision3",
  revisionNumber: 3,
  currencyCode: "USD",
  publishedAt: "2026-07-23T00:00:00.000Z",
  rules: [
    {
      id: "bossingglobal",
      publicLabel: "Bossing platform adjustment",
      enabled: true,
      ruleType: "FIXED_ADDITION",
      amountCents: 250,
      valueBps: null,
      priority: 0,
      exclusiveGroupKey: null,
      effectiveStart: null,
      effectiveEnd: null,
      applicability: [
        {
          scope: "ENGINE_TYPE",
          engineType: "BOSSING_ENGINE",
          categoryId: null,
          serviceId: null,
        },
      ],
    },
  ],
};

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/bossing/estimate", {
    method: "POST",
    body: JSON.stringify({
      serviceId: "service1",
      bossKey: "giant-mole",
      methodSlug: "standard-kills",
      killMode: "DIRECT",
      killQuantity: 10,
      gameMode: "NORMAL",
      customerGearConfirmed: true,
      includeSupplies: false,
      includeDiscordStream: false,
      deliverySpeed: "STANDARD",
      ...body,
    }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.featureFlagFindUnique.mockImplementation(({ where }) =>
    Promise.resolve({
      enabled: where.key !== "global_pricing_enabled",
    }),
  );
  mocks.pricingRevisionFindFirst.mockResolvedValue(null);
  mocks.catalogueServiceFindFirst.mockResolvedValue({
    id: "service1",
    slug: "giant-mole",
    categoryId: "category1",
    engineType: "BOSSING_ENGINE",
    version: 8,
    gameModes: [{ gameMode: "NORMAL" }],
    bossingRule: rule,
    bossingBosses: [{ name: "Giant Mole", methods: [method] }],
  });
});

beforeAll(async () => {
  ({ POST } = await import("@/app/api/bossing/estimate/route"));
});

describe("bossing estimate route", () => {
  it("calculates a server-side estimate and ignores client-submitted prices", async () => {
    const response = await POST(request({ estimatedTotalCents: 1 }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.ok).toBe(true);
    expect(body.estimate.estimatedTotalCents).toBe(1_000);
    expect(body.estimate.estimatedTotal).toBe("$10.00");
    expect(JSON.stringify(body)).not.toMatch(/basePriceCentsPerKill|rule/i);
    expect(body.estimate.pricingRevision).toBeNull();
  });

  it("applies global pricing after the bossing engine estimate", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: true });
    mocks.pricingRevisionFindFirst.mockResolvedValue({
      snapshot: globalPricingRevision,
    });

    const response = await POST(request({ estimatedTotalCents: 1 }) as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.estimate.estimatedTotalCents).toBe(1_250);
    expect(body.estimate.estimatedTotal).toBe("$12.50");
    expect(body.estimate.globalAdjustmentLines).toEqual([
      {
        label: "Bossing platform adjustment",
        amountCents: 250,
      },
    ]);
    expect(body.estimate.priceSnapshot.selectedReferences).toEqual(
      expect.objectContaining({
        bossKey: "giant-mole",
        methodSlug: "standard-kills",
      }),
    );
    expect(JSON.stringify(body)).not.toContain("bossingglobal");
  });

  it("stops calculations when the feature flag is disabled", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: false });

    const response = await POST(request({}) as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("rejects invalid target KC without leaking internals", async () => {
    const response = await POST(
      request({
        killMode: "TARGET_KC",
        currentKillCount: 10,
        targetKillCount: 10,
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/greater than current/i);
    expect(JSON.stringify(body)).not.toMatch(/Prisma|CatalogueService|SQL/i);
  });
});
