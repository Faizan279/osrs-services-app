import { z } from "zod";

import {
  PRODUCT_ESTIMATE_SNAPSHOT_SCHEMA_VERSION,
  PRODUCT_REVISION_SCHEMA_VERSION,
  productAvailabilityStates,
  productPriceModes,
  productStockModes,
  productTypes,
} from "@/lib/products/constants";
import { formatCents, type PricingLine } from "@/lib/pricing/engine";

export class ProductMarketplaceValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProductMarketplaceValidationError";
  }
}

export type ProductType = (typeof productTypes)[number];
export type ProductAvailabilityState =
  (typeof productAvailabilityStates)[number];
export type ProductPriceMode = (typeof productPriceModes)[number];
export type ProductStockMode = (typeof productStockModes)[number];

export type ProductPriceTierSnapshot = {
  stableKey: string;
  minimumQuantity: string;
  maximumQuantity: string | null;
  unitPriceCents: number;
  sortOrder: number;
  enabled: boolean;
};

export type PublicProductVariantSnapshot = {
  stableKey: string;
  publicName: string;
  publicSku: string | null;
  unitLabel: string;
  priceMode: ProductPriceMode;
  baseUnitPriceCents: number;
  minimumQuantity: string;
  maximumQuantity: string;
  quantityIncrement: string;
  stockMode: ProductStockMode;
  sortOrder: number;
  enabled: boolean;
  priceTiers: ProductPriceTierSnapshot[];
};

export type PublicProductImageSnapshot = {
  stableKey: string;
  imageType: "COVER" | "GALLERY" | "PACKAGE";
  assetPath: string;
  altText: string;
  caption: string | null;
  sortOrder: number;
};

export type PublishedProductRevisionSnapshotV1 = {
  schemaVersion: typeof PRODUCT_REVISION_SCHEMA_VERSION;
  marketplace: {
    id: string;
    stableKey: string;
    slug: string;
    serviceId: string;
    serviceSlug: string;
    categoryId: string;
    categorySlug: string | null;
    publicName: string;
    currencyCode: string;
  };
  product: {
    id: string;
    stableKey: string;
    slug: string;
    publicTitle: string;
    shortDescription: string;
    fullDescription: string;
    productType: ProductType;
    currencyCode: string;
    publicBadgeText: string | null;
    isFeatured: boolean;
    category: {
      stableKey: string;
      slug: string;
      publicName: string;
      productType: ProductType;
    };
  };
  revision: {
    id: string;
    revisionNumber: number;
    publishedAt: string;
  };
  variants: PublicProductVariantSnapshot[];
  tags: Array<{ stableKey: string; slug: string; publicLabel: string }>;
  images: PublicProductImageSnapshot[];
};

export type ProductEstimateState =
  | "AVAILABLE"
  | "LOW_STOCK"
  | "OUT_OF_STOCK"
  | "MANUAL_REVIEW_REQUIRED"
  | "UNAVAILABLE";

export type ProductEstimateSnapshotV1 = {
  schemaVersion: typeof PRODUCT_ESTIMATE_SNAPSHOT_SCHEMA_VERSION;
  marketplaceStableKey: string;
  productStableKey: string;
  productSlug: string;
  productPublicTitle: string;
  productType: ProductType;
  variantStableKey: string;
  variantPublicName: string;
  quantity: string;
  unitLabel: string;
  currency: string;
  authoritativeUnitPriceCents: number | null;
  appliedPriceTierStableKey: string | null;
  productSubtotalCents: number | null;
  customerSafeGlobalPricingLines: Array<{
    label: string;
    amountCents: number;
  }>;
  finalEstimatedTotalCents: number | null;
  estimateState: ProductEstimateState;
  publishedProductRevision: {
    id: string;
    revisionNumber: number;
  };
  publishedGlobalPricingRevision: {
    id: string;
    revisionNumber: number;
  } | null;
  customerSafeAvailability: {
    state: ProductEstimateState;
    message: string;
  };
  generatedAt: string;
  repricingRequired: boolean;
  stockRecheckRequired: boolean;
  reservationRequiredBeforeOrder: boolean;
};

