import "server-only";

import { randomBytes } from "node:crypto";

import { z, ZodError } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  ProductInventoryConflictError,
  ProductInventoryTransitionError,
} from "@/lib/products/inventory";
import {
  productAvailabilityStates,
  productImageTypes,
  productInventoryEntryTypes,
  productPriceModes,
  productPublicationStatuses,
  productStockModes,
  productTypes,
  productVariantStatuses,
} from "@/lib/products/constants";
import {
  ProductMarketplaceValidationError,
  normalizePublishedProductRevision,
  productRevisionSnapshot,
  safeProductJson,
  type ProductPriceTierSnapshot,
  type PublicProductImageSnapshot,
  type PublicProductVariantSnapshot,
} from "@/lib/products/estimate";

export class ProductMarketplaceConflictError extends Error {}
export class ProductMarketplaceTransitionError extends Error {}

const optionalText = (maximum: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text || null;
  }, z.string().max(maximum).nullable());

const safeSlug = z
  .string()
  .trim()
  .min(1)
  .max(180)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a URL-safe slug.");

const safeKey = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[a-z0-9]+(?:[-:][a-z0-9]+)*$/i, "Use a stable public key.");

const safeAssetPath = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(
    /^\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|avif|gif)$/i,
    "Use an approved repository-relative public image path.",
  )
  .refine((value) => !value.includes(".."), "Image paths cannot traverse.");

const quantityString = z
  .string()
  .trim()
  .regex(/^\d+$/, "Use a whole positive quantity.")
  .refine((value) => BigInt(value) > 0n, "Quantity must be positive.");

const optionalQuantityString = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text || null;
}, quantityString.nullable());

export const productMarketplaceInputSchema = z.object({
  marketplaceId: z.string().min(1).max(30),
  publicName: z.string().trim().min(3).max(160),
  slug: safeSlug,
  description: z.string().trim().min(20).max(50_000),
  publicMarketplaceInstructions: z.string().trim().min(20).max(50_000),
  internalNotes: optionalText(50_000),
  currencyCode: z.literal("USD"),
  availabilityState: z.enum(productAvailabilityStates),
  defaultSort: z.string().trim().min(1).max(40),
  needsClientReview: z.boolean(),
});

export const productCategoryInputSchema = z.object({
  categoryId: z.string().min(1).max(30).optional(),
  marketplaceId: z.string().min(1).max(30),
  stableKey: safeKey.optional(),
  publicName: z.string().trim().min(2).max(160),
  slug: safeSlug,
  publicDescription: optionalText(50_000),
  productType: z.enum(productTypes),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  enabled: z.boolean(),
  needsClientReview: z.boolean(),
});

export const productInputSchema = z.object({
  productId: z.string().min(1).max(30).optional(),
  marketplaceId: z.string().min(1).max(30),
  categoryId: z.string().min(1).max(30),
  publicTitle: z.string().trim().min(3).max(180),
  slug: safeSlug,
  shortDescription: z.string().trim().min(12).max(500),
  fullDescription: z.string().trim().min(20).max(50_000),
  internalReferenceCode: z.string().trim().min(3).max(120),
  productType: z.enum(productTypes),
  currencyCode: z.literal("USD"),
  isFeatured: z.boolean(),
  publicBadgeText: optionalText(120),
  availabilityState: z.enum(productAvailabilityStates),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  needsClientReview: z.boolean(),
});

export const productVariantInputSchema = z.object({
  productId: z.string().min(1).max(30),
  variantId: z.string().min(1).max(30).optional(),
  stableKey: safeKey.optional(),
  publicName: z.string().trim().min(1).max(160),
  publicSku: optionalText(120),
  internalSku: z.string().trim().min(3).max(120),
  unitLabel: z.string().trim().min(1).max(80),
  priceMode: z.enum(productPriceModes),
  baseUnitPriceCents: z.coerce.number().int().min(0).max(100_000_000),
  minimumQuantity: quantityString,
  maximumQuantity: quantityString,
  quantityIncrement: quantityString,
  stockMode: z.enum(productStockModes),
  availabilityState: z.enum(productAvailabilityStates),
  status: z.enum(productVariantStatuses),
  lowStockThreshold: z
    .string()
    .trim()
    .regex(/^\d+$/, "Low-stock threshold must be a whole number."),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  enabled: z.boolean(),
  needsClientReview: z.boolean(),
});

