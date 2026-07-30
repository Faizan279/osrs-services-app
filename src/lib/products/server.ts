import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { publicCatalogueWhere } from "@/lib/catalogue/queries";
import { prisma } from "@/lib/db/prisma";
import {
  PRODUCT_MARKETPLACE_FEATURE_FLAG,
  productAvailabilityStates,
  productSortOptions,
  productTypes,
} from "@/lib/products/constants";
import {
  ProductMarketplaceValidationError,
  calculateProductEstimate,
  normalizePublishedProductRevision,
  safeProductJson,
  withProductGlobalPricing,
  type ProductEstimateResult,
  type ProductStockMode,
  type PublishedProductRevisionSnapshotV1,
} from "@/lib/products/estimate";
import { applyPublishedPricingIfEnabled } from "@/lib/pricing/server";

export type ProductMarketplaceFilters = {
  search?: string;
  page?: number;
  pageSize?: number;
  sort?: (typeof productSortOptions)[number];
  productType?: (typeof productTypes)[number] | "";
  category?: string;
  tags?: string[];
  minPriceCents?: number;
  maxPriceCents?: number;
  availability?: (typeof productAvailabilityStates)[number] | "";
  inStockOnly?: boolean;
  featuredOnly?: boolean;
  invalid?: boolean;
};

type ProductWithLatestRevision = Prisma.ProductGetPayload<{
  include: {
    marketplace: { include: { service: { include: { category: true } } } };
    category: true;
    revisions: { take: 1 };
    variants: {
      include: {
        reservations: true;
      };
    };
  };
}>;

type PublicVariantAvailability = {
  stableKey: string;
  state:
    | "AVAILABLE"
    | "LOW_STOCK"
    | "OUT_OF_STOCK"
    | "MANUAL_REVIEW_REQUIRED"
    | "UNAVAILABLE";
  stockMode: ProductStockMode;
};

export type PublicProductListing = {
  stableKey: string;
  slug: string;
  title: string;
  shortDescription: string;
  productType: (typeof productTypes)[number];
  category: {
    stableKey: string;
    slug: string;
    publicName: string;
  };
  tags: Array<{ slug: string; label: string }>;
  startingPriceCents: number | null;
  startingPrice: string;
  availabilityState: PublicVariantAvailability["state"];
  stockMessage: string;
  coverImage: {
    assetPath: string;
    altText: string;
  } | null;
  publicBadgeText: string | null;
  isFeatured: boolean;
  sortOrder: number;
  publishedAt: Date | null;
  revision: PublishedProductRevisionSnapshotV1;
};

function money(cents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

async function productMarketplaceFlagEnabled() {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: PRODUCT_MARKETPLACE_FEATURE_FLAG },
    select: { enabled: true },
  });
  return Boolean(flag?.enabled);
}

async function loadPublicMarketplace(now = new Date()) {
  return prisma.productMarketplace.findFirst({
    where: {
      service: {
        ...publicCatalogueWhere(now),
        engineType: "PRODUCT_MARKETPLACE",
      },
    },
    select: {
      id: true,
      stableKey: true,
      serviceId: true,
      publicName: true,
      slug: true,
      description: true,
      publicMarketplaceInstructions: true,
      currencyCode: true,
      availabilityState: true,
      defaultSort: true,
      needsClientReview: true,
      concurrencyVersion: true,
      service: {
        select: {
          id: true,
          categoryId: true,
          name: true,
          slug: true,
          category: { select: { name: true, slug: true } },
        },
      },
    },
  });
}

function latestRevision(product: ProductWithLatestRevision) {
  const revision = product.revisions[0];
  if (!revision) return null;
  return normalizePublishedProductRevision(revision.snapshot);
}

function enabledRevisionVariants(revision: PublishedProductRevisionSnapshotV1) {
  return revision.variants
    .filter((variant) => variant.enabled)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.stableKey.localeCompare(right.stableKey);
    });
}

function startingPriceForRevision(
  revision: PublishedProductRevisionSnapshotV1,
) {
  const candidates: number[] = [];
  for (const variant of enabledRevisionVariants(revision)) {
    if (variant.priceMode === "MANUAL_REVIEW") continue;
    if (variant.priceMode === "QUANTITY_TIER") {
      const tier = variant.priceTiers
        .filter((item) => item.enabled && item.unitPriceCents > 0)
        .sort((left, right) => {
          if (left.unitPriceCents !== right.unitPriceCents) {
            return left.unitPriceCents - right.unitPriceCents;
          }
          return left.sortOrder - right.sortOrder;
        })[0];
      if (tier) candidates.push(tier.unitPriceCents);
      continue;
    }
    if (variant.baseUnitPriceCents > 0) {
      candidates.push(variant.baseUnitPriceCents);
    }
  }
  if (!candidates.length) return null;
  return Math.min(...candidates);
}