export type ProductEstimateResult = {
  currency: string;
  state: ProductEstimateState;
  quantity: string;
  quantityLabel: string;
  unitLabel: string;
  unitPriceCents: number | null;
  appliedTierStableKey: string | null;
  productSubtotalCents: number | null;
  estimatedTotalCents: number | null;
  estimatedTotal: string | null;
  lineItems: PricingLine[];
  globalPricingLines: PricingLine[];
  availabilityMessage: string;
  finalPriceNote: string;
  snapshot: ProductEstimateSnapshotV1;
};

export type ProductEstimateAvailabilityInput = {
  productAvailability: ProductAvailabilityState;
  variantAvailability: ProductAvailabilityState;
  variantEnabled: boolean;
  variantStatus: "AVAILABLE" | "PAUSED" | "UNAVAILABLE";
  stockMode: ProductStockMode;
  onHandQuantity: string | bigint;
  activeReservedQuantity: string | bigint;
  lowStockThreshold: string | bigint;
};

export type ProductEstimateInput = {
  revision: PublishedProductRevisionSnapshotV1;
  variantStableKey?: string;
  publicSku?: string;
  quantity: string | number | bigint;
  availability: ProductEstimateAvailabilityInput;
  now?: Date;
};

const MAX_PRODUCT_QUANTITY = 1_000_000_000_000n;
const MAX_SAFE_MONEY_CENTS = 100_000_000n;
const decimalBigIntString = z.string().regex(/^\d+$/);

const tierSchema: z.ZodType<ProductPriceTierSnapshot> = z
  .object({
    stableKey: z.string().min(1).max(160),
    minimumQuantity: decimalBigIntString,
    maximumQuantity: decimalBigIntString.nullable(),
    unitPriceCents: z.number().int().min(0).max(Number(MAX_SAFE_MONEY_CENTS)),
    sortOrder: z.number().int().min(0).max(100_000),
    enabled: z.boolean(),
  })
  .superRefine((tier, context) => {
    const minimum = toBigInt(tier.minimumQuantity, "Tier minimum");
    const maximum = tier.maximumQuantity
      ? toBigInt(tier.maximumQuantity, "Tier maximum")
      : null;
    if (minimum <= 0n) {
      context.addIssue({
        code: "custom",
        path: ["minimumQuantity"],
        message: "Tier minimum must be positive.",
      });
    }
    if (maximum !== null && maximum < minimum) {
      context.addIssue({
        code: "custom",
        path: ["maximumQuantity"],
        message: "Tier maximum cannot be below minimum.",
      });
    }
  });

const variantSchema: z.ZodType<PublicProductVariantSnapshot> = z
  .object({
    stableKey: z.string().min(1).max(160),
    publicName: z.string().min(1).max(160),
    publicSku: z.string().max(120).nullable(),
    unitLabel: z.string().min(1).max(80),
    priceMode: z.enum(productPriceModes),
    baseUnitPriceCents: z
      .number()
      .int()
      .min(0)
      .max(Number(MAX_SAFE_MONEY_CENTS)),
    minimumQuantity: decimalBigIntString,
    maximumQuantity: decimalBigIntString,
    quantityIncrement: decimalBigIntString,
    stockMode: z.enum(productStockModes),
    sortOrder: z.number().int().min(0).max(100_000),
    enabled: z.boolean(),
    priceTiers: z.array(tierSchema),
  })
  .superRefine((variant, context) => {
    const minimum = toBigInt(variant.minimumQuantity, "Minimum quantity");
    const maximum = toBigInt(variant.maximumQuantity, "Maximum quantity");
    const increment = toBigInt(variant.quantityIncrement, "Quantity increment");
    if (minimum <= 0n) {
      context.addIssue({
        code: "custom",
        path: ["minimumQuantity"],
        message: "Minimum quantity must be positive.",
      });
    }
    if (maximum < minimum) {
      context.addIssue({
        code: "custom",
        path: ["maximumQuantity"],
        message: "Maximum quantity cannot be below minimum.",
      });
    }
    if (increment <= 0n) {
      context.addIssue({
        code: "custom",
        path: ["quantityIncrement"],
        message: "Quantity increment must be positive.",
      });
    }
  });

const imageSchema: z.ZodType<PublicProductImageSnapshot> = z.object({
  stableKey: z.string().min(1).max(160),
  imageType: z.enum(["COVER", "GALLERY", "PACKAGE"]),
  assetPath: z
    .string()
    .min(1)
    .max(500)
    .regex(/^\/[a-z0-9/_-]+\.(?:png|jpe?g|webp|avif|gif)$/i)
    .refine((value) => !value.includes("..")),
  altText: z.string().min(3).max(240),
  caption: z.string().max(240).nullable(),
  sortOrder: z.number().int().min(0).max(100_000),
});