export const productPriceTierInputSchema = z.object({
  variantId: z.string().min(1).max(30),
  tierId: z.string().min(1).max(30).optional(),
  stableKey: safeKey.optional(),
  minimumQuantity: quantityString,
  maximumQuantity: optionalQuantityString,
  unitPriceCents: z.coerce.number().int().min(0).max(100_000_000),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  enabled: z.boolean(),
  needsClientReview: z.boolean(),
});

export const productImageInputSchema = z.object({
  productId: z.string().min(1).max(30),
  imageId: z.string().min(1).max(30).optional(),
  stableKey: safeKey.optional(),
  imageType: z.enum(productImageTypes),
  assetPath: safeAssetPath,
  altText: z.string().trim().min(3).max(240),
  caption: optionalText(240),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  isPublic: z.boolean(),
  needsClientReview: z.boolean(),
});

export const productAvailabilityInputSchema = z.object({
  productId: z.string().min(1).max(30),
  availabilityState: z.enum(productAvailabilityStates),
  reason: z.string().trim().min(3).max(240),
});

export const productInventoryAdjustmentInputSchema = z.object({
  variantId: z.string().min(1).max(30),
  entryType: z.enum(productInventoryEntryTypes),
  quantity: quantityString,
  reason: z.string().trim().min(3).max(240),
  internalNote: optionalText(20_000),
  referenceKey: optionalText(160),
});

export const productReservationInputSchema = z.object({
  variantId: z.string().min(1).max(30),
  quantity: quantityString,
  expiresAt: z.coerce.date(),
  safeInternalPurpose: z.string().trim().min(3).max(240),
  idempotencyKey: optionalText(160),
  futureExternalRef: optionalText(160),
});

type ProductMarketplaceInput = z.infer<typeof productMarketplaceInputSchema>;
type ProductCategoryInput = z.infer<typeof productCategoryInputSchema>;
type ProductInput = z.infer<typeof productInputSchema>;
type ProductVariantInput = z.infer<typeof productVariantInputSchema>;
type ProductPriceTierInput = z.infer<typeof productPriceTierInputSchema>;
type ProductImageInput = z.infer<typeof productImageInputSchema>;
type ProductAvailabilityInput = z.infer<typeof productAvailabilityInputSchema>;

function stableId() {
  return randomBytes(12).toString("hex");
}

function stableKey(prefix: string) {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

function json(value: unknown) {
  return safeProductJson(value) as Prisma.InputJsonValue;
}

function auditMetadata(value: Record<string, unknown>) {
  return json(value);
}

function bigint(value: string) {
  return BigInt(value);
}

export async function getProductsAdminOverview() {
  const [
    marketplaces,
    categories,
    products,
    published,
    variants,
    lowStock,
    activeReservations,
    review,
    flag,
    activity,
  ] = await Promise.all([
    prisma.productMarketplace.count(),
    prisma.productCategory.count(),
    prisma.product.count(),
    prisma.product.count({ where: { publicationStatus: "PUBLISHED" } }),
    prisma.productVariant.count(),
    prisma.productVariant.count({
      where: { availabilityState: { in: ["LOW_STOCK", "OUT_OF_STOCK"] } },
    }),
    prisma.productInventoryReservation.count({ where: { status: "ACTIVE" } }),
    prisma.product.count({ where: { needsClientReview: true } }),
    prisma.featureFlag.findUnique({
      where: { key: "product_marketplace_enabled" },
      select: { enabled: true },
    }),
    prisma.auditLog.findMany({
      where: { action: { startsWith: "products." } },
      orderBy: { createdAt: "desc" },
      take: 8,
      include: { actor: { select: { name: true, email: true } } },
    }),
  ]);
  return {
    marketplaces,
    categories,
    products,
    published,
    variants,
    lowStock,
    activeReservations,
    needsReview: review,
    productMarketplaceEnabled: Boolean(flag?.enabled),
    activity,
  };
}

export async function getProductMarketplaceAdmin() {
  return prisma.productMarketplace.findFirst({
    include: { service: { include: { category: true } } },
    orderBy: { createdAt: "asc" },
  });
}

export async function getProductAdminCategories() {
  return prisma.productCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { publicName: "asc" }],
    include: { marketplace: { select: { publicName: true } } },
  });
}

