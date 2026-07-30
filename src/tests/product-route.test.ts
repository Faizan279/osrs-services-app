import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { productRevisionSnapshot } from "@/lib/products/estimate";

const mocks = vi.hoisted(() => ({
  featureFlagFindUnique: vi.fn(),
  productFindMany: vi.fn(),
  pricingRevisionFindFirst: vi.fn(),
  reservationCreate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    featureFlag: { findUnique: mocks.featureFlagFindUnique },
    product: { findMany: mocks.productFindMany },
    pricingRevision: { findFirst: mocks.pricingRevisionFindFirst },
    productInventoryReservation: { create: mocks.reservationCreate },
  },
}));

let POST: typeof import("@/app/api/products/estimate/route").POST;

const publishedAt = new Date("2026-07-30T15:00:00.000Z");

const revision = productRevisionSnapshot({
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
    shortDescription: "Published product.",
    fullDescription: "Published product detail.",
    productType: "ITEM",
    currencyCode: "USD",
    publicBadgeText: null,
    isFeatured: true,
    category: {
      stableKey: "category-items",
      slug: "items",
      publicName: "Items",
      productType: "ITEM",
    },
  },
  revisionId: "revision1",
  revisionNumber: 1,
  publishedAt,
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
  ],
  tags: [],
  images: [
    {
      stableKey: "image-cover",
      imageType: "COVER",
      assetPath: "/artwork/portal-hero-desktop.webp",
      altText: "Safe product cover",
      caption: null,
      sortOrder: 10,
    },
  ],
});

function productRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "product1",
    stableKey: "product-demo",
    marketplaceId: "productmarket1",
    categoryId: "productcategory1",
    publicTitle: "Draft title",
    slug: "draft-slug",
    shortDescription: "Draft short",
    fullDescription: "Draft full",
    internalReferenceCode: "INTERNAL-PRODUCT",
    productType: "ITEM",
    currencyCode: "USD",
    isFeatured: true,
    publicBadgeText: null,
    publicationStatus: "PUBLISHED",
    availabilityState: "AVAILABLE",
    defaultImagePath: null,
    sortOrder: 10,
    needsClientReview: true,
    concurrencyVersion: 1,
    publishedAt,
    archivedAt: null,
    createdAt: publishedAt,
    updatedAt: publishedAt,
    marketplace: {
      id: "productmarket1",
      stableKey: "product-main-marketplace",
      serviceId: "service1",
      publicName: "Product Marketplace",
      slug: "products",
      description: "Public marketplace.",
      publicMarketplaceInstructions: "Preview estimates only.",
      internalNotes: "private",
      currencyCode: "USD",
      availabilityState: "AVAILABLE",
      defaultSort: "featured",
      needsClientReview: true,
      concurrencyVersion: 1,
      createdAt: publishedAt,
      updatedAt: publishedAt,
      service: {
        id: "service1",
        categoryId: "category1",
        name: "Product marketplace",
        slug: "product-marketplace",
        category: { id: "category1", slug: "products", name: "Products" },
      },
    },
    category: {
      id: "productcategory1",
      stableKey: "category-items",
      marketplaceId: "productmarket1",
      publicName: "Items",
      slug: "items",
      publicDescription: "Items.",
      productType: "ITEM",
      sortOrder: 10,
      enabled: true,
      needsClientReview: true,
      concurrencyVersion: 1,
      createdAt: publishedAt,
      updatedAt: publishedAt,
    },
    revisions: [{ snapshot: revision }],
    variants: [
      {
        id: "variant1",
        stableKey: "variant-unit",
        productId: "product1",
        publicName: "Unit",
        publicSku: "UNIT",
        internalSku: "PRIVATE-SKU",
        unitLabel: "unit",
        priceMode: "FIXED_UNIT",
        baseUnitPriceCents: 1,
        minimumQuantity: 1n,
        maximumQuantity: 100n,
        quantityIncrement: 1n,
        stockMode: "TRACKED",
        availabilityState: "AVAILABLE",
        status: "AVAILABLE",
        onHandQuantity: 10n,
        lowStockThreshold: 2n,
        sortOrder: 10,
        enabled: true,
        needsClientReview: true,
        concurrencyVersion: 1,
        createdAt: publishedAt,
        updatedAt: publishedAt,
        reservations: [],
      },
    ],
    ...overrides,
  };
}

function request(body: Record<string, unknown>) {
  return new Request("https://example.test/api/products/estimate", {
    method: "POST",
    body: JSON.stringify({
      productSlug: "demo-product",
      variantStableKey: "variant-unit",
      quantity: "2",
      ...body,
    }),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.featureFlagFindUnique.mockImplementation(({ where }) =>
    Promise.resolve({
      enabled: where.key === "product_marketplace_enabled",
    }),
  );
  mocks.productFindMany.mockResolvedValue([productRecord()]);
  mocks.pricingRevisionFindFirst.mockResolvedValue(null);
});

beforeAll(async () => {
  ({ POST } = await import("@/app/api/products/estimate/route"));
});

describe("product estimate route", () => {
  it("uses server-side published prices and ignores client totals", async () => {
    const response = await POST(
      request({
        unitPriceCents: 1,
        productSubtotalCents: 1,
        estimatedTotalCents: 1,
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(body.ok).toBe(true);
    expect(body.estimate.productSubtotalCents).toBe(250);
    expect(body.estimate.estimatedTotal).toBe("$2.50");
    expect(body.estimate.estimateCreatesReservation).toBe(false);
    expect(mocks.reservationCreate).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toMatch(/PRIVATE-SKU|INTERNAL-PRODUCT/);
  });

  it("rejects disabled feature flag and out-of-stock estimates safely", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: false });
    const disabled = await POST(request({}) as never);
    expect(disabled.status).toBe(400);

    mocks.featureFlagFindUnique.mockImplementation(({ where }) =>
      Promise.resolve({
        enabled: where.key === "product_marketplace_enabled",
      }),
    );
    mocks.productFindMany.mockResolvedValue([
      productRecord({
        variants: [
          {
            ...productRecord().variants[0],
            onHandQuantity: 0n,
          },
        ],
      }),
    ]);
    const outOfStock = await POST(request({}) as never);
    expect(outOfStock.status).toBe(400);
    expect((await outOfStock.json()).message).toMatch(/out of stock/i);
  });

  it("appends global pricing only after a valid product subtotal", async () => {
    mocks.featureFlagFindUnique.mockResolvedValue({ enabled: true });
    mocks.pricingRevisionFindFirst.mockResolvedValue({
      snapshot: {
        schemaVersion: 1,
        ruleSetId: "pricingruleset1",
        revisionId: "pricingrevision1",
        revisionNumber: 1,
        currencyCode: "USD",
        publishedAt: "2026-07-30T00:00:00.000Z",
        rules: [
          {
            id: "producthandling",
            publicLabel: "Product handling",
            enabled: true,
            ruleType: "FIXED_ADDITION",
            amountCents: 50,
            valueBps: null,
            priority: 0,
            exclusiveGroupKey: null,
            effectiveStart: null,
            effectiveEnd: null,
            applicability: [
              {
                scope: "ENGINE_TYPE",
                engineType: "PRODUCT_MARKETPLACE",
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
    expect(body.estimate.estimatedTotalCents).toBe(300);
    expect(body.estimate.lineItems).toEqual(
      expect.arrayContaining([{ label: "Product handling", amountCents: 50 }]),
    );
  });
});