const publishedRevisionSchema: z.ZodType<PublishedProductRevisionSnapshotV1> =
  z.object({
    schemaVersion: z.literal(PRODUCT_REVISION_SCHEMA_VERSION),
    marketplace: z.object({
      id: z.string().min(1).max(30),
      stableKey: z.string().min(1).max(120),
      slug: z.string().min(1).max(180),
      serviceId: z.string().min(1).max(30),
      serviceSlug: z.string().min(1).max(180),
      categoryId: z.string().min(1).max(30),
      categorySlug: z.string().max(180).nullable(),
      publicName: z.string().min(1).max(160),
      currencyCode: z.string().length(3),
    }),
    product: z.object({
      id: z.string().min(1).max(30),
      stableKey: z.string().min(1).max(120),
      slug: z.string().min(1).max(180),
      publicTitle: z.string().min(1).max(180),
      shortDescription: z.string().min(1).max(500),
      fullDescription: z.string().min(1),
      productType: z.enum(productTypes),
      currencyCode: z.string().length(3),
      publicBadgeText: z.string().max(120).nullable(),
      isFeatured: z.boolean(),
      category: z.object({
        stableKey: z.string().min(1).max(120),
        slug: z.string().min(1).max(180),
        publicName: z.string().min(1).max(160),
        productType: z.enum(productTypes),
      }),
    }),
    revision: z.object({
      id: z.string().min(1).max(30),
      revisionNumber: z.number().int().min(1),
      publishedAt: z.iso.datetime(),
    }),
    variants: z.array(variantSchema).min(1),
    tags: z.array(
      z.object({
        stableKey: z.string().min(1).max(160),
        slug: z.string().min(1).max(180),
        publicLabel: z.string().min(1).max(160),
      }),
    ),
    images: z.array(imageSchema),
  });

const estimateSnapshotSchema: z.ZodType<ProductEstimateSnapshotV1> = z.object({
  schemaVersion: z.literal(PRODUCT_ESTIMATE_SNAPSHOT_SCHEMA_VERSION),
  marketplaceStableKey: z.string().min(1).max(120),
  productStableKey: z.string().min(1).max(120),
  productSlug: z.string().min(1).max(180),
  productPublicTitle: z.string().min(1).max(180),
  productType: z.enum(productTypes),
  variantStableKey: z.string().min(1).max(160),
  variantPublicName: z.string().min(1).max(160),
  quantity: decimalBigIntString,
  unitLabel: z.string().min(1).max(80),
  currency: z.string().length(3),
  authoritativeUnitPriceCents: z
    .number()
    .int()
    .min(0)
    .max(Number(MAX_SAFE_MONEY_CENTS))
    .nullable(),
  appliedPriceTierStableKey: z.string().max(160).nullable(),
  productSubtotalCents: z
    .number()
    .int()
    .min(0)
    .max(Number(MAX_SAFE_MONEY_CENTS))
    .nullable(),
  customerSafeGlobalPricingLines: z.array(
    z.object({
      label: z.string().min(1).max(160),
      amountCents: z
        .number()
        .int()
        .min(-Number(MAX_SAFE_MONEY_CENTS))
        .max(Number(MAX_SAFE_MONEY_CENTS)),
    }),
  ),
  finalEstimatedTotalCents: z
    .number()
    .int()
    .min(0)
    .max(Number(MAX_SAFE_MONEY_CENTS))
    .nullable(),
  estimateState: z.enum([
    "AVAILABLE",
    "LOW_STOCK",
    "OUT_OF_STOCK",
    "MANUAL_REVIEW_REQUIRED",
    "UNAVAILABLE",
  ]),
  publishedProductRevision: z.object({
    id: z.string().min(1).max(30),
    revisionNumber: z.number().int().min(1),
  }),
  publishedGlobalPricingRevision: z
    .object({
      id: z.string().min(1).max(30),
      revisionNumber: z.number().int().min(1),
    })
    .nullable(),
  customerSafeAvailability: z.object({
    state: z.enum([
      "AVAILABLE",
      "LOW_STOCK",
      "OUT_OF_STOCK",
      "MANUAL_REVIEW_REQUIRED",
      "UNAVAILABLE",
    ]),
    message: z.string().min(1).max(240),
  }),
  generatedAt: z.iso.datetime(),
  repricingRequired: z.boolean(),
  stockRecheckRequired: z.boolean(),
  reservationRequiredBeforeOrder: z.boolean(),
});