export async function getProductAdminProducts() {
  return prisma.product.findMany({
    orderBy: [{ updatedAt: "desc" }, { publicTitle: "asc" }],
    include: {
      marketplace: { select: { publicName: true } },
      category: { select: { publicName: true, slug: true } },
      variants: {
        orderBy: [{ sortOrder: "asc" }, { publicName: "asc" }],
        take: 3,
      },
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        take: 1,
      },
    },
  });
}

export async function getProductAdminProduct(productId: string) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      marketplace: { include: { service: { include: { category: true } } } },
      category: true,
      variants: {
        orderBy: [{ sortOrder: "asc" }, { publicName: "asc" }],
        include: {
          priceTiers: {
            orderBy: [{ sortOrder: "asc" }, { minimumQuantity: "asc" }],
          },
          reservations: {
            orderBy: [{ createdAt: "desc" }],
            include: {
              events: { orderBy: { createdAt: "desc" } },
            },
          },
          ledgerEntries: {
            orderBy: { createdAt: "desc" },
            take: 20,
          },
        },
      },
      tags: { include: { tag: true } },
      images: { orderBy: [{ imageType: "asc" }, { sortOrder: "asc" }] },
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        include: { publishedBy: { select: { name: true, email: true } } },
      },
    },
  });
}

async function latestRevisionNumber(
  transaction: Prisma.TransactionClient,
  productId: string,
) {
  const latest = await transaction.productRevision.findFirst({
    where: { productId },
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true },
  });
  return latest?.revisionNumber ?? 0;
}

function validateTierBoundaries(tiers: ProductPriceTierSnapshot[]) {
  const enabled = tiers
    .filter((tier) => tier.enabled)
    .sort((left, right) => {
      const delta =
        BigInt(left.minimumQuantity) - BigInt(right.minimumQuantity);
      if (delta !== 0n) return delta < 0n ? -1 : 1;
      return left.stableKey.localeCompare(right.stableKey);
    });
  let previousMaximum: bigint | null = null;
  for (const tier of enabled) {
    const minimum = BigInt(tier.minimumQuantity);
    const maximum = tier.maximumQuantity ? BigInt(tier.maximumQuantity) : null;
    if (minimum <= 0n || (maximum !== null && maximum < minimum)) {
      throw new ProductMarketplaceValidationError(
        "Quantity tier boundaries are invalid.",
      );
    }
    if (previousMaximum !== null && minimum <= previousMaximum) {
      throw new ProductMarketplaceValidationError(
        "Quantity tiers cannot overlap.",
      );
    }
    previousMaximum = maximum;
  }
}