function activeReservedQuantity(
  variant: ProductWithLatestRevision["variants"][number],
  now: Date,
) {
  return variant.reservations
    .filter(
      (reservation) =>
        reservation.status === "ACTIVE" && reservation.expiresAt > now,
    )
    .reduce((total, reservation) => total + reservation.quantity, 0n);
}

function variantAvailabilityState({
  product,
  stableKey,
  now,
}: {
  product: ProductWithLatestRevision;
  stableKey: string;
  now: Date;
}): PublicVariantAvailability | null {
  const variant = product.variants.find((item) => item.stableKey === stableKey);
  if (!variant || !variant.enabled || variant.status !== "AVAILABLE") {
    return null;
  }
  if (
    product.availabilityState === "PAUSED" ||
    product.availabilityState === "UNAVAILABLE" ||
    variant.availabilityState === "PAUSED" ||
    variant.availabilityState === "UNAVAILABLE"
  ) {
    return {
      stableKey,
      state: "UNAVAILABLE",
      stockMode: variant.stockMode,
    };
  }
  if (
    product.availabilityState === "MANUAL_REVIEW_REQUIRED" ||
    variant.availabilityState === "MANUAL_REVIEW_REQUIRED" ||
    variant.stockMode === "MANUAL_REVIEW"
  ) {
    return {
      stableKey,
      state: "MANUAL_REVIEW_REQUIRED",
      stockMode: variant.stockMode,
    };
  }
  if (
    product.availabilityState === "OUT_OF_STOCK" ||
    variant.availabilityState === "OUT_OF_STOCK"
  ) {
    return {
      stableKey,
      state: "OUT_OF_STOCK",
      stockMode: variant.stockMode,
    };
  }
  if (variant.stockMode === "UNLIMITED") {
    return {
      stableKey,
      state:
        product.availabilityState === "LOW_STOCK" ||
        variant.availabilityState === "LOW_STOCK"
          ? "LOW_STOCK"
          : "AVAILABLE",
      stockMode: variant.stockMode,
    };
  }
  const available =
    variant.onHandQuantity - activeReservedQuantity(variant, now);
  if (available <= 0n) {
    return {
      stableKey,
      state: "OUT_OF_STOCK",
      stockMode: variant.stockMode,
    };
  }
  return {
    stableKey,
    state:
      available <= variant.lowStockThreshold ||
      product.availabilityState === "LOW_STOCK" ||
      variant.availabilityState === "LOW_STOCK"
        ? "LOW_STOCK"
        : "AVAILABLE",
    stockMode: variant.stockMode,
  };
}

function customerSafeStockMessage(state: PublicVariantAvailability["state"]) {
  if (state === "AVAILABLE") {
    return "Available. Estimates do not reserve stock.";
  }
  if (state === "LOW_STOCK") {
    return "Limited availability. No stock is reserved by viewing an estimate.";
  }
  if (state === "MANUAL_REVIEW_REQUIRED") {
    return "Support review required before a final quote.";
  }
  if (state === "OUT_OF_STOCK") {
    return "Currently out of stock.";
  }
  return "Currently unavailable.";
}

function primaryAvailability({
  product,
  revision,
  now,
}: {
  product: ProductWithLatestRevision;
  revision: PublishedProductRevisionSnapshotV1;
  now: Date;
}) {
  const variants = enabledRevisionVariants(revision)
    .map((variant) =>
      variantAvailabilityState({ product, stableKey: variant.stableKey, now }),
    )
    .filter((item): item is PublicVariantAvailability => Boolean(item));
  return (
    variants.find((item) => item.state === "AVAILABLE") ??
    variants.find((item) => item.state === "LOW_STOCK") ??
    variants.find((item) => item.state === "MANUAL_REVIEW_REQUIRED") ??
    variants.find((item) => item.state === "OUT_OF_STOCK") ??
    variants[0] ?? {
      stableKey: "",
      state: "UNAVAILABLE",
      stockMode: "TRACKED" as const,
    }
  );
}