function toBigInt(value: string | number | bigint, label: string) {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value)) {
      throw new ProductMarketplaceValidationError(
        `${label} must be a safe whole number.`,
      );
    }
    return BigInt(value);
  }
  if (!/^\d+$/.test(value.trim())) {
    throw new ProductMarketplaceValidationError(
      `${label} must be a positive whole number.`,
    );
  }
  return BigInt(value.trim());
}

function assertSafeMoney(value: bigint, label: string) {
  if (value < 0n || value > MAX_SAFE_MONEY_CENTS) {
    throw new ProductMarketplaceValidationError(
      `${label} is outside the safe money range.`,
    );
  }
  return Number(value);
}

function parseQuantity(value: string | number | bigint) {
  const quantity = toBigInt(value, "Quantity");
  if (quantity <= 0n) {
    throw new ProductMarketplaceValidationError(
      "Quantity must be greater than zero.",
    );
  }
  if (quantity > MAX_PRODUCT_QUANTITY) {
    throw new ProductMarketplaceValidationError(
      "Quantity is outside the configured limit.",
    );
  }
  return quantity;
}

function assertQuantityLimits(
  variant: PublicProductVariantSnapshot,
  quantity: bigint,
) {
  const minimum = toBigInt(variant.minimumQuantity, "Minimum quantity");
  const maximum = toBigInt(variant.maximumQuantity, "Maximum quantity");
  const increment = toBigInt(variant.quantityIncrement, "Quantity increment");
  if (quantity < minimum) {
    throw new ProductMarketplaceValidationError(
      `Quantity must be at least ${minimum.toString()}.`,
    );
  }
  if (quantity > maximum) {
    throw new ProductMarketplaceValidationError(
      `Quantity must be at most ${maximum.toString()}.`,
    );
  }
  if ((quantity - minimum) % increment !== 0n) {
    throw new ProductMarketplaceValidationError(
      `Quantity must use increments of ${increment.toString()}.`,
    );
  }
}

function enabledTiers(variant: PublicProductVariantSnapshot) {
  const tiers = variant.priceTiers
    .filter((tier) => tier.enabled)
    .sort((left, right) => {
      const minimumDelta =
        toBigInt(left.minimumQuantity, "Tier minimum") -
        toBigInt(right.minimumQuantity, "Tier minimum");
      if (minimumDelta !== 0n) return minimumDelta < 0n ? -1 : 1;
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }
      return left.stableKey.localeCompare(right.stableKey);
    });

  let previousMaximum: bigint | null = null;
  for (const tier of tiers) {
    const minimum = toBigInt(tier.minimumQuantity, "Tier minimum");
    const maximum = tier.maximumQuantity
      ? toBigInt(tier.maximumQuantity, "Tier maximum")
      : null;
    if (previousMaximum !== null && minimum <= previousMaximum) {
      throw new ProductMarketplaceValidationError(
        "Published quantity tiers overlap.",
      );
    }
    previousMaximum = maximum;
  }
  return tiers;
}

function tierForQuantity(
  variant: PublicProductVariantSnapshot,
  quantity: bigint,
) {
  const matches = enabledTiers(variant).filter((tier) => {
    const minimum = toBigInt(tier.minimumQuantity, "Tier minimum");
    const maximum = tier.maximumQuantity
      ? toBigInt(tier.maximumQuantity, "Tier maximum")
      : null;
    return quantity >= minimum && (maximum === null || quantity <= maximum);
  });
  if (matches.length !== 1) {
    throw new ProductMarketplaceValidationError(
      "No deterministic quantity tier is available.",
    );
  }
  return matches[0]!;
}

function unavailable(message: string): never {
  throw new ProductMarketplaceValidationError(message);
}