async function snapshotFromProduct({
  transaction,
  productId,
  revisionId,
  revisionNumber,
  publishedAt,
}: {
  transaction: Prisma.TransactionClient;
  productId: string;
  revisionId: string;
  revisionNumber: number;
  publishedAt: Date;
}) {
  const product = await transaction.product.findUniqueOrThrow({
    where: { id: productId },
    include: {
      marketplace: { include: { service: { include: { category: true } } } },
      category: true,
      variants: {
        where: { enabled: true },
        orderBy: [{ sortOrder: "asc" }, { publicName: "asc" }],
        include: {
          priceTiers: {
            where: { enabled: true },
            orderBy: [{ minimumQuantity: "asc" }, { sortOrder: "asc" }],
          },
        },
      },
      tags: {
        include: { tag: true },
        orderBy: { tag: { publicLabel: "asc" } },
      },
      images: {
        where: { isPublic: true },
        orderBy: [{ imageType: "asc" }, { sortOrder: "asc" }],
      },
    },
  });
  if (!product.category.enabled) {
    throw new ProductMarketplaceValidationError(
      "Products in disabled categories cannot be published.",
    );
  }
  if (!product.variants.length) {
    throw new ProductMarketplaceValidationError(
      "Publish requires at least one enabled variant.",
    );
  }

  const variants = product.variants.map((variant) => {
    const priceTiers = variant.priceTiers.map((tier) => ({
      stableKey: tier.stableKey,
      minimumQuantity: tier.minimumQuantity.toString(),
      maximumQuantity: tier.maximumQuantity?.toString() ?? null,
      unitPriceCents: tier.unitPriceCents,
      sortOrder: tier.sortOrder,
      enabled: tier.enabled,
    })) satisfies ProductPriceTierSnapshot[];
    if (variant.priceMode === "QUANTITY_TIER") {
      validateTierBoundaries(priceTiers);
      if (!priceTiers.length) {
        throw new ProductMarketplaceValidationError(
          "Quantity-tier variants require at least one enabled tier.",
        );
      }
    }
    return {
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
      enabled: variant.enabled,
      priceTiers,
    } satisfies PublicProductVariantSnapshot;
  });

  return productRevisionSnapshot({
    marketplace: {
      id: product.marketplace.id,
      stableKey: product.marketplace.stableKey,
      slug: product.marketplace.slug,
      serviceId: product.marketplace.serviceId,
      serviceSlug: product.marketplace.service.slug,
      categoryId: product.marketplace.service.categoryId,
      categorySlug: product.marketplace.service.category.slug,
      publicName: product.marketplace.publicName,
      currencyCode: product.marketplace.currencyCode,
    },
    product: {
      id: product.id,
      stableKey: product.stableKey,
      slug: product.slug,
      publicTitle: product.publicTitle,
      shortDescription: product.shortDescription,
      fullDescription: product.fullDescription,
      productType: product.productType,
      currencyCode: product.currencyCode,
      publicBadgeText: product.publicBadgeText,
      isFeatured: product.isFeatured,
      category: {
        stableKey: product.category.stableKey,
        slug: product.category.slug,
        publicName: product.category.publicName,
        productType: product.category.productType,
      },
    },
    revisionId,
    revisionNumber,
    publishedAt,
    variants,
    tags: product.tags
      .filter((item) => item.tag.enabled)
      .map((item) => ({
        stableKey: item.tag.stableKey,
        slug: item.tag.slug,
        publicLabel: item.tag.publicLabel,
      })),
    images: product.images.map((image) => ({
      stableKey: image.stableKey,
      imageType: image.imageType,
      assetPath: image.assetPath,
      altText: image.altText,
      caption: image.caption,
      sortOrder: image.sortOrder,
    })) satisfies PublicProductImageSnapshot[],
  });
}

export async function saveProductMarketplace({
  input,
  actorId,
  expectedVersion,
}: {
  input: ProductMarketplaceInput;
  actorId: string;
  expectedVersion: number;
}) {
  const updated = await prisma.productMarketplace.updateMany({
    where: { id: input.marketplaceId, concurrencyVersion: expectedVersion },
    data: {
      publicName: input.publicName,
      slug: input.slug,
      description: input.description,
      publicMarketplaceInstructions: input.publicMarketplaceInstructions,
      internalNotes: input.internalNotes,
      currencyCode: input.currencyCode,
      availabilityState: input.availabilityState,
      defaultSort: input.defaultSort,
      needsClientReview: input.needsClientReview,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new ProductMarketplaceConflictError(
      "Marketplace configuration changed after this page loaded. Reload before saving.",
    );
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "products.marketplace.updated",
      targetType: "ProductMarketplace",
      targetId: input.marketplaceId,
      metadata: auditMetadata({
        availabilityState: input.availabilityState,
        needsClientReview: input.needsClientReview,
      }),
    },
  });
}

export async function saveProductCategory({
  input,
  actorId,
  expectedVersion,
}: {
  input: ProductCategoryInput;
  actorId: string;
  expectedVersion?: number;
}) {
  const data = {
    marketplaceId: input.marketplaceId,
    stableKey: input.stableKey ?? stableKey("prod-category"),
    publicName: input.publicName,
    slug: input.slug,
    publicDescription: input.publicDescription,
    productType: input.productType,
    sortOrder: input.sortOrder,
    enabled: input.enabled,
    needsClientReview: input.needsClientReview,
  };
  let categoryId = input.categoryId;
  if (categoryId) {
    const updated = await prisma.productCategory.updateMany({
      where: { id: categoryId, concurrencyVersion: expectedVersion },
      data: {
        publicName: data.publicName,
        slug: data.slug,
        publicDescription: data.publicDescription,
        productType: data.productType,
        sortOrder: data.sortOrder,
        enabled: data.enabled,
        needsClientReview: data.needsClientReview,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ProductMarketplaceConflictError(
        "Category changed after this page loaded. Reload before saving.",
      );
    }
  } else {
    const category = await prisma.productCategory.create({
      data: { id: stableId(), ...data },
      select: { id: true },
    });
    categoryId = category.id;
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: input.categoryId
        ? "products.category.updated"
        : "products.category.created",
      targetType: "ProductCategory",
      targetId: categoryId,
      metadata: auditMetadata({
        productType: input.productType,
        enabled: input.enabled,
      }),
    },
  });
  return { id: categoryId! };
}

