import { describe, expect, it } from "vitest";

import {
  ProductMarketplaceValidationError,
  calculateProductEstimate,
  normalizeProductEstimateSnapshot,
  normalizePublishedProductRevision,
  productRevisionSnapshot,
  withProductGlobalPricing,
  type ProductEstimateAvailabilityInput,
  type PublishedProductRevisionSnapshotV1,
} from "@/lib/products/estimate";

const now = new Date("2026-07-30T15:00:00.000Z");

function revision(
  overrides: Partial<PublishedProductRevisionSnapshotV1> = {},
): PublishedProductRevisionSnapshotV1 {
  return {
    schemaVersion: 1,
    marketplace: {
      id: "productmarket1",
      stableKey: "product-main-marketplace",
      slug: "products",
      serviceId: "service1",
      serviceSlug: "product-marketplace",
      categoryId: "category1",
      categorySlug: "products",
      publicName: "Product Marketplace",
      currencyCode: "USD",
    },
    product: {
      id: "product1",
      stableKey: "product-demo",
      slug: "demo-product",
      publicTitle: "Demo product",
      shortDescription: "Public product description.",
      fullDescription: "Public product detail used for searching.",
      productType: "ITEM",
      currencyCode: "USD",
      publicBadgeText: "Review",
      isFeatured: true,
      category: {
        stableKey: "category-items",
        slug: "items",
        publicName: "Items",
        productType: "ITEM",
      },
    },
    revision: {
      id: "revision1",
      revisionNumber: 1,
      publishedAt: now.toISOString(),
    },
    variants: [
      {
        stableKey: "variant-unit",
        publicName: "Unit",
        publicSku: "UNIT",
        unitLabel: "unit",
        priceMode: "FIXED_UNIT",
        baseUnitPriceCents: 125,
        minimumQuantity: "1",
        maximumQuantity: "100",
        quantityIncrement: "1",
        stockMode: "TRACKED",
        sortOrder: 10,
        enabled: true,
        priceTiers: [],
      },
      {
        stableKey: "variant-tiered",
        publicName: "Tiered",
        publicSku: "TIER",
        unitLabel: "bond",
        priceMode: "QUANTITY_TIER",
        baseUnitPriceCents: 999,
        minimumQuantity: "1",
        maximumQuantity: "50",
        quantityIncrement: "1",
        stockMode: "TRACKED",
        sortOrder: 20,
        enabled: true,
        priceTiers: [
          {
            stableKey: "tier-1-4",
            minimumQuantity: "1",
            maximumQuantity: "4",
            unitPriceCents: 899,
            sortOrder: 10,
            enabled: true,
          },
          {
            stableKey: "tier-5-plus",
            minimumQuantity: "5",
            maximumQuantity: null,
            unitPriceCents: 849,
            sortOrder: 20,
            enabled: true,
          },
        ],
      },
      {
        stableKey: "variant-package",
        publicName: "Package",
        publicSku: "PACK",
        unitLabel: "package",
        priceMode: "FIXED_PACKAGE",
        baseUnitPriceCents: 4999,
        minimumQuantity: "1",
        maximumQuantity: "1",
        quantityIncrement: "1",
        stockMode: "UNLIMITED",
        sortOrder: 30,
        enabled: true,
        priceTiers: [],
      },
      {
        stableKey: "variant-review",
        publicName: "Review package",
        publicSku: "REVIEW",
        unitLabel: "package",
        priceMode: "MANUAL_REVIEW",
        baseUnitPriceCents: 0,
        minimumQuantity: "1",
        maximumQuantity: "1",
        quantityIncrement: "1",
        stockMode: "MANUAL_REVIEW",
        sortOrder: 40,
        enabled: true,
        priceTiers: [],
      },
    ],
    tags: [
      {
        stableKey: "tag-stackable",
        slug: "stackable",
        publicLabel: "Stackable",
      },
    ],
    images: [
      {
        stableKey: "image-cover",
        imageType: "COVER",
        assetPath: "/artwork/portal-hero-desktop.webp",
        altText: "Safe product cover",
        caption: "Demo",
        sortOrder: 10,
      },
    ],
    ...overrides,
  };
}