function publicProductFromRevision(
  product: ProductWithLatestRevision,
  now: Date,
): PublicProductListing | null {
  const revision = latestRevision(product);
  if (!revision) return null;
  const cover =
    revision.images.find((image) => image.imageType === "COVER") ??
    revision.images[0] ??
    null;
  const startingPriceCents = startingPriceForRevision(revision);
  const availability = primaryAvailability({ product, revision, now });
  return {
    stableKey: revision.product.stableKey,
    slug: revision.product.slug,
    title: revision.product.publicTitle,
    shortDescription: revision.product.shortDescription,
    productType: revision.product.productType,
    category: {
      stableKey: revision.product.category.stableKey,
      slug: revision.product.category.slug,
      publicName: revision.product.category.publicName,
    },
    tags: revision.tags.map((tag) => ({
      slug: tag.slug,
      label: tag.publicLabel,
    })),
    startingPriceCents,
    startingPrice:
      startingPriceCents == null
        ? "Manual review"
        : money(startingPriceCents, revision.product.currencyCode),
    availabilityState: availability.state,
    stockMessage: customerSafeStockMessage(availability.state),
    coverImage: cover
      ? { assetPath: cover.assetPath, altText: cover.altText }
      : null,
    publicBadgeText: revision.product.publicBadgeText,
    isFeatured: revision.product.isFeatured,
    sortOrder: product.sortOrder,
    publishedAt: product.publishedAt,
    revision,
  };
}

function includesText(product: PublicProductListing, search: string) {
  const needle = search.trim().toLowerCase();
  if (!needle) return true;
  return [
    product.title,
    product.shortDescription,
    product.revision.product.fullDescription,
    product.category.publicName,
    ...product.tags.map((tag) => tag.label),
  ].some((value) => value.toLowerCase().includes(needle));
}

function productInStock(product: PublicProductListing) {
  return (
    product.availabilityState === "AVAILABLE" ||
    product.availabilityState === "LOW_STOCK"
  );
}

function filterPublicProducts(
  products: PublicProductListing[],
  filters: ProductMarketplaceFilters,
) {
  if (filters.invalid) return [];
  const tagSet = new Set(filters.tags ?? []);
  return products.filter((product) => {
    if (!includesText(product, filters.search ?? "")) return false;
    if (filters.productType && product.productType !== filters.productType) {
      return false;
    }
    if (filters.category && product.category.slug !== filters.category) {
      return false;
    }
    if (filters.featuredOnly && !product.isFeatured) return false;
    if (
      filters.availability &&
      product.availabilityState !== filters.availability
    ) {
      return false;
    }
    if (filters.inStockOnly && !productInStock(product)) return false;
    if (
      filters.minPriceCents != null &&
      (product.startingPriceCents == null ||
        product.startingPriceCents < filters.minPriceCents)
    ) {
      return false;
    }
    if (
      filters.maxPriceCents != null &&
      (product.startingPriceCents == null ||
        product.startingPriceCents > filters.maxPriceCents)
    ) {
      return false;
    }
    for (const tag of tagSet) {
      if (!product.tags.some((item) => item.slug === tag)) return false;
    }
    return true;
  });
}

function sortPublicProducts(
  products: PublicProductListing[],
  sort: (typeof productSortOptions)[number],
) {
  const sorted = [...products];
  sorted.sort((left, right) => {
    if (sort === "price_asc") {
      const leftPrice = left.startingPriceCents ?? Number.MAX_SAFE_INTEGER;
      const rightPrice = right.startingPriceCents ?? Number.MAX_SAFE_INTEGER;
      if (leftPrice !== rightPrice) return leftPrice - rightPrice;
    }
    if (sort === "price_desc") {
      const leftPrice = left.startingPriceCents ?? -1;
      const rightPrice = right.startingPriceCents ?? -1;
      if (leftPrice !== rightPrice) return rightPrice - leftPrice;
    }
    if (sort === "name_asc") {
      const name = left.title.localeCompare(right.title);
      if (name !== 0) return name;
    }
    if (
      sort === "newest" &&
      (left.publishedAt?.getTime() ?? 0) !== (right.publishedAt?.getTime() ?? 0)
    ) {
      return (
        (right.publishedAt?.getTime() ?? 0) - (left.publishedAt?.getTime() ?? 0)
      );
    }
    if (left.isFeatured !== right.isFeatured) return left.isFeatured ? -1 : 1;
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.stableKey.localeCompare(right.stableKey);
  });
  return sorted;
}

