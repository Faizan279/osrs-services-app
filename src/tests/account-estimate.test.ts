import { describe, expect, it } from "vitest";

import {
  AccountMarketplaceValidationError,
  accountListingRevisionSnapshot,
  calculateAccountListingEstimate,
  normalizeAccountListingSnapshot,
  normalizePublishedAccountListingRevision,
  withAccountGlobalPricing,
  type PublishedAccountListingRevisionSnapshotV1,
} from "@/lib/accounts/estimate";

const now = new Date("2026-07-27T12:00:00.000Z");

function revision(
  overrides: Partial<PublishedAccountListingRevisionSnapshotV1> = {},
): PublishedAccountListingRevisionSnapshotV1 {
  return {
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
      fullDescription:
        "A public-safe listing with visible stats, unlocks and features only.",
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
    stats: [
      {
        stableKey: "stat-total",
        statKey: "total-level",
        publicLabel: "Total level",
        value: 1950,
        maximumValue: 2277,
        statGroup: "Summary",
        sortOrder: 10,
      },
      {
        stableKey: "stat-combat",
        statKey: "combat-level",
        publicLabel: "Combat level",
        value: 118,
        maximumValue: 126,
        statGroup: "Summary",
        sortOrder: 20,
      },
    ],
    unlocks: [
      {
        stableKey: "unlock-barrows-gloves",
        unlockKey: "barrows-gloves",
        publicLabel: "Barrows gloves",
        description: "Quest unlock listed for public browsing.",
        unlockType: "UNTRADEABLE",
        sortOrder: 10,
      },
    ],
    features: [
      {
        stableKey: "feature-pvm-ready",
        featureKey: "pvm-ready",
        publicLabel: "PvM ready",
        description: "Prepared for common PvM support conversations.",
        sortOrder: 10,
      },
    ],
    images: [
      {
        stableKey: "image-cover",
        imageType: "COVER",
        assetPath: "/artwork/portal-hero-desktop.webp",
        altText: "Public-safe account listing cover",
        caption: "Demo cover image",
        sortOrder: 10,
      },
    ],
    ...overrides,
  };
}

describe("account listing estimate engine", () => {
  it("uses the published listing revision as the server price source", () => {
    const result = calculateAccountListingEstimate({
      revision: revision(),
      availability: "AVAILABLE",
      approvalStatus: "APPROVED",
      publicationStatus: "PUBLISHED",
      now,
    });

    expect(result.basePriceCents).toBe(24_999);
    expect(result.estimatedTotalCents).toBe(24_999);
    expect(result.estimatedTotal).toBe("$249.99");
    expect(result.lineItems).toEqual([
      { label: "Account listing base price", amountCents: 24_999 },
    ]);
    expect(result.snapshot.listing.stableKey).toBe("account-main-pvm-ready");
    expect(result.snapshot.availabilityRecheckRequired).toBe(true);
  });

  it("rejects unapproved, draft, held and sold listings", () => {
    const published = revision();
    expect(() =>
      calculateAccountListingEstimate({
        revision: published,
        availability: "AVAILABLE",
        approvalStatus: "PENDING_REVIEW",
        publicationStatus: "PUBLISHED",
      }),
    ).toThrow(AccountMarketplaceValidationError);
    expect(() =>
      calculateAccountListingEstimate({
        revision: published,
        availability: "AVAILABLE",
        approvalStatus: "APPROVED",
        publicationStatus: "DRAFT",
      }),
    ).toThrow(AccountMarketplaceValidationError);
    for (const availability of ["HELD", "SOLD", "PAUSED"] as const) {
      expect(() =>
        calculateAccountListingEstimate({
          revision: published,
          availability,
          approvalStatus: "APPROVED",
          publicationStatus: "PUBLISHED",
        }),
      ).toThrow(AccountMarketplaceValidationError);
    }
  });

  it("appends global pricing lines without changing the base line", () => {
    const result = calculateAccountListingEstimate({
      revision: revision(),
      availability: "AVAILABLE",
      approvalStatus: "APPROVED",
      publicationStatus: "PUBLISHED",
      now,
    });
    const priced = withAccountGlobalPricing(result, {
      globalAdjustmentLines: [
        { label: "Marketplace handling", amountCents: 500, ruleId: "rule1" },
      ],
      minimumMaximumAdjustmentLines: [],
      estimatedTotalCents: 25_499,
      estimatedTotal: "$254.99",
      pricingRevision: { id: "pricingrevision1", revisionNumber: 1 },
    });

    expect(priced.lineItems[0]).toEqual({
      label: "Account listing base price",
      amountCents: 24_999,
    });
    expect(priced.estimatedTotalCents).toBe(25_499);
    expect(priced.snapshot.globalPricingAdjustmentLines).toEqual([
      { label: "Marketplace handling", amountCents: 500, ruleId: "rule1" },
    ]);
    expect(priced.snapshot.publishedGlobalPricingRevision).toEqual({
      id: "pricingrevision1",
      revisionNumber: 1,
    });
  });

  it("rejects unsupported currencies, unsafe money and unknown snapshot versions", () => {
    expect(() =>
      calculateAccountListingEstimate({
        revision: revision({
          listing: {
            ...revision().listing,
            currencyCode: "GBP",
          },
        }),
        availability: "AVAILABLE",
        approvalStatus: "APPROVED",
        publicationStatus: "PUBLISHED",
      }),
    ).toThrow(AccountMarketplaceValidationError);
    expect(() =>
      normalizePublishedAccountListingRevision({
        ...revision(),
        schemaVersion: 999,
      }),
    ).toThrow(AccountMarketplaceValidationError);
    expect(() =>
      normalizeAccountListingSnapshot({ schemaVersion: 999 }),
    ).toThrow(AccountMarketplaceValidationError);
  });

  it("creates JSON-safe public snapshots without credential-like content", () => {
    const snapshot = accountListingRevisionSnapshot({
      marketplace: revision().marketplace,
      listing: revision().listing,
      revisionId: "revision2",
      revisionNumber: 2,
      publishedAt: now,
      stats: revision().stats,
      unlocks: revision().unlocks,
      features: revision().features,
      images: revision().images,
    });
    const estimate = calculateAccountListingEstimate({
      revision: snapshot,
      availability: "AVAILABLE",
      approvalStatus: "APPROVED",
      publicationStatus: "PUBLISHED",
      now,
    });
    const serialized = JSON.stringify(estimate.snapshot);

    expect(normalizePublishedAccountListingRevision(snapshot)).toEqual(
      snapshot,
    );
    expect(normalizeAccountListingSnapshot(estimate.snapshot)).toEqual(
      estimate.snapshot,
    );
    expect(serialized).not.toMatch(
      /password|login|emailAddress|recovery|authenticator|bankPin|cookie|token/i,
    );
    expect(serialized).not.toMatch(/internalReference|internalNotes/i);
  });
});
