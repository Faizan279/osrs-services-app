import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  catalogueServiceFindFirst: vi.fn(),
  featureFlagFindUnique: vi.fn(),
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

let POST: typeof import("@/app/api/premium/estimate/route").POST;

const rule = {
  normalModeMultiplierBps: 0,
  ironmanMultiplierBps: 1_000,
  hardcoreIronmanMultiplierBps: 2_000,
  ultimateIronmanMultiplierBps: 3_000,
  discordStreamEnabled: true,
  discordStreamPercentBps: 200,
  rsnEligibilityEnabled: true,
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
  requirementGroups: [],
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
  });

  it("stops calculations when the premium feature flag is disabled", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: false });

    const response = await POST(request({}) as never);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
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