export async function saveProduct({
  input,
  actorId,
  expectedVersion,
}: {
  input: ProductInput;
  actorId: string;
  expectedVersion?: number;
}) {
  const data = {
    marketplaceId: input.marketplaceId,
    categoryId: input.categoryId,
    publicTitle: input.publicTitle,
    slug: input.slug,
    shortDescription: input.shortDescription,
    fullDescription: input.fullDescription,
    internalReferenceCode: input.internalReferenceCode,
    productType: input.productType,
    currencyCode: input.currencyCode,
    isFeatured: input.isFeatured,
    publicBadgeText: input.publicBadgeText,
    availabilityState: input.availabilityState,
    sortOrder: input.sortOrder,
    needsClientReview: input.needsClientReview,
  };
  let productId = input.productId;
  if (productId) {
    const updated = await prisma.product.updateMany({
      where: { id: productId, concurrencyVersion: expectedVersion },
      data: { ...data, concurrencyVersion: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new ProductMarketplaceConflictError(
        "Product changed after this page loaded. Reload before saving.",
      );
    }
  } else {
    const product = await prisma.product.create({
      data: {
        id: stableId(),
        stableKey: stableKey("prod"),
        ...data,
        publicationStatus: "DRAFT",
      },
      select: { id: true },
    });
    productId = product.id;
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: input.productId
        ? "products.product.updated"
        : "products.product.created",
      targetType: "Product",
      targetId: productId,
      metadata: auditMetadata({
        productType: input.productType,
        availabilityState: input.availabilityState,
        needsClientReview: input.needsClientReview,
      }),
    },
  });
  return { id: productId! };
}

export async function saveProductVariant({
  input,
  actorId,
  expectedVersion,
}: {
  input: ProductVariantInput;
  actorId: string;
  expectedVersion?: number;
}) {
  const minimumQuantity = bigint(input.minimumQuantity);
  const maximumQuantity = bigint(input.maximumQuantity);
  const quantityIncrement = bigint(input.quantityIncrement);
  const lowStockThreshold = BigInt(input.lowStockThreshold);
  if (maximumQuantity < minimumQuantity) {
    throw new ProductMarketplaceValidationError(
      "Maximum quantity cannot be below minimum quantity.",
    );
  }
  if (quantityIncrement <= 0n) {
    throw new ProductMarketplaceValidationError(
      "Quantity increment must be positive.",
    );
  }
  const data = {
    productId: input.productId,
    stableKey: input.stableKey ?? stableKey("prod-variant"),
    publicName: input.publicName,
    publicSku: input.publicSku,
    internalSku: input.internalSku,
    unitLabel: input.unitLabel,
    priceMode: input.priceMode,
    baseUnitPriceCents: input.baseUnitPriceCents,
    minimumQuantity,
    maximumQuantity,
    quantityIncrement,
    stockMode: input.stockMode,
    availabilityState: input.availabilityState,
    status: input.status,
    lowStockThreshold,
    sortOrder: input.sortOrder,
    enabled: input.enabled,
    needsClientReview: input.needsClientReview,
  };
  let variantId = input.variantId;
  if (variantId) {
    const updated = await prisma.productVariant.updateMany({
      where: { id: variantId, concurrencyVersion: expectedVersion },
      data: {
        publicName: data.publicName,
        publicSku: data.publicSku,
        internalSku: data.internalSku,
        unitLabel: data.unitLabel,
        priceMode: data.priceMode,
        baseUnitPriceCents: data.baseUnitPriceCents,
        minimumQuantity: data.minimumQuantity,
        maximumQuantity: data.maximumQuantity,
        quantityIncrement: data.quantityIncrement,
        stockMode: data.stockMode,
        availabilityState: data.availabilityState,
        status: data.status,
        lowStockThreshold: data.lowStockThreshold,
        sortOrder: data.sortOrder,
        enabled: data.enabled,
        needsClientReview: data.needsClientReview,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ProductMarketplaceConflictError(
        "Variant changed after this page loaded. Reload before saving.",
      );
    }
  } else {
    const variant = await prisma.productVariant.create({
      data: { id: stableId(), ...data },
      select: { id: true },
    });
    variantId = variant.id;
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: input.variantId
        ? "products.variant.updated"
        : "products.variant.created",
      targetType: "ProductVariant",
      targetId: variantId,
      metadata: auditMetadata({
        productId: input.productId,
        priceMode: input.priceMode,
        stockMode: input.stockMode,
        enabled: input.enabled,
      }),
    },
  });
  return { id: variantId! };
}

