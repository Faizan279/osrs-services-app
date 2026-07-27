import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  featureFlagFindUnique: vi.fn(),
  accountListingFindMany: vi.fn(),
  pricingRevisionFindFirst: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    featureFlag: { findUnique: mocks.featureFlagFindUnique },
    accountListing: { findMany: mocks.accountListingFindMany },
    pricingRevision: { findFirst: mocks.pricingRevisionFindFirst },
  },
}));

let POST: typeof import("@/app/api/accounts/estimate/route").POST;

const publishedRevision = {
  schemaVersion: 1,
  marketplace: {
    id: "accountmarket1",
    stableKey: "account-main-marketplace",
    slug: "accounts",
    serviceId: "service1",
    serviceSlug: "account-marketplace",
    categoryId: "category1",
    categorySlug: "accounts",
    publicName: "Prebuilt Account Marketplace",
    currencyCode: "USD",
  },
  listing: {
    id: "listing1",
    stableKey: "account-main-pvm-ready",
    slug: "main-pvm-ready",
    publicTitle: "Main PvM ready account",
    shortDescription: "A public-safe account listing for support review.",
    fullDescription: "Public-safe account listing content.",
    gameMode: "NORMAL",
    currencyCode: "USD",
    basePriceCents: 24_999,
    combatLevel: 118,
    totalLevel: 1950,
    questPoints: 275,
    accountAgeLabel: "Established account",
    membershipStateLabel: "Members-ready",
    publicBadgeText: "PvM ready",
    secureHandoverLabel: "Secure handover process available",
  },
  revision: {
    id: "revision1",
    revisionNumber: 1,
    publishedAt: "2026-07-27T00:00:00.000Z",
  },
  stats: [],
  unlocks: [],
  features: [],
  images: [],
};

const listing = {
  id: "listing1",
  availability: "AVAILABLE",
  approvalStatus: "APPROVED",
  publicationStatus: "PUBLISHED",
  marketplace: {
    serviceId: "service1",
    service: {
      id: "service1",
      slug: "account-marketplace",
      categoryId: "category1",
      category: { id: "category1", slug: "accounts" },
    },
  },
  revisions: [{ snapshot: publishedRevision }],
};

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/accounts/estimate", {
    method: "POST",
    body: JSON.stringify({
      listingSlug: "main-pvm-ready",
      ...body,
    }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.featureFlagFindUnique.mockImplementation(({ where }) =>
    Promise.resolve({
      enabled:
        where.key === "account_marketplace_enabled" ||
        where.key === "global_pricing_enabled",
    }),
  );
  mocks.accountListingFindMany.mockResolvedValue([listing]);
  mocks.pricingRevisionFindFirst.mockResolvedValue(null);
});

beforeAll(async () => {
  ({ POST } = await import("@/app/api/accounts/estimate/route"));
});

describe("account estimate route", () => {
  it("loads the listing price from the server and ignores client totals", async () => {
    const response = await POST(
      request({
        basePriceCents: 1,
        estimatedTotalCents: 1,
        availability: "AVAILABLE",
        globalAdjustmentLines: [{ label: "fake", amountCents: 1 }],
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.ok).toBe(true);
    expect(body.estimate.basePriceCents).toBe(24_999);
    expect(body.estimate.estimatedTotalCents).toBe(24_999);
    expect(JSON.stringify(body)).not.toMatch(/basePriceCents":1|fake/);
  });

  it("applies customer-safe global pricing when enabled", async () => {
    mocks.pricingRevisionFindFirst.mockResolvedValue({
      snapshot: {
        schemaVersion: 1,
        ruleSetId: "globalpricing",
        revisionId: "pricingrevision1",
        revisionNumber: 1,
        currencyCode: "USD",
        publishedAt: "2026-07-27T00:00:00.000Z",
        rules: [
          {
            id: "accountglobal",
            publicLabel: "Marketplace handling",
            enabled: true,
            ruleType: "FIXED_ADDITION",
            amountCents: 500,
            valueBps: null,
            priority: 0,
            exclusiveGroupKey: null,
            effectiveStart: null,
            effectiveEnd: null,
            applicability: [
              {
                scope: "ENGINE_TYPE",
                engineType: "ACCOUNT_MARKETPLACE",
                categoryId: null,
                serviceId: null,
              },
            ],
          },
        ],
      },
    });

    const response = await POST(request({}) as never);
    const body = await response.json();

    expect(body.estimate.estimatedTotalCents).toBe(25_499);
    expect(body.estimate.lineItems).toEqual(
      expect.arrayContaining([
        { label: "Marketplace handling", amountCents: 500 },
      ]),
    );
  });

  it("returns controlled errors for disabled and unavailable listings", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: false });
    const disabled = await POST(request({}) as never);
    expect(disabled.status).toBe(400);
    expect((await disabled.json()).message).toMatch(/temporarily unavailable/i);

    mocks.featureFlagFindUnique.mockImplementation(({ where }) =>
      Promise.resolve({ enabled: where.key === "account_marketplace_enabled" }),
    );
    mocks.accountListingFindMany.mockResolvedValue([
      { ...listing, availability: "HELD" },
    ]);
    const held = await POST(request({}) as never);
    const heldBody = await held.json();
    expect(held.status).toBe(400);
    expect(heldBody.message).toMatch(/held/i);
    expect(JSON.stringify(heldBody)).not.toMatch(/reason|createdBy|actor/i);
  });

  it("rejects malformed listing identifiers safely", async () => {
    const response = await POST(
      request({ listingSlug: "../secret", listingId: "" }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.ok).toBe(false);
    expect(JSON.stringify(body)).not.toMatch(/stack|Prisma/);
  });
});
