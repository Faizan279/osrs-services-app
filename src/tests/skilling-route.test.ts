import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  catalogueServiceFindFirst: vi.fn(),
  featureFlagFindUnique: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    catalogueService: { findFirst: mocks.catalogueServiceFindFirst },
    featureFlag: { findUnique: mocks.featureFlagFindUnique },
  },
}));

let POST: typeof import("@/app/api/skilling/estimate/route").POST;

const rule = {
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
  name: "Melee training review",
  enabled: true,
  minimumLevel: 1,
  maximumLevel: 99,
  xpPerHour: 50_000,
  basePriceCentsPerMillionXp: 10_000,
  minimumPriceCents: 500,
  fixedFeeCents: 0,
  suppliesEnabled: false,
  suppliesLabel: null,
  suppliesFeeCents: 0,
};

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/skilling/estimate", {
    method: "POST",
    body: JSON.stringify({
      serviceId: "service1",
      skillKey: "ATTACK",
      methodSlug: "melee-training-review",
      inputMode: "LEVEL",
      currentLevel: 1,
      targetLevel: 2,
      gameMode: "NORMAL",
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
  mocks.featureFlagFindUnique.mockResolvedValue({ enabled: true });
  mocks.catalogueServiceFindFirst.mockResolvedValue({
    id: "service1",
    gameModes: [{ gameMode: "NORMAL" }],
    skillingRule: rule,
    skillingSkills: [{ name: "Attack", methods: [method] }],
  });
});

beforeAll(async () => {
  ({ POST } = await import("@/app/api/skilling/estimate/route"));
});

describe("skilling estimate route", () => {
  it("calculates a server-side estimate and ignores client-submitted prices", async () => {
    const response = await POST(request({ estimatedTotalCents: 1 }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.ok).toBe(true);
    expect(body.estimate.estimatedTotalCents).toBe(500);
    expect(body.estimate.estimatedTotal).toBe("$5.00");
    expect(JSON.stringify(body)).not.toMatch(
      /basePriceCentsPerMillionXp|rule/i,
    );
  });

  it("stops calculations when the feature flag is disabled", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: false });

    const response = await POST(request({}));
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.ok).toBe(false);
  });

  it("rejects unsupported game modes without leaking internals", async () => {
    const response = await POST(request({ gameMode: "IRONMAN" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/supported account mode/i);
    expect(JSON.stringify(body)).not.toMatch(/Prisma|CatalogueService|SQL/i);
  });
});
