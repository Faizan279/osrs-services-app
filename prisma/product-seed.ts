import type { PrismaClient } from "../src/generated/prisma/client";
import { productRevisionSnapshot } from "../src/lib/products/estimate";

const CATEGORY_ID = "productscategorytask012";
const SERVICE_ID = "productsservicetask012";
const MARKETPLACE_ID = "productmarkettask012";

const marketplaceDescription =
  "Browse representative item, bond and outfit listings after staff review. Product marketplace data is disabled by default until prices, stock and fulfilment wording are approved.";

const marketplaceInstructions =
  "Use product estimates for planning only. Estimates do not reserve stock, create a cart, create an order or start a payment. Support rechecks stock and fulfilment details before any future checkout step.";

const productCategories = [
  {
    id: "prodcatitemstask012",
    stableKey: "product-category-items",
    publicName: "Items",
    slug: "items",
    publicDescription:
      "Representative item listings for the reusable product marketplace.",
    productType: "ITEM" as const,
    sortOrder: 10,
  },
  {
    id: "prodcatbondstask012",
    stableKey: "product-category-bonds",
    publicName: "Bonds",
    slug: "bonds",
    publicDescription:
      "Representative bond listings. This service is not affiliated with Jagex.",
    productType: "BOND" as const,
    sortOrder: 20,
  },
  {
    id: "prodcatoutfitstask012",
    stableKey: "product-category-outfits",
    publicName: "Outfits",
    slug: "outfits",
    publicDescription:
      "Representative outfit package listings for staff review.",
    productType: "OUTFIT" as const,
    sortOrder: 30,
  },
] as const;

const productTags = [
  ["prodtagfeatured012", "product-tag-featured", "featured", "Featured"],
  ["prodtagstackable012", "product-tag-stackable", "stackable", "Stackable"],
  ["prodtagpackage012", "product-tag-package", "package", "Package"],
  ["prodtagreview012", "product-tag-review", "review", "Needs review"],
] as const;

