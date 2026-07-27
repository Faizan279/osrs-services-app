import { z } from "zod";

import {
  GOLD_ESTIMATE_SNAPSHOT_SCHEMA_VERSION,
  GOLD_REVISION_SCHEMA_VERSION,
  goldAvailabilityStates,
  goldSecureServicePricingModes,
  goldTradeDirections,
} from "@/lib/gold/constants";
import { formatCents, type PricingLine } from "@/lib/pricing/engine";

export class GoldValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "GoldValidationError";
  }
}

export type GoldTradeDirection = (typeof goldTradeDirections)[number];
export type GoldAvailabilityState = (typeof goldAvailabilityStates)[number];
export type GoldSecureServicePricingMode =
  (typeof goldSecureServicePricingModes)[number];

export type GoldRateConfig = {
  direction: GoldTradeDirection;
  rateMinorUnitsPerMillion: number;
  minimumQuantityGp: string | bigint;
  maximumQuantityGp: string | bigint;
  automaticReviewMaximumGp: string | bigint;
  effectiveStart: string | Date;
  effectiveEnd: string | Date | null;
  enabled: boolean;
};

export type GoldMarketEstimateConfig = {
  stableKey: string;
  id: string;
  serviceId: string;
  serviceSlug: string;
  categoryId: string;
  categorySlug: string | null;
  publicName: string;
  slug: string;
  currencyCode: string;
  availabilityState: GoldAvailabilityState;
  publicTradeInstructions: string;
  rsnRequired: boolean;
  secureServiceEnabled: boolean;
  secureServicePricingMode: GoldSecureServicePricingMode;
  secureServiceFixedMinorUnits: number;
  secureServiceBps: number;
  secureServiceCustomerBuys: boolean;
  secureServiceCustomerSells: boolean;
  quoteValidityMinutes: number;
  stockQuantityGp: string | bigint;
  buyingCapacityGp: string | bigint;
};

export type PublishedGoldRateRevisionSnapshotV1 = {
  schemaVersion: typeof GOLD_REVISION_SCHEMA_VERSION;
  market: {
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
  revision: {
    id: string;
    revisionNumber: number;
    publishedAt: string;
  };
  rates: GoldRateConfig[];
};

export type GoldEstimateSnapshotV1 = {
  schemaVersion: typeof GOLD_ESTIMATE_SNAPSHOT_SCHEMA_VERSION;
  market: {
    id: string;
    stableKey: string;
    slug: string;
  };
  service: {
    id: string;
    slug: string;
    categoryId: string;
    categorySlug: string | null;
  };
  direction: GoldTradeDirection;
  currency: string;
  quantityGp: string;
  quantityLabel: string;
  rateMinorUnitsPerMillion: number;
  baseTotalMinorUnits: number;
  secureServiceAdjustment: {
    selected: boolean;
    label: string;
    amountMinorUnits: number;
  } | null;
  globalPricingAdjustmentLines: Array<{
    label: string;
    amountMinorUnits: number;
  }>;
  finalEstimatedTotalMinorUnits: number;
  publishedGoldRateRevision: {
    id: string;
    revisionNumber: number;
  };
  publishedGlobalPricingRevision: {
    id: string;
    revisionNumber: number;
  } | null;
  availabilityState: GoldAvailabilityState;
  manualReviewRequired: boolean;
  generatedAt: string;
  validUntil: string;
  repricingRequired: boolean;
};

export type GoldEstimateInput = {
  market: GoldMarketEstimateConfig;
  revision: PublishedGoldRateRevisionSnapshotV1;
  direction: GoldTradeDirection;
  quantityGp: string | bigint;
  secureServiceSelected: boolean;
  now?: Date;
};

export type GoldEstimateResult = {
  direction: GoldTradeDirection;
  currency: string;
  quantityGp: string;
  quantityLabel: string;
  rateMinorUnitsPerMillion: number;
  lineItems: PricingLine[];
  baseTotalMinorUnits: number;
  secureServiceAdjustment: {
    selected: boolean;
    label: string;
    amountMinorUnits: number;
  } | null;
  estimatedTotalMinorUnits: number;
  estimatedTotal: string;
  availabilityState: GoldAvailabilityState;
  manualReviewRequired: boolean;
  availabilityMessage: string;
  finalPriceNote: string;
  tradeInstructions: string;
  validUntil: string;
  snapshot: GoldEstimateSnapshotV1;
};

const MILLION_GP = 1_000_000n;
const HALF_MILLION_GP = 500_000n;
const MAX_ABSOLUTE_QUANTITY_GP = 10_000_000_000_000_000n;
const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);
const SUPPORTED_CURRENCY = "USD";