function customerSafeStockMessage(
  state: ProductEstimateState,
  stockMode: ProductStockMode,
) {
  if (state === "LOW_STOCK") {
    return "Limited availability. The estimate does not reserve stock.";
  }
  if (state === "AVAILABLE") {
    return stockMode === "UNLIMITED"
      ? "Available. Availability is rechecked before any future order."
      : "Available. The estimate does not reserve stock.";
  }
  if (state === "MANUAL_REVIEW_REQUIRED") {
    return "This product requires support review before a final quote.";
  }
  if (state === "OUT_OF_STOCK") {
    return "This product is currently out of stock.";
  }
  return "This product is currently unavailable.";
}

function estimateStateForAvailability({
  availability,
  quantity,
}: {
  availability: ProductEstimateAvailabilityInput;
  quantity: bigint;
}): ProductEstimateState {
  if (
    !availability.variantEnabled ||
    availability.variantStatus !== "AVAILABLE"
  ) {
    return "UNAVAILABLE";
  }
  if (
    availability.productAvailability === "PAUSED" ||
    availability.productAvailability === "UNAVAILABLE" ||
    availability.variantAvailability === "PAUSED" ||
    availability.variantAvailability === "UNAVAILABLE"
  ) {
    return "UNAVAILABLE";
  }
  if (
    availability.productAvailability === "MANUAL_REVIEW_REQUIRED" ||
    availability.variantAvailability === "MANUAL_REVIEW_REQUIRED" ||
    availability.stockMode === "MANUAL_REVIEW"
  ) {
    return "MANUAL_REVIEW_REQUIRED";
  }
  if (
    availability.productAvailability === "OUT_OF_STOCK" ||
    availability.variantAvailability === "OUT_OF_STOCK"
  ) {
    return "OUT_OF_STOCK";
  }
  if (availability.stockMode === "UNLIMITED") {
    return availability.productAvailability === "LOW_STOCK" ||
      availability.variantAvailability === "LOW_STOCK"
      ? "LOW_STOCK"
      : "AVAILABLE";
  }
  const onHand = toBigInt(availability.onHandQuantity, "Stock balance");
  const reserved = toBigInt(
    availability.activeReservedQuantity,
    "Reserved quantity",
  );
  const lowStockThreshold = toBigInt(
    availability.lowStockThreshold,
    "Low-stock threshold",
  );
  if (onHand < 0n || reserved < 0n || lowStockThreshold < 0n) {
    return "UNAVAILABLE";
  }
  const available = onHand - reserved;
  if (available <= 0n) return "OUT_OF_STOCK";
  if (quantity > available) return "OUT_OF_STOCK";
  if (
    available <= lowStockThreshold ||
    availability.productAvailability === "LOW_STOCK" ||
    availability.variantAvailability === "LOW_STOCK"
  ) {
    return "LOW_STOCK";
  }
  return "AVAILABLE";
}

function productSubtotal({
  variant,
  quantity,
}: {
  variant: PublicProductVariantSnapshot;
  quantity: bigint;
}) {
  if (variant.priceMode === "MANUAL_REVIEW") {
    return {
      unitPriceCents: null,
      tierStableKey: null,
      subtotalCents: null,
      lineItems: [] as PricingLine[],
    };
  }

  const tier =
    variant.priceMode === "QUANTITY_TIER"
      ? tierForQuantity(variant, quantity)
      : null;
  const unitPrice =
    tier?.unitPriceCents ?? Number(variant.baseUnitPriceCents ?? 0);
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) {
    throw new ProductMarketplaceValidationError(
      "Published product price is invalid.",
    );
  }
  if (unitPrice <= 0) {
    throw new ProductMarketplaceValidationError(
      "Published product price requires review.",
    );
  }

  const subtotal = assertSafeMoney(
    quantity * BigInt(unitPrice),
    "Product subtotal",
  );
  const quantityLabel = `${quantity.toString()} ${variant.unitLabel}${
    quantity === 1n ? "" : "s"
  }`;
  return {
    unitPriceCents: unitPrice,
    tierStableKey: tier?.stableKey ?? null,
    subtotalCents: subtotal,
    lineItems: [
      {
        label:
          variant.priceMode === "FIXED_PACKAGE"
            ? `${variant.publicName} package`
            : `${variant.publicName} x ${quantityLabel}`,
        amountCents: subtotal,
      },
    ] as PricingLine[],
  };
}