function facetsFrom(products: PublicProductListing[]) {
  const categories = new Map<
    string,
    { stableKey: string; slug: string; publicName: string }
  >();
  const tags = new Map<string, string>();
  for (const product of products) {
    categories.set(product.category.slug, product.category);
    for (const tag of product.tags) tags.set(tag.slug, tag.label);
  }
  return {
    categories: [...categories.values()].sort((left, right) =>
      left.publicName.localeCompare(right.publicName),
    ),
    tags: [...tags.entries()]
      .map(([slug, label]) => ({ slug, label }))
      .sort((left, right) => left.label.localeCompare(right.label)),
  };
}

export async function getPublicProductMarketplace(
  filters: ProductMarketplaceFilters = {},
) {
  const now = new Date();
  const [marketplace, featureEnabled] = await Promise.all([
    loadPublicMarketplace(now),
    productMarketplaceFlagEnabled(),
  ]);
  if (!marketplace) return null;
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(24, Math.max(1, filters.pageSize ?? 12));
  const sort =
    filters.sort && productSortOptions.includes(filters.sort)
      ? filters.sort
      : productSortOptions.includes(marketplace.defaultSort as never)
        ? (marketplace.defaultSort as (typeof productSortOptions)[number])
        : "featured";

  if (!featureEnabled || marketplace.availabilityState !== "AVAILABLE") {
    return {
      marketplace,
      featureEnabled,
      products: [],
      featuredProducts: [],
      total: 0,
      page,
      pageSize,
      pages: 1,
      sort,
      facets: { categories: [], tags: [] },
    };
  }

  const records = await prisma.product.findMany({
    where: {
      marketplaceId: marketplace.id,
      publicationStatus: "PUBLISHED",
      category: { enabled: true },
    },
    orderBy: [{ sortOrder: "asc" }, { stableKey: "asc" }],
    include: {
      marketplace: { include: { service: { include: { category: true } } } },
      category: true,
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        take: 1,
      },
      variants: {
        include: {
          reservations: {
            where: { status: "ACTIVE", expiresAt: { gt: now } },
          },
        },
      },
    },
  });
  const publicProducts = records
    .map((record) => publicProductFromRevision(record, now))
    .filter((product): product is PublicProductListing => Boolean(product));
  const filtered = sortPublicProducts(
    filterPublicProducts(publicProducts, filters),
    sort,
  );
  const total = filtered.length;
  const start = (page - 1) * pageSize;
  const products = filtered.slice(start, start + pageSize);
  return {
    marketplace,
    featureEnabled,
    products,
    featuredProducts: filtered
      .filter((product) => product.isFeatured)
      .slice(0, 4),
    total,
    page,
    pageSize,
    pages: Math.max(1, Math.ceil(total / pageSize)),
    sort,
    facets: facetsFrom(publicProducts),
  };
}

export async function getPublicProductDetail(productSlug: string) {
  const marketplace = await getPublicProductMarketplace({ pageSize: 24 });
  if (!marketplace?.featureEnabled) return null;
  const records = await prisma.product.findMany({
    where: {
      marketplaceId: marketplace.marketplace.id,
      publicationStatus: "PUBLISHED",
      category: { enabled: true },
    },
    include: {
      marketplace: { include: { service: { include: { category: true } } } },
      category: true,
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        take: 1,
      },
      variants: {
        include: {
          reservations: {
            where: { status: "ACTIVE", expiresAt: { gt: new Date() } },
          },
        },
      },
    },
  });
  const now = new Date();
  for (const record of records) {
    const product = publicProductFromRevision(record, now);
    if (product?.slug === productSlug) {
      return {
        marketplace: marketplace.marketplace,
        featureEnabled: marketplace.featureEnabled,
        product,
      };
    }
  }
  return null;
}

async function loadProductForEstimate(input: {
  productStableKey?: string;
  productSlug?: string;
}) {
  const now = new Date();
  const records = await prisma.product.findMany({
    where: {
      ...(input.productStableKey ? { stableKey: input.productStableKey } : {}),
      publicationStatus: "PUBLISHED",
      category: { enabled: true },
      marketplace: {
        service: {
          ...publicCatalogueWhere(now),
          engineType: "PRODUCT_MARKETPLACE",
        },
      },
    },
    include: {
      marketplace: { include: { service: { include: { category: true } } } },
      category: true,
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        take: 1,
      },
      variants: {
        include: {
          reservations: {
            where: { status: "ACTIVE", expiresAt: { gt: now } },
          },
        },
      },
    },
  });
  if (input.productStableKey) return records[0] ?? null;
  return (
    records.find(
      (record) => latestRevision(record)?.product.slug === input.productSlug,
    ) ?? null
  );
}