const decimalBigIntString = z.string().regex(/^\d+$/);

const serializedRateSchema: z.ZodType<GoldRateConfig> = z
  .object({
    direction: z.enum(goldTradeDirections),
    rateMinorUnitsPerMillion: z.number().int().min(0).max(100_000_000),
    minimumQuantityGp: z.union([decimalBigIntString, z.bigint()]),
    maximumQuantityGp: z.union([decimalBigIntString, z.bigint()]),
    automaticReviewMaximumGp: z.union([decimalBigIntString, z.bigint()]),
    effectiveStart: z.union([z.iso.datetime(), z.date()]),
    effectiveEnd: z.union([z.iso.datetime(), z.date()]).nullable(),
    enabled: z.boolean(),
  })
  .superRefine((rate, context) => {
    const minimum = toBigInt(rate.minimumQuantityGp, "Minimum quantity");
    const maximum = toBigInt(rate.maximumQuantityGp, "Maximum quantity");
    const automaticMaximum = toBigInt(
      rate.automaticReviewMaximumGp,
      "Automatic-review maximum",
    );
    if (rate.rateMinorUnitsPerMillion <= 0) {
      context.addIssue({
        code: "custom",
        path: ["rateMinorUnitsPerMillion"],
        message: "Rates must be positive minor-unit values.",
      });
    }
    if (minimum <= 0n) {
      context.addIssue({
        code: "custom",
        path: ["minimumQuantityGp"],
        message: "Minimum quantity must be positive.",
      });
    }
    if (maximum < minimum) {
      context.addIssue({
        code: "custom",
        path: ["maximumQuantityGp"],
        message: "Maximum quantity cannot be lower than minimum quantity.",
      });
    }
    if (automaticMaximum < minimum || automaticMaximum > maximum) {
      context.addIssue({
        code: "custom",
        path: ["automaticReviewMaximumGp"],
        message: "Automatic-review maximum must fit inside rate limits.",
      });
    }
    const starts = dateFrom(rate.effectiveStart);
    const ends = rate.effectiveEnd ? dateFrom(rate.effectiveEnd) : null;
    if (ends && ends <= starts) {
      context.addIssue({
        code: "custom",
        path: ["effectiveEnd"],
        message: "Effective end must be later than effective start.",
      });
    }
  });