export async function saveProductPriceTier({
  input,
  actorId,
  expectedVersion,
}: {
  input: ProductPriceTierInput;
  actorId: string;
  expectedVersion?: number;
}) {
  const data = {
    variantId: input.variantId,
    stableKey: input.stableKey ?? stableKey("prod-tier"),
    minimumQuantity: bigint(input.minimumQuantity),
    maximumQuantity: input.maximumQuantity
      ? bigint(input.maximumQuantity)
      : null,
    unitPriceCents: input.unitPriceCents,
    sortOrder: input.sortOrder,
    enabled: input.enabled,
    needsClientReview: input.needsClientReview,
  };
  if (
    data.maximumQuantity !== null &&
    data.maximumQuantity < data.minimumQuantity
  ) {
    throw new ProductMarketplaceValidationError(
      "Tier maximum cannot be below minimum quantity.",
    );
  }
  let tierId = input.tierId;
  if (tierId) {
    const updated = await prisma.productPriceTier.updateMany({
      where: { id: tierId, concurrencyVersion: expectedVersion },
      data: {
        minimumQuantity: data.minimumQuantity,
        maximumQuantity: data.maximumQuantity,
        unitPriceCents: data.unitPriceCents,
        sortOrder: data.sortOrder,
        enabled: data.enabled,
        needsClientReview: data.needsClientReview,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ProductMarketplaceConflictError(
        "Price tier changed after this page loaded. Reload before saving.",
      );
    }
  } else {
    const tier = await prisma.productPriceTier.create({
      data: { id: stableId(), ...data },
      select: { id: true },
    });
    tierId = tier.id;
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: input.tierId
        ? "products.price_tier.updated"
        : "products.price_tier.created",
      targetType: "ProductPriceTier",
      targetId: tierId,
      metadata: auditMetadata({
        variantId: input.variantId,
        enabled: input.enabled,
      }),
    },
  });
  return { id: tierId! };
}

export async function saveProductImage({
  input,
  actorId,
  expectedVersion,
}: {
  input: ProductImageInput;
  actorId: string;
  expectedVersion?: number;
}) {
  const data = {
    productId: input.productId,
    stableKey: input.stableKey ?? stableKey("prod-image"),
    imageType: input.imageType,
    assetPath: input.assetPath,
    altText: input.altText,
    caption: input.caption,
    sortOrder: input.sortOrder,
    isPublic: input.isPublic,
    needsClientReview: input.needsClientReview,
  };
  let imageId = input.imageId;
  if (imageId) {
    const updated = await prisma.productImage.updateMany({
      where: { id: imageId, concurrencyVersion: expectedVersion },
      data: {
        imageType: data.imageType,
        assetPath: data.assetPath,
        altText: data.altText,
        caption: data.caption,
        sortOrder: data.sortOrder,
        isPublic: data.isPublic,
        needsClientReview: data.needsClientReview,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ProductMarketplaceConflictError(
        "Image changed after this page loaded. Reload before saving.",
      );
    }
  } else {
    const image = await prisma.productImage.create({
      data: { id: stableId(), ...data },
      select: { id: true },
    });
    imageId = image.id;
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: input.imageId ? "products.image.updated" : "products.image.added",
      targetType: "ProductImage",
      targetId: imageId,
      metadata: auditMetadata({
        productId: input.productId,
        imageType: input.imageType,
        isPublic: input.isPublic,
      }),
    },
  });
  return { id: imageId! };
}