const products = [
  {
    id: "prodsourcebond012",
    stableKey: "product-osrs-bond-demo",
    categoryStableKey: "product-category-bonds",
    publicTitle: "Bond marketplace demo",
    slug: "bond-marketplace-demo",
    shortDescription:
      "Paused representative bond listing with tiered pricing and zero seeded stock.",
    fullDescription:
      "This representative bond listing demonstrates Task 012 quantity-tier pricing and stock checks. It is seeded for review only, is not affiliated with Jagex, and does not create a cart, order, payment or reservation.",
    internalReferenceCode: "PROD-DEMO-BOND",
    productType: "BOND" as const,
    isFeatured: true,
    publicBadgeText: "Review pricing",
    publicationStatus: "PUBLISHED" as const,
    availabilityState: "PAUSED" as const,
    sortOrder: 10,
    publishedAt: new Date("2026-07-30T15:00:00.000Z"),
    tags: ["featured", "review"],
    variants: [
      {
        id: "prodvarbondunit012",
        stableKey: "product-variant-bond-unit",
        publicName: "Bond quantity",
        publicSku: "BOND",
        internalSku: "PROD-DEMO-BOND-INTERNAL",
        unitLabel: "bond",
        priceMode: "QUANTITY_TIER" as const,
        baseUnitPriceCents: 899,
        minimumQuantity: 1n,
        maximumQuantity: 50n,
        quantityIncrement: 1n,
        stockMode: "TRACKED" as const,
        availabilityState: "PAUSED" as const,
        lowStockThreshold: 3n,
        sortOrder: 10,
        tiers: [
          ["prodtierbond01012", "product-tier-bond-1-4", 1n, 4n, 899, 10],
          ["prodtierbond05012", "product-tier-bond-5-plus", 5n, null, 849, 20],
        ],
      },
    ],
  },
  {
    id: "prodessencerune012",
    stableKey: "product-rune-essence-demo",
    categoryStableKey: "product-category-items",
    publicTitle: "Rune essence stack demo",
    slug: "rune-essence-stack-demo",
    shortDescription:
      "Draft representative item listing with fixed unit pricing and tracked stock.",
    fullDescription:
      "This draft item listing validates fixed-unit quantity estimates, public tags and stock review language without making production inventory claims.",
    internalReferenceCode: "PROD-DEMO-ESSENCE",
    productType: "ITEM" as const,
    isFeatured: false,
    publicBadgeText: "Draft",
    publicationStatus: "DRAFT" as const,
    availabilityState: "PAUSED" as const,
    sortOrder: 20,
    publishedAt: null,
    tags: ["stackable", "review"],
    variants: [
      {
        id: "prodvaressunit012",
        stableKey: "product-variant-essence-unit",
        publicName: "Single unit",
        publicSku: "ESSENCE",
        internalSku: "PROD-DEMO-ESSENCE-INTERNAL",
        unitLabel: "unit",
        priceMode: "FIXED_UNIT" as const,
        baseUnitPriceCents: 2,
        minimumQuantity: 100n,
        maximumQuantity: 100000n,
        quantityIncrement: 100n,
        stockMode: "TRACKED" as const,
        availabilityState: "PAUSED" as const,
        lowStockThreshold: 1000n,
        sortOrder: 10,
        tiers: [],
      },
    ],
  },
  {
    id: "prodgraceful012",
    stableKey: "product-graceful-outfit-demo",
    categoryStableKey: "product-category-outfits",
    publicTitle: "Graceful outfit review package",
    slug: "graceful-outfit-review-package",
    shortDescription:
      "Draft outfit package configured as quantity one with staff-reviewed fulfilment wording.",
    fullDescription:
      "This draft outfit package demonstrates the fixed-package mode. Fulfilment details, eligibility and stock must be reviewed by staff before publication.",
    internalReferenceCode: "PROD-DEMO-GRACEFUL",
    productType: "OUTFIT" as const,
    isFeatured: false,
    publicBadgeText: "Package",
    publicationStatus: "DRAFT" as const,
    availabilityState: "MANUAL_REVIEW_REQUIRED" as const,
    sortOrder: 30,
    publishedAt: null,
    tags: ["package", "review"],
    variants: [
      {
        id: "prodvargraceful012",
        stableKey: "product-variant-graceful-set",
        publicName: "Complete set",
        publicSku: "OUTFIT",
        internalSku: "PROD-DEMO-GRACEFUL-INTERNAL",
        unitLabel: "set",
        priceMode: "FIXED_PACKAGE" as const,
        baseUnitPriceCents: 4999,
        minimumQuantity: 1n,
        maximumQuantity: 1n,
        quantityIncrement: 1n,
        stockMode: "MANUAL_REVIEW" as const,
        availabilityState: "MANUAL_REVIEW_REQUIRED" as const,
        lowStockThreshold: 0n,
        sortOrder: 10,
        tiers: [],
      },
    ],
  },
  {
    id: "prodmanual012",
    stableKey: "product-manual-review-demo",
    categoryStableKey: "product-category-items",
    publicTitle: "Manual review item package",
    slug: "manual-review-item-package",
    shortDescription:
      "Draft item package that intentionally requires support review instead of a zero-price estimate.",
    fullDescription:
      "This draft listing validates the manual-review estimate state and prevents misleading zero totals in public responses.",
    internalReferenceCode: "PROD-DEMO-MANUAL",
    productType: "ITEM" as const,
    isFeatured: false,
    publicBadgeText: "Manual review",
    publicationStatus: "DRAFT" as const,
    availabilityState: "MANUAL_REVIEW_REQUIRED" as const,
    sortOrder: 40,
    publishedAt: null,
    tags: ["review"],
    variants: [
      {
        id: "prodvarmanual012",
        stableKey: "product-variant-manual-review",
        publicName: "Support-reviewed package",
        publicSku: "REVIEW",
        internalSku: "PROD-DEMO-MANUAL-INTERNAL",
        unitLabel: "package",
        priceMode: "MANUAL_REVIEW" as const,
        baseUnitPriceCents: 0,
        minimumQuantity: 1n,
        maximumQuantity: 1n,
        quantityIncrement: 1n,
        stockMode: "MANUAL_REVIEW" as const,
        availabilityState: "MANUAL_REVIEW_REQUIRED" as const,
        lowStockThreshold: 0n,
        sortOrder: 10,
        tiers: [],
      },
    ],
  },
] as const;