function liveAvailabilityInput({
  product,
  variantStableKey,
  publicSku,
  now,
}: {
  product: ProductWithLatestRevision;
  variantStableKey?: string;
  publicSku?: string;
  now: Date;
}) {
  const revision = latestRevision(product);
  const revisionVariant =
    (variantStableKey
      ? revision?.variants.find(
          (variant) => variant.stableKey === variantStableKey,
        )
      : null) ??
    (publicSku
      ? revision?.variants.find((variant) => variant.publicSku === publicSku)
      : null) ??
    revision?.variants.find((variant) => variant.enabled);
  const variant = product.variants.find(
    (candidate) => candidate.stableKey === revisionVariant?.stableKey,
  );
  if (!variant) {
    throw new ProductMarketplaceValidationError(
      "Choose an available product variant.",
    );
  }
  return {
    productAvailability: product.availabilityState,
    variantAvailability: variant.availabilityState,
    variantEnabled: variant.enabled,
    variantStatus: variant.status,
    stockMode: variant.stockMode,
    onHandQuantity: variant.onHandQuantity.toString(),
    activeReservedQuantity: activeReservedQuantity(variant, now).toString(),
    lowStockThreshold: variant.lowStockThreshold.toString(),
  };
}

export async function calculateServerProductEstimate(input: {
  productStableKey?: string;
  productSlug?: string;
  variantStableKey?: string;
  publicSku?: string;
  quantity: string | number;
}) {
  const flagEnabled = await productMarketplaceFlagEnabled();
  if (!flagEnabled) {
    throw new ProductMarketplaceValidationError(
      "The Product Marketplace is temporarily unavailable.",
    );
  }
  if (!input.productStableKey && !input.productSlug) {
    throw new ProductMarketplaceValidationError("Choose a product.");
  }
  const now = new Date();
  const product = await loadProductForEstimate(input);
  if (!product) {
    throw new ProductMarketplaceValidationError("Choose an available product.");
  }
  const revision = latestRevision(product);
  if (!revision) {
    throw new ProductMarketplaceValidationError(
      "This product is waiting for a published revision.",
    );
  }
  let estimate: ProductEstimateResult = calculateProductEstimate({
    revision,
    variantStableKey: input.variantStableKey,
    publicSku: input.publicSku,
    quantity: input.quantity,
    availability: liveAvailabilityInput({
      product,
      variantStableKey: input.variantStableKey,
      publicSku: input.publicSku,
      now,
    }),
    now,
  });

  if (
    (estimate.state === "AVAILABLE" || estimate.state === "LOW_STOCK") &&
    estimate.productSubtotalCents != null
  ) {
    const priced = await applyPublishedPricingIfEnabled({
      source: {
        serviceId: product.marketplace.serviceId,
        serviceSlug: product.marketplace.service.slug,
        categoryId: product.marketplace.service.categoryId,
        categorySlug: product.marketplace.service.category.slug,
        engineType: "PRODUCT_MARKETPLACE",
        currency: revision.product.currencyCode,
        baseSubtotalCents: estimate.productSubtotalCents,
        basePricingLines: estimate.lineItems,
        selectedReferences: {
          productStableKey: revision.product.stableKey,
          productSlug: revision.product.slug,
          variantStableKey: estimate.snapshot.variantStableKey,
          quantity: estimate.quantity,
        },
        engineConfigurationRevision: {
          id: revision.revision.id,
          version: revision.revision.revisionNumber,
        },
      },
    });
    estimate = withProductGlobalPricing(estimate, priced);
  }

  return estimate;
}

function publicLine(line: { label: string; amountCents: number }) {
  return { label: line.label, amountCents: line.amountCents };
}

export function publicProductEstimatePayload(estimate: ProductEstimateResult) {
  return {
    currency: estimate.currency,
    state: estimate.state,
    quantity: estimate.quantity,
    quantityLabel: estimate.quantityLabel,
    unitLabel: estimate.unitLabel,
    unitPriceCents: estimate.unitPriceCents,
    appliedTierStableKey: estimate.appliedTierStableKey,
    productSubtotalCents: estimate.productSubtotalCents,
    estimatedTotalCents: estimate.estimatedTotalCents,
    estimatedTotal: estimate.estimatedTotal,
    lineItems: estimate.lineItems.map(publicLine),
    globalPricingLines: estimate.globalPricingLines.map(publicLine),
    availabilityMessage: estimate.availabilityMessage,
    finalPriceNote: estimate.finalPriceNote,
    estimateCreatesReservation: false,
    snapshot: safeProductJson(estimate.snapshot),
  };
}