export async function changeProductAvailability({
  input,
  actorId,
  expectedVersion,
}: {
  input: ProductAvailabilityInput;
  actorId: string;
  expectedVersion: number;
}) {
  const updated = await prisma.product.updateMany({
    where: { id: input.productId, concurrencyVersion: expectedVersion },
    data: {
      availabilityState: input.availabilityState,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new ProductMarketplaceConflictError(
      "Availability changed after this page loaded. Reload before saving.",
    );
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "products.availability.changed",
      targetType: "Product",
      targetId: input.productId,
      metadata: auditMetadata({
        availabilityState: input.availabilityState,
        reason: input.reason,
      }),
    },
  });
}

export async function publishProduct({
  productId,
  actorId,
  expectedVersion,
}: {
  productId: string;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const revisionId = stableId();
    const revisionNumber =
      (await latestRevisionNumber(transaction, productId)) + 1;
    const publishedAt = new Date();
    const snapshot = await snapshotFromProduct({
      transaction,
      productId,
      revisionId,
      revisionNumber,
      publishedAt,
    });
    const claimed = await transaction.product.updateMany({
      where: { id: productId, concurrencyVersion: expectedVersion },
      data: {
        publicationStatus: "PUBLISHED",
        publishedAt,
        archivedAt: null,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (claimed.count !== 1) {
      throw new ProductMarketplaceConflictError(
        "Product changed after this page loaded. Reload before publishing.",
      );
    }
    await transaction.productRevision.create({
      data: {
        id: revisionId,
        productId,
        revisionNumber,
        snapshotSchemaVersion: 1,
        snapshot: json(snapshot),
        publishedAt,
        publishedById: actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "products.product.published",
        targetType: "Product",
        targetId: productId,
        metadata: auditMetadata({ revisionId, revisionNumber }),
      },
    });
    return { revisionId, revisionNumber };
  });
}

async function replaceDraftFromRevision({
  transaction,
  productId,
  revisionId,
}: {
  transaction: Prisma.TransactionClient;
  productId: string;
  revisionId?: string;
}) {
  const revision = revisionId
    ? await transaction.productRevision.findFirst({
        where: { id: revisionId, productId },
        select: { snapshot: true },
      })
    : await transaction.productRevision.findFirst({
        where: { productId },
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        select: { snapshot: true },
      });
  if (!revision) {
    throw new ProductMarketplaceTransitionError(
      "No published product revision is available.",
    );
  }
  const snapshot = normalizePublishedProductRevision(revision.snapshot);
  const category = await transaction.productCategory.findFirst({
    where: { stableKey: snapshot.product.category.stableKey },
    select: { id: true },
  });
  if (!category) {
    throw new ProductMarketplaceTransitionError(
      "The revision category no longer exists.",
    );
  }
  await transaction.product.update({
    where: { id: productId },
    data: {
      categoryId: category.id,
      publicTitle: snapshot.product.publicTitle,
      slug: snapshot.product.slug,
      shortDescription: snapshot.product.shortDescription,
      fullDescription: snapshot.product.fullDescription,
      productType: snapshot.product.productType,
      currencyCode: snapshot.product.currencyCode,
      isFeatured: snapshot.product.isFeatured,
      publicBadgeText: snapshot.product.publicBadgeText,
      concurrencyVersion: { increment: 1 },
    },
  });

  const keepVariantKeys = new Set(
    snapshot.variants.map((variant) => variant.stableKey),
  );
  await transaction.productVariant.updateMany({
    where: { productId, stableKey: { notIn: [...keepVariantKeys] } },
    data: { enabled: false, concurrencyVersion: { increment: 1 } },
  });
  for (const variant of snapshot.variants) {
    const saved = await transaction.productVariant.upsert({
      where: { stableKey: variant.stableKey },
      create: {
        id: stableId(),
        stableKey: variant.stableKey,
        productId,
        publicName: variant.publicName,
        publicSku: variant.publicSku,
        internalSku: `RESTORED-${variant.stableKey}`.slice(0, 120),
        unitLabel: variant.unitLabel,
        priceMode: variant.priceMode,
        baseUnitPriceCents: variant.baseUnitPriceCents,
        minimumQuantity: BigInt(variant.minimumQuantity),
        maximumQuantity: BigInt(variant.maximumQuantity),
        quantityIncrement: BigInt(variant.quantityIncrement),
        stockMode: variant.stockMode,
        enabled: true,
        needsClientReview: true,
      },
      update: {
        publicName: variant.publicName,
        publicSku: variant.publicSku,
        unitLabel: variant.unitLabel,
        priceMode: variant.priceMode,
        baseUnitPriceCents: variant.baseUnitPriceCents,
        minimumQuantity: BigInt(variant.minimumQuantity),
        maximumQuantity: BigInt(variant.maximumQuantity),
        quantityIncrement: BigInt(variant.quantityIncrement),
        stockMode: variant.stockMode,
        enabled: true,
        needsClientReview: true,
        concurrencyVersion: { increment: 1 },
      },
      select: { id: true },
    });
    await transaction.productPriceTier.deleteMany({
      where: { variantId: saved.id },
    });
    if (variant.priceTiers.length) {
      await transaction.productPriceTier.createMany({
        data: variant.priceTiers.map((tier) => ({
          id: stableId(),
          stableKey: tier.stableKey,
          variantId: saved.id,
          minimumQuantity: BigInt(tier.minimumQuantity),
          maximumQuantity: tier.maximumQuantity
            ? BigInt(tier.maximumQuantity)
            : null,
          unitPriceCents: tier.unitPriceCents,
          sortOrder: tier.sortOrder,
          enabled: tier.enabled,
          needsClientReview: true,
        })),
      });
    }
  }

  await transaction.productTagAssignment.deleteMany({ where: { productId } });
  for (const tag of snapshot.tags) {
    const savedTag = await transaction.productTag.findFirst({
      where: { stableKey: tag.stableKey },
      select: { id: true },
    });
    if (savedTag) {
      await transaction.productTagAssignment.createMany({
        data: [{ productId, tagId: savedTag.id }],
        skipDuplicates: true,
      });
    }
  }
  await transaction.productImage.deleteMany({ where: { productId } });
  if (snapshot.images.length) {
    await transaction.productImage.createMany({
      data: snapshot.images.map((image) => ({
        id: stableId(),
        stableKey: image.stableKey,
        productId,
        imageType: image.imageType,
        assetPath: image.assetPath,
        altText: image.altText,
        caption: image.caption,
        sortOrder: image.sortOrder,
        isPublic: true,
        needsClientReview: true,
      })),
      skipDuplicates: true,
    });
  }
}

export async function discardProductDraft({
  productId,
  actorId,
  expectedVersion,
}: {
  productId: string;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const claimed = await transaction.product.updateMany({
      where: { id: productId, concurrencyVersion: expectedVersion },
      data: { concurrencyVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw new ProductMarketplaceConflictError(
        "Product changed after this page loaded. Reload before discarding.",
      );
    }
    await replaceDraftFromRevision({ transaction, productId });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "products.product.draft_discarded",
        targetType: "Product",
        targetId: productId,
        metadata: auditMetadata({ restoredLatestRevision: true }),
      },
    });
  });
}