function imageSeed(productKey: string, productTitle: string) {
  return [
    {
      id: `${productKey.replace(/[^a-z0-9]/g, "").slice(0, 18)}cover`,
      stableKey: `${productKey}:cover`,
      imageType: "COVER" as const,
      assetPath: "/artwork/portal-hero-desktop.webp",
      altText: `${productTitle} safe product cover`,
      caption: "Safe demo artwork, not game artwork or customer data.",
      sortOrder: 10,
    },
    {
      id: `${productKey.replace(/[^a-z0-9]/g, "").slice(0, 16)}gallery`,
      stableKey: `${productKey}:gallery`,
      imageType: "GALLERY" as const,
      assetPath: "/artwork/portal-hero-mobile.webp",
      altText: `${productTitle} safe gallery placeholder`,
      caption: "Deterministic placeholder for review and CI screenshots.",
      sortOrder: 20,
    },
  ];
}

export async function seedProductMarketplace(prisma: PrismaClient) {
  const catalogueCategory = await prisma.catalogueCategory.upsert({
    where: { seededKey: "products" },
    create: {
      id: CATEGORY_ID,
      seededKey: "products",
      name: "Products",
      slug: "products",
      shortDescription:
        "Items, bonds and outfits prepared for marketplace review.",
      description: marketplaceDescription,
      iconKey: "package-search",
      displayOrder: 39,
      isActive: true,
      seoTitle: "OSRS product marketplace",
      seoDescription:
        "Browse reviewed item, bond and outfit listings with server-side stock checks.",
    },
    update: {},
    select: { id: true },
  });

  const service = await prisma.catalogueService.upsert({
    where: { seededKey: "product-marketplace" },
    create: {
      id: SERVICE_ID,
      seededKey: "product-marketplace",
      categoryId: catalogueCategory.id,
      name: "Product marketplace",
      slug: "product-marketplace",
      canonicalSlug: "products/product-marketplace",
      shortSummary:
        "Reusable product marketplace for item, bond and outfit listings with preview-only estimates.",
      content:
        "Product listings are preview-only in Task 012. Stock, price and fulfilment details are rechecked before any future checkout step.",
      serviceType: "MARKETPLACE",
      engineType: "PRODUCT_MARKETPLACE",
      publicationStatus: "PUBLISHED",
      availabilityState: "AVAILABLE",
      isFeatured: true,
      isQuoteOnly: true,
      displayOrder: 39,
      publicPreparationNotes:
        "Do not collect customer information, create reservations, or start checkout from public estimates.",
      seoTitle: "OSRS product marketplace",
      seoDescription:
        "Product marketplace listings with safe preview estimates and inventory controls.",
      needsClientReview: true,
    },
    update: {},
    select: { id: true },
  });

  const marketplace = await prisma.productMarketplace.upsert({
    where: { stableKey: "product-main-marketplace" },
    create: {
      id: MARKETPLACE_ID,
      stableKey: "product-main-marketplace",
      serviceId: service.id,
      publicName: "OSRS Product Marketplace",
      slug: "products",
      description: marketplaceDescription,
      publicMarketplaceInstructions: marketplaceInstructions,
      internalNotes:
        "Task 012 seed data is non-production. Review prices, stock and fulfilment copy before enabling public browsing.",
      currencyCode: "USD",
      availabilityState: "AVAILABLE",
      defaultSort: "featured",
      needsClientReview: true,
    },
    update: {},
    select: { id: true },
  });

  const categoryIds = new Map<string, string>();
  for (const category of productCategories) {
    const saved = await prisma.productCategory.upsert({
      where: { stableKey: category.stableKey },
      create: {
        id: category.id,
        stableKey: category.stableKey,
        marketplaceId: marketplace.id,
        publicName: category.publicName,
        slug: category.slug,
        publicDescription: category.publicDescription,
        productType: category.productType,
        sortOrder: category.sortOrder,
        enabled: true,
        needsClientReview: true,
      },
      update: {},
      select: { id: true },
    });
    categoryIds.set(category.stableKey, saved.id);
  }

  const tagIds = new Map<string, string>();
  for (const [id, stableKey, slug, publicLabel] of productTags) {
    const saved = await prisma.productTag.upsert({
      where: { stableKey },
      create: {
        id,
        stableKey,
        marketplaceId: marketplace.id,
        publicLabel,
        slug,
        enabled: true,
        needsClientReview: true,
      },
      update: {},
      select: { id: true },
    });
    tagIds.set(slug, saved.id);
  }

  for (const product of products) {
    const savedProduct = await prisma.product.upsert({
      where: { stableKey: product.stableKey },
      create: {
        id: product.id,
        stableKey: product.stableKey,
        marketplaceId: marketplace.id,
        categoryId: categoryIds.get(product.categoryStableKey)!,
        publicTitle: product.publicTitle,
        slug: product.slug,
        shortDescription: product.shortDescription,
        fullDescription: product.fullDescription,
        internalReferenceCode: product.internalReferenceCode,
        productType: product.productType,
        currencyCode: "USD",
        isFeatured: product.isFeatured,
        publicBadgeText: product.publicBadgeText,
        publicationStatus: product.publicationStatus,
        availabilityState: product.availabilityState,
        sortOrder: product.sortOrder,
        needsClientReview: true,
        publishedAt: product.publishedAt,
      },
      update: {},
      select: { id: true },
    });

    await prisma.productTagAssignment.createMany({
      data: product.tags.map((tag) => ({
        productId: savedProduct.id,
        tagId: tagIds.get(tag)!,
      })),
      skipDuplicates: true,
    });

    for (const image of imageSeed(product.stableKey, product.publicTitle)) {
      await prisma.productImage.upsert({
        where: { stableKey: image.stableKey },
        create: {
          id: image.id,
          stableKey: image.stableKey,
          productId: savedProduct.id,
          imageType: image.imageType,
          assetPath: image.assetPath,
          altText: image.altText,
          caption: image.caption,
          sortOrder: image.sortOrder,
          isPublic: true,
          needsClientReview: true,
        },
        update: {},
      });
    }

    for (const variant of product.variants) {
      const savedVariant = await prisma.productVariant.upsert({
        where: { stableKey: variant.stableKey },
        create: {
          id: variant.id,
          stableKey: variant.stableKey,
          productId: savedProduct.id,
          publicName: variant.publicName,
          publicSku: variant.publicSku,
          internalSku: variant.internalSku,
          unitLabel: variant.unitLabel,
          priceMode: variant.priceMode,
          baseUnitPriceCents: variant.baseUnitPriceCents,
          minimumQuantity: variant.minimumQuantity,
          maximumQuantity: variant.maximumQuantity,
          quantityIncrement: variant.quantityIncrement,
          stockMode: variant.stockMode,
          availabilityState: variant.availabilityState,
          status: "AVAILABLE",
          onHandQuantity: 0n,
          lowStockThreshold: variant.lowStockThreshold,
          sortOrder: variant.sortOrder,
          enabled: true,
          needsClientReview: true,
        },
        update: {},
        select: { id: true },
      });

      for (const [
        id,
        stableKey,
        minimumQuantity,
        maximumQuantity,
        unitPriceCents,
        sortOrder,
      ] of variant.tiers) {
        await prisma.productPriceTier.upsert({
          where: { stableKey },
          create: {
            id,
            stableKey,
            variantId: savedVariant.id,
            minimumQuantity,
            maximumQuantity,
            unitPriceCents,
            sortOrder,
            enabled: true,
            needsClientReview: true,
          },
          update: {},
        });
      }

      await prisma.productInventoryLedgerEntry.upsert({
        where: { referenceKey: `${variant.stableKey}:initial-balance` },
        create: {
          id: `${variant.id.slice(0, 18)}ledger0`,
          variantId: savedVariant.id,
          entryType: "INITIAL_BALANCE",
          quantity: 0n,
          resultingOnHandQuantity: 0n,
          reason: "Task 012 seed initial zero balance",
          internalNote:
            "Representative zero balance only; do not infer production stock.",
          referenceKey: `${variant.stableKey}:initial-balance`,
        },
        update: {},
      });
    }

    if (product.publicationStatus === "PUBLISHED") {
      const existingRevision = await prisma.productRevision.findFirst({
        where: { productId: savedProduct.id },
        select: { id: true },
      });
      if (!existingRevision) {
        const category = productCategories.find(
          (item) => item.stableKey === product.categoryStableKey,
        )!;
        const revisionId = "prodrevisionbond012";
        const publishedAt = product.publishedAt!;
        const snapshot = productRevisionSnapshot({
          marketplace: {
            id: marketplace.id,
            stableKey: "product-main-marketplace",
            slug: "products",
            serviceId: service.id,
            serviceSlug: "product-marketplace",
            categoryId: catalogueCategory.id,
            categorySlug: "products",
            publicName: "OSRS Product Marketplace",
            currencyCode: "USD",
          },
          product: {
            id: savedProduct.id,
            stableKey: product.stableKey,
            slug: product.slug,
            publicTitle: product.publicTitle,
            shortDescription: product.shortDescription,
            fullDescription: product.fullDescription,
            productType: product.productType,
            currencyCode: "USD",
            publicBadgeText: product.publicBadgeText,
            isFeatured: product.isFeatured,
            category: {
              stableKey: category.stableKey,
              slug: category.slug,
              publicName: category.publicName,
              productType: category.productType,
            },
          },
          revisionId,
          revisionNumber: 1,
          publishedAt,
          variants: product.variants.map((variant) => ({
            stableKey: variant.stableKey,
            publicName: variant.publicName,
            publicSku: variant.publicSku,
            unitLabel: variant.unitLabel,
            priceMode: variant.priceMode,
            baseUnitPriceCents: variant.baseUnitPriceCents,
            minimumQuantity: variant.minimumQuantity.toString(),
            maximumQuantity: variant.maximumQuantity.toString(),
            quantityIncrement: variant.quantityIncrement.toString(),
            stockMode: variant.stockMode,
            sortOrder: variant.sortOrder,
            enabled: true,
            priceTiers: variant.tiers.map(
              ([
                ,
                stableKey,
                minimumQuantity,
                maximumQuantity,
                unitPriceCents,
                sortOrder,
              ]) => ({
                stableKey,
                minimumQuantity: minimumQuantity.toString(),
                maximumQuantity: maximumQuantity?.toString() ?? null,
                unitPriceCents,
                sortOrder,
                enabled: true,
              }),
            ),
          })),
          tags: product.tags.map((slug) => {
            const [, stableKey, , publicLabel] = productTags.find(
              (tag) => tag[2] === slug,
            )!;
            return { stableKey, slug, publicLabel };
          }),
          images: imageSeed(product.stableKey, product.publicTitle).map(
            (image) => ({
              stableKey: image.stableKey,
              imageType: image.imageType,
              assetPath: image.assetPath,
              altText: image.altText,
              caption: image.caption,
              sortOrder: image.sortOrder,
            }),
          ),
        });
        await prisma.productRevision.create({
          data: {
            id: revisionId,
            productId: savedProduct.id,
            revisionNumber: 1,
            snapshotSchemaVersion: 1,
            snapshot,
            publishedAt,
          },
        });
      }
    }
  }
}