const publishedGoldRevisionSchema: z.ZodType<PublishedGoldRateRevisionSnapshotV1> =
  z.object({
    schemaVersion: z.literal(GOLD_REVISION_SCHEMA_VERSION),
    market: z.object({
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
    revision: z.object({
      id: z.string().min(1).max(30),
      revisionNumber: z.number().int().min(1),
      publishedAt: z.iso.datetime(),
    }),
    rates: z.array(serializedRateSchema).min(1),
  });

const snapshotSchema: z.ZodType<GoldEstimateSnapshotV1> = z.object({
  schemaVersion: z.literal(GOLD_ESTIMATE_SNAPSHOT_SCHEMA_VERSION),
  market: z.object({
    id: z.string().min(1).max(30),
    stableKey: z.string().min(1).max(120),
    slug: z.string().min(1).max(180),
  }),
  service: z.object({
    id: z.string().min(1).max(30),
    slug: z.string().min(1).max(180),
    categoryId: z.string().min(1).max(30),
    categorySlug: z.string().max(180).nullable(),
  }),
  direction: z.enum(goldTradeDirections),
  currency: z.string().length(3),
  quantityGp: decimalBigIntString,
  quantityLabel: z.string().min(1).max(80),
  rateMinorUnitsPerMillion: z.number().int().min(0).max(100_000_000),
  baseTotalMinorUnits: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  secureServiceAdjustment: z
    .object({
      selected: z.boolean(),
      label: z.string().min(1).max(120),
      amountMinorUnits: z
        .number()
        .int()
        .min(-Number.MAX_SAFE_INTEGER)
        .max(Number.MAX_SAFE_INTEGER),
    })
    .nullable(),
  globalPricingAdjustmentLines: z.array(
    z.object({
      label: z.string().min(1).max(160),
      amountMinorUnits: z
        .number()
        .int()
        .min(-Number.MAX_SAFE_INTEGER)
        .max(Number.MAX_SAFE_INTEGER),
    }),
  ),
  finalEstimatedTotalMinorUnits: z
    .number()
    .int()
    .min(0)
    .max(Number.MAX_SAFE_INTEGER),
  publishedGoldRateRevision: z.object({
    id: z.string().min(1).max(30),
    revisionNumber: z.number().int().min(1),
  }),
  publishedGlobalPricingRevision: z
    .object({
      id: z.string().min(1).max(30),
      revisionNumber: z.number().int().min(1),
    })
    .nullable(),
  availabilityState: z.enum(goldAvailabilityStates),
  manualReviewRequired: z.boolean(),
  generatedAt: z.iso.datetime(),
  validUntil: z.iso.datetime(),
  repricingRequired: z.boolean(),
});

function toBigInt(value: string | bigint, label: string) {
  if (typeof value === "bigint") return value;
  if (!/^\d+$/.test(value)) {
    throw new GoldValidationError(`${label} must be a whole-GP value.`);
  }
  return BigInt(value);
}

function dateFrom(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new GoldValidationError("Effective date is invalid.");
  }
  return date;
}

function assertSafeMinorUnits(value: bigint, label: string) {
  if (value < 0n || value > MAX_SAFE_MINOR_UNITS) {
    throw new GoldValidationError(`${label} is outside the safe money range.`);
  }
  return Number(value);
}

export function formatGoldQuantity(quantityGp: string | bigint) {
  const value = toBigInt(quantityGp, "Quantity");
  const wholeMillions = value / MILLION_GP;
  const remainder = value % MILLION_GP;
  if (remainder === 0n) return `${wholeMillions.toLocaleString()}M GP`;
  const fractional = remainder.toString().padStart(6, "0").replace(/0+$/, "");
  return `${wholeMillions.toLocaleString()}.${fractional}M GP`;
}

export function parseGoldQuantity(
  input: string,
  hardMaximumGp: string | bigint = MAX_ABSOLUTE_QUANTITY_GP,
) {
  const maximum = toBigInt(hardMaximumGp, "Maximum quantity");
  const normalized = input
    .trim()
    .toLowerCase()
    .replace(/[,_\s]/g, "");
  if (!normalized) throw new GoldValidationError("Enter a gold quantity.");
  if (normalized.startsWith("-")) {
    throw new GoldValidationError("Gold quantity cannot be negative.");
  }
  if (normalized.startsWith("+")) {
    throw new GoldValidationError("Gold quantity is malformed.");
  }

  const match = normalized.match(
    /^(\d+)(?:\.(\d+))?(m|mil|million|millions|gp)?$/,
  );
  if (!match) {
    throw new GoldValidationError("Gold quantity is malformed.");
  }
  const [, whole = "", fraction = "", suffix = ""] = match;
  if (fraction.length > 6) {
    throw new GoldValidationError(
      "Gold quantity supports up to six decimal places in millions.",
    );
  }

  const scale = suffix === "gp" ? 1n : MILLION_GP;
  const quantity =
    BigInt(whole) * scale +
    (fraction ? (BigInt(fraction.padEnd(6, "0")) * scale) / MILLION_GP : 0n);
  if (suffix === "gp" && fraction) {
    throw new GoldValidationError("Whole GP quantities cannot be fractional.");
  }
  if (quantity <= 0n) {
    throw new GoldValidationError("Gold quantity must be greater than zero.");
  }
  if (quantity > maximum || quantity > MAX_ABSOLUTE_QUANTITY_GP) {
    throw new GoldValidationError(
      "Gold quantity is outside the configured limit.",
    );
  }
  return quantity;
}

export function calculateRateMinorUnits({
  rateMinorUnitsPerMillion,
  quantityGp,
}: {
  rateMinorUnitsPerMillion: number;
  quantityGp: string | bigint;
}) {
  if (
    !Number.isSafeInteger(rateMinorUnitsPerMillion) ||
    rateMinorUnitsPerMillion <= 0
  ) {
    throw new GoldValidationError("Gold rate must be a positive safe integer.");
  }
  const quantity = toBigInt(quantityGp, "Quantity");
  if (quantity <= 0n) {
    throw new GoldValidationError("Gold quantity must be greater than zero.");
  }
  const total =
    (BigInt(rateMinorUnitsPerMillion) * quantity + HALF_MILLION_GP) /
    MILLION_GP;
  return assertSafeMinorUnits(total, "Gold estimate");
}

function rateEffective(rate: GoldRateConfig, now: Date) {
  const starts = dateFrom(rate.effectiveStart);
  const ends = rate.effectiveEnd ? dateFrom(rate.effectiveEnd) : null;
  return starts <= now && (!ends || ends > now);
}

function rateForDirection(
  revision: PublishedGoldRateRevisionSnapshotV1,
  direction: GoldTradeDirection,
  now: Date,
) {
  const rate = revision.rates.find((item) => item.direction === direction);
  if (!rate) throw new GoldValidationError("Published gold rate is missing.");
  const parsed = serializedRateSchema.parse(rate);
  if (!parsed.enabled) {
    throw new GoldValidationError("This gold direction is not available.");
  }
  if (!rateEffective(parsed, now)) {
    throw new GoldValidationError("The published gold rate is not active.");
  }
  return parsed;
}

function secureServiceApplies(
  market: GoldMarketEstimateConfig,
  direction: GoldTradeDirection,
) {
  return (
    market.secureServiceEnabled &&
    market.secureServicePricingMode !== "DISABLED" &&
    ((direction === "CUSTOMER_BUYS_GOLD" && market.secureServiceCustomerBuys) ||
      (direction === "CUSTOMER_SELLS_GOLD" &&
        market.secureServiceCustomerSells))
  );
}

function calculateSecureServiceAdjustment({
  market,
  direction,
  baseTotal,
  selected,
}: {
  market: GoldMarketEstimateConfig;
  direction: GoldTradeDirection;
  baseTotal: number;
  selected: boolean;
}) {
  if (!selected) return null;
  if (!secureServiceApplies(market, direction)) {
    throw new GoldValidationError(
      "Secure 100+ Combat Service is not available for this direction.",
    );
  }
  let amount = 0;
  if (market.secureServicePricingMode === "FIXED_MINOR_UNITS") {
    amount = market.secureServiceFixedMinorUnits;
  } else if (market.secureServicePricingMode === "BASIS_POINTS") {
    amount = Number(
      (BigInt(baseTotal) * BigInt(market.secureServiceBps) + 5_000n) / 10_000n,
    );
  }
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new GoldValidationError(
      "Secure-service adjustment is outside the safe money range.",
    );
  }
  return {
    selected: true,
    label: "Secure 100+ Combat Service",
    amountMinorUnits: direction === "CUSTOMER_SELLS_GOLD" ? -amount : amount,
  };
}