export async function restoreProductRevision({
  productId,
  revisionId,
  actorId,
  expectedVersion,
}: {
  productId: string;
  revisionId: string;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const claimed = await transaction.product.updateMany({
      where: { id: productId, concurrencyVersion: expectedVersion },
      data: { concurrencyVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw new ProductMarketplaceConflictError(
        "Product changed after this page loaded. Reload before restoring.",
      );
    }
    await replaceDraftFromRevision({ transaction, productId, revisionId });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "products.product.revision_restored",
        targetType: "ProductRevision",
        targetId: revisionId,
        metadata: auditMetadata({ productId }),
      },
    });
  });
}

export function productActionErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the submitted values.";
  }
  if (
    error instanceof ProductMarketplaceConflictError ||
    error instanceof ProductMarketplaceTransitionError ||
    error instanceof ProductInventoryConflictError ||
    error instanceof ProductInventoryTransitionError ||
    error instanceof ProductMarketplaceValidationError
  ) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "P2002") return "That product marketplace record exists.";
    if (code === "P2003") {
      return "This product marketplace record is still referenced and cannot be removed.";
    }
    if (code === "P2025") {
      return "This product marketplace record no longer exists.";
    }
  }
  console.error("[products:action]", {
    errorName: error instanceof Error ? error.name : typeof error,
  });
  return "The product marketplace action could not be completed. Please try again.";
}

export { productPublicationStatuses };
