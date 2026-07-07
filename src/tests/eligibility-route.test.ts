import { NextRequest } from "next/server";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  catalogueServiceFindFirst: vi.fn(),
  consumePublicLookupLimit: vi.fn(),
  featureFlagFindUnique: vi.fn(),
  lookupPublicStats: vi.fn(),
  requestIdentity: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    catalogueService: { findFirst: mocks.catalogueServiceFindFirst },
    featureFlag: { findUnique: mocks.featureFlagFindUnique },
  },
}));

vi.mock("@/lib/eligibility/lookup", () => ({
  lookupPublicStats: mocks.lookupPublicStats,
}));

vi.mock("@/lib/eligibility/rate-limit", () => ({
  consumePublicLookupLimit: mocks.consumePublicLookupLimit,
  requestIdentity: mocks.requestIdentity,
}));

let POST: typeof import("@/app/api/catalogue/eligibility/route").POST;

const profile = {
  normalizedRsn: "Sample User",
  displayName: null,
  fetchedAt: "2026-07-06T00:00:00.000Z",
  provider: "fixture",
  totalLevel: 1500,
  totalXp: 25_000_000,
  skillLevels: { attack: 75 },
  skillXp: { attack: 1_200_000 },
  activityScores: {},
};

function eligibilityRequest() {
  return new NextRequest("https://example.test/api/catalogue/eligibility", {
    method: "POST",
    body: JSON.stringify({ rsn: "Sample User", serviceId: "service1" }),
    headers: { "content-type": "application/json" },
  });
}

async function expectSanitizedWorkflowFailure(
  failure: () => void,
  expectedStatus = 500,
) {
  const report = vi.spyOn(console, "error").mockImplementation(() => {});
  failure();
  const response = await POST(eligibilityRequest());
  const body = await response.json();
  const serializedBody = JSON.stringify(body);
  const serializedLog = JSON.stringify(report.mock.calls);

  expect(response.status).toBe(expectedStatus);
  expect(response.headers.get("cache-control")).toContain("no-store");
  expect(serializedBody).toContain("UNAVAILABLE");
  expect(serializedBody).not.toMatch(
    /Sample User|203\.0\.113\.10|osrs_public_client|SQL|stack|CatalogueService/i,
  );
  expect(serializedLog).not.toMatch(
    /Sample User|203\.0\.113\.10|osrs_public_client|SQL|stack|CatalogueService/i,
  );
  report.mockRestore();
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.featureFlagFindUnique.mockResolvedValue({ enabled: true });
  mocks.consumePublicLookupLimit.mockResolvedValue(true);
  mocks.requestIdentity.mockReturnValue({
    identity: "client:opaque-token",
    setCookie: null,
  });
  mocks.catalogueServiceFindFirst.mockResolvedValue({
    id: "service1",
    name: "Sample service",
    requirements: [],
    offerings: [],
  });
  mocks.lookupPublicStats.mockResolvedValue({ profile, cached: false });
});

beforeAll(async () => {
  ({ POST } = await import("@/app/api/catalogue/eligibility/route"));
});

describe("RSN eligibility route workflow boundary", () => {
  it("sets the public client cookie on rate-limited workflow responses", async () => {
    mocks.requestIdentity.mockReturnValue({
      identity: "client:opaque-token",
      setCookie: {
        name: "osrs_public_client",
        value: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        options: {
          httpOnly: true,
          sameSite: "lax",
          secure: false,
          path: "/",
          maxAge: 2_592_000,
        },
      },
    });
    mocks.consumePublicLookupLimit.mockResolvedValue(false);

    const response = await POST(eligibilityRequest());

    expect(response.status).toBe(429);
    expect(response.headers.get("set-cookie")).toMatch(
      /osrs_public_client=.*HttpOnly.*SameSite=Lax/i,
    );
  });

  it("sanitizes feature-flag database failures", async () => {
    await expectSanitizedWorkflowFailure(() => {
      mocks.featureFlagFindUnique.mockRejectedValue(
        new Error(
          "SQL failed for CatalogueService stack Sample User 203.0.113.10 osrs_public_client",
        ),
      );
    });
  });

  it("sanitizes rate-limit store failures", async () => {
    await expectSanitizedWorkflowFailure(() => {
      mocks.consumePublicLookupLimit.mockRejectedValue(
        new Error(
          "SQL failed for PublicRateLimitBucket stack Sample User 203.0.113.10 osrs_public_client",
        ),
      );
    });
  });

  it("sanitizes catalogue lookup failures", async () => {
    await expectSanitizedWorkflowFailure(() => {
      mocks.catalogueServiceFindFirst.mockRejectedValue(
        new Error(
          "SQL failed for CatalogueService stack Sample User 203.0.113.10 osrs_public_client",
        ),
      );
    });
  });
});