function marketAvailableState(state: GoldAvailabilityState) {
  if (state === "PAUSED" || state === "UNAVAILABLE") {
    throw new GoldValidationError("Gold trading is currently unavailable.");
  }
}

function availabilityForQuantity({
  market,
  direction,
  quantity,
  manualReviewRequired,
}: {
  market: GoldMarketEstimateConfig;
  direction: GoldTradeDirection;
  quantity: bigint;
  manualReviewRequired: boolean;
}): {
  state: GoldAvailabilityState;
  message: string;
} {
  const balance =
    direction === "CUSTOMER_BUYS_GOLD"
      ? toBigInt(market.stockQuantityGp, "Gold stock")
      : toBigInt(market.buyingCapacityGp, "Buying capacity");
  if (quantity > balance) {
    return {
      state: "UNAVAILABLE",
      message:
        direction === "CUSTOMER_BUYS_GOLD"
          ? "This amount is above current public stock availability."
          : "This amount is above current buying capacity.",
    };
  }
  if (market.availabilityState === "MANUAL_REVIEW_REQUIRED") {
    return {
      state: "MANUAL_REVIEW_REQUIRED",
      message: "This market is accepting manual-review estimates only.",
    };
  }
  if (manualReviewRequired) {
    return {
      state: "MANUAL_REVIEW_REQUIRED",
      message: "This amount needs manual review before a final quote.",
    };
  }
  if (market.availabilityState === "LIMITED_AVAILABILITY") {
    return {
      state: "LIMITED_AVAILABILITY",
      message: "Limited availability. The estimate does not reserve stock.",
    };
  }
  return {
    state: "AVAILABLE",
    message: "Available. The estimate does not reserve inventory.",
  };
}