function availability(
  overrides: Partial<ProductEstimateAvailabilityInput> = {},
): ProductEstimateAvailabilityInput {
  return {
    productAvailability: "AVAILABLE",
    variantAvailability: "AVAILABLE",
    variantEnabled: true,
    variantStatus: "AVAILABLE",
    stockMode: "TRACKED",
    onHandQuantity: "20",
    activeReservedQuantity: "0",
    lowStockThreshold: "3",
    ...overrides,
  };
}

describe("product estimate engine", () => {
  it("calculates fixed-unit, package and tiered prices from published revisions", () => {
    const fixed = calculateProductEstimate({
      revision: revision(),
      variantStableKey: "variant-unit",
      quantity: "4",
      availability: availability(),
      now,
    });
    expect(fixed.productSubtotalCents).toBe(500);
    expect(fixed.estimatedTotal).toBe("$5.00");

    const tiered = calculateProductEstimate({
      revision: revision(),
      variantStableKey: "variant-tiered",
      quantity: "5",
      availability: availability(),
      now,
    });
    expect(tiered.unitPriceCents).toBe(849);
    expect(tiered.appliedTierStableKey).toBe("tier-5-plus");
    expect(tiered.productSubtotalCents).toBe(4245);

    const pack = calculateProductEstimate({
      revision: revision(),
      variantStableKey: "variant-package",
      quantity: "1",
      availability: availability({ stockMode: "UNLIMITED" }),
      now,
    });
    expect(pack.productSubtotalCents).toBe(4999);
  });

  it("enforces quantity boundaries, increments, stock and overflow", () => {
    expect(() =>
      calculateProductEstimate({
        revision: revision(),
        variantStableKey: "variant-unit",
        quantity: "0",
        availability: availability(),
      }),
    ).toThrow(/greater than zero/);
    expect(() =>
      calculateProductEstimate({
        revision: revision(),
        variantStableKey: "variant-unit",
        quantity: "101",
        availability: availability(),
      }),
    ).toThrow(/at most/);
    expect(() =>
      calculateProductEstimate({
        revision: revision({
          variants: [
            {
              ...revision().variants[0]!,
              minimumQuantity: "2",
              quantityIncrement: "2",
            },
          ],
        }),
        variantStableKey: "variant-unit",
        quantity: "3",
        availability: availability(),
      }),
    ).toThrow(/increments/);
    expect(() =>
      calculateProductEstimate({
        revision: revision(),
        variantStableKey: "variant-unit",
        quantity: "5",
        availability: availability({
          onHandQuantity: "4",
          activeReservedQuantity: "0",
        }),
      }),
    ).toThrow(/out of stock/);
    expect(() =>
      calculateProductEstimate({
        revision: revision({
          variants: [
            {
              ...revision().variants[0]!,
              baseUnitPriceCents: 100_000_000,
              maximumQuantity: "2",
            },
          ],
        }),
        variantStableKey: "variant-unit",
        quantity: "2",
        availability: availability({ onHandQuantity: "2" }),
      }),
    ).toThrow(/safe money/);
  });

  it("returns low-stock and manual-review states without fake scarcity or zero totals", () => {
    const lowStock = calculateProductEstimate({
      revision: revision(),
      variantStableKey: "variant-unit",
      quantity: "2",
      availability: availability({
        onHandQuantity: "3",
        activeReservedQuantity: "0",
        lowStockThreshold: "3",
      }),
    });
    expect(lowStock.state).toBe("LOW_STOCK");
    expect(lowStock.availabilityMessage).toMatch(/does not reserve stock/i);

    const manual = calculateProductEstimate({
      revision: revision(),
      variantStableKey: "variant-review",
      quantity: "1",
      availability: availability({
        productAvailability: "MANUAL_REVIEW_REQUIRED",
        variantAvailability: "MANUAL_REVIEW_REQUIRED",
        stockMode: "MANUAL_REVIEW",
      }),
    });
    expect(manual.state).toBe("MANUAL_REVIEW_REQUIRED");
    expect(manual.estimatedTotalCents).toBeNull();
    expect(manual.estimatedTotal).toBeNull();
  });

  it("rejects overlapping tiers and unknown snapshot versions", () => {
    const badRevision = revision({
      variants: [
        {
          ...revision().variants[1]!,
          priceTiers: [
            {
              stableKey: "tier-a",
              minimumQuantity: "1",
              maximumQuantity: "5",
              unitPriceCents: 900,
              sortOrder: 10,
              enabled: true,
            },
            {
              stableKey: "tier-b",
              minimumQuantity: "5",
              maximumQuantity: null,
              unitPriceCents: 800,
              sortOrder: 20,
              enabled: true,
            },
          ],
        },
      ],
    });
    expect(() =>
      calculateProductEstimate({
        revision: badRevision,
        variantStableKey: "variant-tiered",
        quantity: "5",
        availability: availability(),
      }),
    ).toThrow(/overlap/);
    expect(() =>
      normalizePublishedProductRevision({ schemaVersion: 999 }),
    ).toThrow(ProductMarketplaceValidationError);
    expect(() =>
      normalizeProductEstimateSnapshot({ schemaVersion: 999 }),
    ).toThrow(ProductMarketplaceValidationError);
  });

  it("appends customer-safe global pricing only to priced estimates", () => {
    const estimate = calculateProductEstimate({
      revision: revision(),
      variantStableKey: "variant-unit",
      quantity: "2",
      availability: availability(),
    });
    const priced = withProductGlobalPricing(estimate, {
      globalAdjustmentLines: [
        { label: "Marketplace handling", amountCents: 50 },
      ],
      minimumMaximumAdjustmentLines: [],
      estimatedTotalCents: 300,
      estimatedTotal: "$3.00",
      pricingRevision: { id: "pricing1", revisionNumber: 1 },
    });
    expect(priced.estimatedTotalCents).toBe(300);
    expect(priced.snapshot.publishedGlobalPricingRevision?.id).toBe("pricing1");

    const manual = calculateProductEstimate({
      revision: revision(),
      variantStableKey: "variant-review",
      quantity: "1",
      availability: availability({
        stockMode: "MANUAL_REVIEW",
        productAvailability: "MANUAL_REVIEW_REQUIRED",
        variantAvailability: "MANUAL_REVIEW_REQUIRED",
      }),
    });
    expect(
      withProductGlobalPricing(manual, {
        globalAdjustmentLines: [
          { label: "Marketplace handling", amountCents: 50 },
        ],
        minimumMaximumAdjustmentLines: [],
        estimatedTotalCents: 50,
        estimatedTotal: "$0.50",
        pricingRevision: { id: "pricing1", revisionNumber: 1 },
      }).estimatedTotalCents,
    ).toBeNull();
  });

  it("creates JSON-safe snapshots without internal SKU, ledger or reservation details", () => {
    const snapshot = productRevisionSnapshot({
      marketplace: revision().marketplace,
      product: revision().product,
      revisionId: "revision2",
      revisionNumber: 2,
      publishedAt: now,
      variants: revision().variants,
      tags: revision().tags,
      images: revision().images,
    });
    const estimate = calculateProductEstimate({
      revision: snapshot,
      variantStableKey: "variant-unit",
      quantity: "1",
      availability: availability(),
    });
    const serialized = JSON.stringify(estimate.snapshot);
    expect(normalizePublishedProductRevision(snapshot)).toEqual(snapshot);
    expect(serialized).not.toMatch(
      /internalSku|internalReference|ledger|reservationActor|reservationReason|actorId|email|password|credential/i,
    );
  });
});