function findVariant(input: ProductEstimateInput) {
  const revision = normalizePublishedProductRevision(input.revision);
  const variant =
    (input.variantStableKey
      ? revision.variants.find(
          (candidate) => candidate.stableKey === input.variantStableKey,
        )
      : null) ??
    (input.publicSku
      ? revision.variants.find(
          (candidate) => candidate.publicSku === input.publicSku,
        )
      : null) ??
    revision.variants.find((candidate) => candidate.enabled) ??
    null;
  if (!variant || !variant.enabled) {
    throw new ProductMarketplaceValidationError(
      "Choose an available product variant.",
    );
  }
  return { revision, variant };
}

function baseSnapshot({
  revision,
  variant,
  quantity,
  unitPriceCents,
  tierStableKey,
  subtotalCents,
  state,
  message,
  now,
}: {
  revision: PublishedProductRevisionSnapshotV1;
  variant: PublicProductVariantSnapshot;
  quantity: bigint;
  unitPriceCents: number | null;
  tierStableKey: string | null;
  subtotalCents: number | null;
  state: ProductEstimateState;
  message: string;
  now: Date;
}) {
  return normalizeProductEstimateSnapshot({
    schemaVersion: PRODUCT_ESTIMATE_SNAPSHOT_SCHEMA_VERSION,
    marketplaceStableKey: revision.marketplace.stableKey,
    productStableKey: revision.product.stableKey,
    productSlug: revision.product.slug,
    productPublicTitle: revision.product.publicTitle,
    productType: revision.product.productType,
    variantStableKey: variant.stableKey,
    variantPublicName: variant.publicName,
    quantity: quantity.toString(),
    unitLabel: variant.unitLabel,
    currency: revision.product.currencyCode,
    authoritativeUnitPriceCents: unitPriceCents,
    appliedPriceTierStableKey: tierStableKey,
    productSubtotalCents: subtotalCents,
    customerSafeGlobalPricingLines: [],
    finalEstimatedTotalCents: subtotalCents,
    estimateState: state,
    publishedProductRevision: {
      id: revision.revision.id,
      revisionNumber: revision.revision.revisionNumber,
    },
    publishedGlobalPricingRevision: null,
    customerSafeAvailability: {
      state,
      message,
    },
    generatedAt: now.toISOString(),
    repricingRequired: false,
    stockRecheckRequired: true,
    reservationRequiredBeforeOrder: true,
  });
}

export function calculateProductEstimate(input: ProductEstimateInput) {
  const now = input.now ?? new Date();
  const { revision, variant } = findVariant(input);
  const quantity = parseQuantity(input.quantity);
  assertQuantityLimits(variant, quantity);

  const state = estimateStateForAvailability({
    availability: input.availability,
    quantity,
  });
  if (state === "UNAVAILABLE") {
    unavailable("This product is currently unavailable.");
  }
  if (state === "OUT_OF_STOCK") {
    unavailable("This product is currently out of stock.");
  }

  const subtotal =
    state === "MANUAL_REVIEW_REQUIRED" || variant.priceMode === "MANUAL_REVIEW"
      ? {
          unitPriceCents: null,
          tierStableKey: null,
          subtotalCents: null,
          lineItems: [] as PricingLine[],
        }
      : productSubtotal({ variant, quantity });

  const finalState =
    variant.priceMode === "MANUAL_REVIEW" ? "MANUAL_REVIEW_REQUIRED" : state;
  const message = customerSafeStockMessage(
    finalState,
    input.availability.stockMode,
  );
  const snapshot = baseSnapshot({
    revision,
    variant,
    quantity,
    unitPriceCents: subtotal.unitPriceCents,
    tierStableKey: subtotal.tierStableKey,
    subtotalCents: subtotal.subtotalCents,
    state: finalState,
    message,
    now,
  });

  return {
    currency: revision.product.currencyCode,
    state: finalState,
    quantity: quantity.toString(),
    quantityLabel: `${quantity.toString()} ${variant.unitLabel}${
      quantity === 1n ? "" : "s"
    }`,
    unitLabel: variant.unitLabel,
    unitPriceCents: subtotal.unitPriceCents,
    appliedTierStableKey: subtotal.tierStableKey,
    productSubtotalCents: subtotal.subtotalCents,
    estimatedTotalCents: subtotal.subtotalCents,
    estimatedTotal:
      subtotal.subtotalCents == null
        ? null
        : formatCents(subtotal.subtotalCents, revision.product.currencyCode),
    lineItems: subtotal.lineItems,
    globalPricingLines: [],
    availabilityMessage: message,
    finalPriceNote:
      finalState === "MANUAL_REVIEW_REQUIRED"
        ? "Support must review this product before a final quote."
        : "Estimates do not reserve stock. Availability is rechecked before any future order.",
    snapshot,
  } satisfies ProductEstimateResult;
}