function baseLineLabel(direction: GoldTradeDirection) {
  return direction === "CUSTOMER_BUYS_GOLD"
    ? "Gold sale subtotal"
    : "Gold purchase payout";
}

export function calculateGoldEstimate(input: GoldEstimateInput) {
  const now = input.now ?? new Date();
  const revision = normalizePublishedGoldRateRevision(input.revision);
  const market = input.market;
  if (market.currencyCode !== SUPPORTED_CURRENCY) {
    throw new GoldValidationError("Unsupported gold market currency.");
  }
  if (revision.market.id !== market.id) {
    throw new GoldValidationError(
      "Published gold revision does not match market.",
    );
  }
  marketAvailableState(market.availabilityState);

  const quantity = toBigInt(input.quantityGp, "Quantity");
  const rate = rateForDirection(revision, input.direction, now);
  const minimum = toBigInt(rate.minimumQuantityGp, "Minimum quantity");
  const maximum = toBigInt(rate.maximumQuantityGp, "Maximum quantity");
  const automaticMaximum = toBigInt(
    rate.automaticReviewMaximumGp,
    "Automatic-review maximum",
  );
  if (quantity < minimum) {
    throw new GoldValidationError(
      `Gold quantity must be at least ${formatGoldQuantity(minimum)}.`,
    );
  }
  if (quantity > maximum) {
    throw new GoldValidationError(
      `Gold quantity must be at most ${formatGoldQuantity(maximum)}.`,
    );
  }

  const baseTotal = calculateRateMinorUnits({
    rateMinorUnitsPerMillion: rate.rateMinorUnitsPerMillion,
    quantityGp: quantity,
  });
  const secureAdjustment = calculateSecureServiceAdjustment({
    market,
    direction: input.direction,
    baseTotal,
    selected: input.secureServiceSelected,
  });
  const estimatedTotal = baseTotal + (secureAdjustment?.amountMinorUnits ?? 0);
  if (estimatedTotal < 0) {
    throw new GoldValidationError(
      "Secure-service adjustment cannot exceed the customer payout.",
    );
  }

  const manualReviewRequired = quantity > automaticMaximum;
  const availability = availabilityForQuantity({
    market,
    direction: input.direction,
    quantity,
    manualReviewRequired,
  });
  const generatedAt = now.toISOString();
  const validUntil = new Date(
    now.getTime() + market.quoteValidityMinutes * 60_000,
  ).toISOString();
  const lineItems: PricingLine[] = [
    { label: baseLineLabel(input.direction), amountCents: baseTotal },
  ];
  if (secureAdjustment) {
    lineItems.push({
      label: secureAdjustment.label,
      amountCents: secureAdjustment.amountMinorUnits,
    });
  }

  const snapshot = normalizeGoldEstimateSnapshot({
    schemaVersion: GOLD_ESTIMATE_SNAPSHOT_SCHEMA_VERSION,
    market: {
      id: market.id,
      stableKey: market.stableKey,
      slug: market.slug,
    },
    service: {
      id: market.serviceId,
      slug: market.serviceSlug,
      categoryId: market.categoryId,
      categorySlug: market.categorySlug,
    },
    direction: input.direction,
    currency: market.currencyCode,
    quantityGp: quantity.toString(),
    quantityLabel: formatGoldQuantity(quantity),
    rateMinorUnitsPerMillion: rate.rateMinorUnitsPerMillion,
    baseTotalMinorUnits: baseTotal,
    secureServiceAdjustment: secureAdjustment,
    globalPricingAdjustmentLines: [],
    finalEstimatedTotalMinorUnits: estimatedTotal,
    publishedGoldRateRevision: {
      id: revision.revision.id,
      revisionNumber: revision.revision.revisionNumber,
    },
    publishedGlobalPricingRevision: null,
    availabilityState: availability.state,
    manualReviewRequired,
    generatedAt,
    validUntil,
    repricingRequired: false,
  });

  return {
    direction: input.direction,
    currency: market.currencyCode,
    quantityGp: quantity.toString(),
    quantityLabel: snapshot.quantityLabel,
    rateMinorUnitsPerMillion: rate.rateMinorUnitsPerMillion,
    lineItems,
    baseTotalMinorUnits: baseTotal,
    secureServiceAdjustment: secureAdjustment,
    estimatedTotalMinorUnits: estimatedTotal,
    estimatedTotal: formatCents(estimatedTotal, market.currencyCode),
    availabilityState: availability.state,
    manualReviewRequired,
    availabilityMessage: availability.message,
    finalPriceNote:
      "Final price and trade availability are confirmed before checkout.",
    tradeInstructions: market.publicTradeInstructions,
    validUntil,
    snapshot,
  } satisfies GoldEstimateResult;
}

export function withGoldGlobalPricing(
  estimate: GoldEstimateResult,
  pricing: {
    globalAdjustmentLines: PricingLine[];
    minimumMaximumAdjustmentLines: PricingLine[];
    estimatedTotalCents: number;
    estimatedTotal: string;
    pricingRevision: { id: string; revisionNumber: number } | null;
  },
) {
  const globalLines = [
    ...pricing.globalAdjustmentLines,
    ...pricing.minimumMaximumAdjustmentLines,
  ].map((line) => ({
    label: line.label,
    amountMinorUnits: line.amountCents,
  }));
  const snapshot = normalizeGoldEstimateSnapshot({
    ...estimate.snapshot,
    globalPricingAdjustmentLines: globalLines,
    finalEstimatedTotalMinorUnits: pricing.estimatedTotalCents,
    publishedGlobalPricingRevision: pricing.pricingRevision,
  });
  return {
    ...estimate,
    lineItems: [
      ...estimate.lineItems,
      ...pricing.globalAdjustmentLines,
      ...pricing.minimumMaximumAdjustmentLines,
    ],
    estimatedTotalMinorUnits: pricing.estimatedTotalCents,
    estimatedTotal: pricing.estimatedTotal,
    snapshot,
  } satisfies GoldEstimateResult;
}

export function goldRateRevisionSnapshot({
  market,
  revisionId,
  revisionNumber,
  publishedAt,
  rates,
}: {
  market: GoldMarketEstimateConfig;
  revisionId: string;
  revisionNumber: number;
  publishedAt: Date;
  rates: GoldRateConfig[];
}) {
  return normalizePublishedGoldRateRevision({
    schemaVersion: GOLD_REVISION_SCHEMA_VERSION,
    market: {
      id: market.id,
      stableKey: market.stableKey,
      slug: market.slug,
      serviceId: market.serviceId,
      serviceSlug: market.serviceSlug,
      categoryId: market.categoryId,
      categorySlug: market.categorySlug,
      publicName: market.publicName,
      currencyCode: market.currencyCode,
    },
    revision: {
      id: revisionId,
      revisionNumber,
      publishedAt: publishedAt.toISOString(),
    },
    rates: rates.map((rate) => ({
      ...rate,
      minimumQuantityGp: toBigInt(
        rate.minimumQuantityGp,
        "Minimum quantity",
      ).toString(),
      maximumQuantityGp: toBigInt(
        rate.maximumQuantityGp,
        "Maximum quantity",
      ).toString(),
      automaticReviewMaximumGp: toBigInt(
        rate.automaticReviewMaximumGp,
        "Automatic-review maximum",
      ).toString(),
      effectiveStart: dateFrom(rate.effectiveStart).toISOString(),
      effectiveEnd: rate.effectiveEnd
        ? dateFrom(rate.effectiveEnd).toISOString()
        : null,
    })),
  });
}

export function normalizePublishedGoldRateRevision(
  value: unknown,
): PublishedGoldRateRevisionSnapshotV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new GoldValidationError("Gold rate revision snapshot is malformed.");
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new GoldValidationError(
      "Unknown gold rate revision snapshot schema version.",
    );
  }
  const parsed = publishedGoldRevisionSchema.safeParse(value);
  if (!parsed.success) {
    throw new GoldValidationError("Gold rate revision snapshot is malformed.");
  }
  return parsed.data;
}

export function normalizeGoldEstimateSnapshot(
  value: unknown,
): GoldEstimateSnapshotV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new GoldValidationError("Gold estimate snapshot is malformed.");
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new GoldValidationError(
      "Unknown gold estimate snapshot schema version.",
    );
  }
  const parsed = snapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new GoldValidationError("Gold estimate snapshot is malformed.");
  }
  return parsed.data;
}

export function safeGoldJson<T>(value: T) {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested,
    ),
  ) as T;
}