export function withProductGlobalPricing(
  estimate: ProductEstimateResult,
  pricing: {
    globalAdjustmentLines: PricingLine[];
    minimumMaximumAdjustmentLines: PricingLine[];
    estimatedTotalCents: number;
    estimatedTotal: string;
    pricingRevision: { id: string; revisionNumber: number } | null;
  },
) {
  if (estimate.state !== "AVAILABLE" && estimate.state !== "LOW_STOCK") {
    return estimate;
  }
  if (estimate.productSubtotalCents == null) return estimate;
  const globalLines = [
    ...pricing.globalAdjustmentLines,
    ...pricing.minimumMaximumAdjustmentLines,
  ];
  const snapshot = normalizeProductEstimateSnapshot({
    ...estimate.snapshot,
    customerSafeGlobalPricingLines: globalLines.map((line) => ({
      label: line.label,
      amountCents: line.amountCents,
    })),
    finalEstimatedTotalCents: pricing.estimatedTotalCents,
    publishedGlobalPricingRevision: pricing.pricingRevision,
  });
  return {
    ...estimate,
    lineItems: [...estimate.lineItems, ...globalLines],
    globalPricingLines: globalLines,
    estimatedTotalCents: pricing.estimatedTotalCents,
    estimatedTotal: pricing.estimatedTotal,
    snapshot,
  } satisfies ProductEstimateResult;
}

export function productRevisionSnapshot({
  marketplace,
  product,
  revisionId,
  revisionNumber,
  publishedAt,
  variants,
  tags,
  images,
}: {
  marketplace: PublishedProductRevisionSnapshotV1["marketplace"];
  product: PublishedProductRevisionSnapshotV1["product"];
  revisionId: string;
  revisionNumber: number;
  publishedAt: Date;
  variants: PublicProductVariantSnapshot[];
  tags: PublishedProductRevisionSnapshotV1["tags"];
  images: PublicProductImageSnapshot[];
}) {
  return normalizePublishedProductRevision({
    schemaVersion: PRODUCT_REVISION_SCHEMA_VERSION,
    marketplace,
    product,
    revision: {
      id: revisionId,
      revisionNumber,
      publishedAt: publishedAt.toISOString(),
    },
    variants: variants.map((variant) => ({
      ...variant,
      minimumQuantity: toBigInt(
        variant.minimumQuantity,
        "Minimum quantity",
      ).toString(),
      maximumQuantity: toBigInt(
        variant.maximumQuantity,
        "Maximum quantity",
      ).toString(),
      quantityIncrement: toBigInt(
        variant.quantityIncrement,
        "Quantity increment",
      ).toString(),
      priceTiers: variant.priceTiers.map((tier) => ({
        ...tier,
        minimumQuantity: toBigInt(
          tier.minimumQuantity,
          "Tier minimum",
        ).toString(),
        maximumQuantity: tier.maximumQuantity
          ? toBigInt(tier.maximumQuantity, "Tier maximum").toString()
          : null,
      })),
    })),
    tags,
    images,
  });
}

export function normalizePublishedProductRevision(
  value: unknown,
): PublishedProductRevisionSnapshotV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new ProductMarketplaceValidationError(
      "Product revision snapshot is malformed.",
    );
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new ProductMarketplaceValidationError(
      "Unknown product revision snapshot schema version.",
    );
  }
  const parsed = publishedRevisionSchema.safeParse(value);
  if (!parsed.success) {
    throw new ProductMarketplaceValidationError(
      "Product revision snapshot is malformed.",
    );
  }
  return parsed.data;
}

export function normalizeProductEstimateSnapshot(
  value: unknown,
): ProductEstimateSnapshotV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new ProductMarketplaceValidationError(
      "Product estimate snapshot is malformed.",
    );
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new ProductMarketplaceValidationError(
      "Unknown product estimate snapshot schema version.",
    );
  }
  const parsed = estimateSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new ProductMarketplaceValidationError(
      "Product estimate snapshot is malformed.",
    );
  }
  return parsed.data;
}

export function safeProductJson<T>(value: T) {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested,
    ),
  ) as T;
}
