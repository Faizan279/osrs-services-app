import { z } from "zod";

import type {
  CatalogueEngineType,
  PricingRuleType,
  PricingScope,
} from "@/generated/prisma/client";

export const PRICE_SNAPSHOT_SCHEMA_VERSION = 1;
export const PRICING_REVISION_SCHEMA_VERSION = 1;

const MAX_MONEY_CENTS = 100_000_000;
const MAX_BPS = 100_000;
const scopeSpecificity: Record<PricingScope, number> = {
  GLOBAL: 1,
  ENGINE_TYPE: 2,
  CATEGORY: 3,
  SERVICE: 4,
};
const catalogueEngineTypeSchema = z.enum([
  "CATALOGUE_CARD",
  "SKILLING_CALCULATOR",
  "BOSSING_ENGINE",
  "PREMIUM_SERVICE_CONFIGURATOR",
  "GOLD_ENGINE",
  "ACCOUNT_MARKETPLACE",
  "CUSTOM_ACCOUNT_BUILD",
  "PRODUCT_MARKETPLACE",
]) as z.ZodType<CatalogueEngineType>;

export class PricingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingValidationError";
  }
}

export type PricingLine = {
  label: string;
  amountCents: number;
  ruleId?: string;
};

export type PricingApplicabilitySnapshot = {
  scope: PricingScope;
  engineType?: CatalogueEngineType | null;
  categoryId?: string | null;
  serviceId?: string | null;
};

export type PricingRuleSnapshot = {
  id: string;
  publicLabel: string;
  enabled: boolean;
  ruleType: PricingRuleType;
  amountCents: number | null;
  valueBps: number | null;
  priority: number;
  exclusiveGroupKey: string | null;
  effectiveStart: string | null;
  effectiveEnd: string | null;
  applicability: PricingApplicabilitySnapshot[];
};

export type PublishedPricingRevisionSnapshotV1 = {
  schemaVersion: typeof PRICING_REVISION_SCHEMA_VERSION;
  ruleSetId: string;
  revisionId: string;
  revisionNumber: number;
  currencyCode: string;
  publishedAt: string;
  rules: PricingRuleSnapshot[];
};

export type PricingSource = {
  serviceId: string;
  serviceSlug: string;
  categoryId: string;
  categorySlug?: string | null;
  engineType: CatalogueEngineType;
  currency: string;
  baseSubtotalCents: number;
  basePricingLines: PricingLine[];
  selectedReferences: Record<string, string | number | boolean | null>;
  engineConfigurationRevision?: {
    id: string | null;
    version: number | null;
  };
};

export type PriceSnapshotV1 = {
  schemaVersion: typeof PRICE_SNAPSHOT_SCHEMA_VERSION;
  pricingRevision: {
    id: string;
    revisionNumber: number;
  };
  engineConfigurationRevision: {
    id: string | null;
    version: number | null;
  };
  service: {
    id: string;
    slug: string;
    categoryId: string;
    categorySlug: string | null;
    engineType: CatalogueEngineType;
  };
  currency: string;
  basePricingLines: PricingLine[];
  globalAdjustmentLines: PricingLine[];
  minimumMaximumAdjustmentLines: PricingLine[];
  finalEstimatedTotalCents: number;
  selectedReferences: Record<string, string | number | boolean | null>;
  generatedAt: string;
  repricingRequired: boolean;
};

export type AppliedPricingResult = {
  lineItems: PricingLine[];
  basePricingLines: PricingLine[];
  globalAdjustmentLines: PricingLine[];
  minimumMaximumAdjustmentLines: PricingLine[];
  estimatedTotalCents: number;
  estimatedTotal: string;
  pricingRevision: {
    id: string;
    revisionNumber: number;
  } | null;
  priceSnapshot: PriceSnapshotV1 | null;
};

type MatchedRule = {
  rule: PricingRuleSnapshot;
  specificity: number;
};

const pricingLineSchema = z.object({
  label: z.string().min(1).max(160),
  amountCents: z.number().int().min(-MAX_MONEY_CENTS).max(MAX_MONEY_CENTS),
  ruleId: z.string().max(30).optional(),
});

const priceSnapshotV1Schema: z.ZodType<PriceSnapshotV1> = z.object({
  schemaVersion: z.literal(PRICE_SNAPSHOT_SCHEMA_VERSION),
  pricingRevision: z.object({
    id: z.string().min(1).max(30),
    revisionNumber: z.number().int().min(1),
  }),
  engineConfigurationRevision: z.object({
    id: z.string().max(120).nullable(),
    version: z.number().int().min(0).nullable(),
  }),
  service: z.object({
    id: z.string().min(1).max(30),
    slug: z.string().min(1).max(180),
    categoryId: z.string().min(1).max(30),
    categorySlug: z.string().max(180).nullable(),
    engineType: catalogueEngineTypeSchema,
  }),
  currency: z.string().length(3),
  basePricingLines: z.array(pricingLineSchema),
  globalAdjustmentLines: z.array(pricingLineSchema),
  minimumMaximumAdjustmentLines: z.array(pricingLineSchema),
  finalEstimatedTotalCents: z.number().int().min(0).max(MAX_MONEY_CENTS),
  selectedReferences: z.record(
    z.string(),
    z.union([z.string(), z.number(), z.boolean(), z.null()]),
  ),
  generatedAt: z.iso.datetime(),
  repricingRequired: z.boolean(),
});

const applicabilitySchema: z.ZodType<PricingApplicabilitySnapshot> = z.object({
  scope: z.enum(["GLOBAL", "ENGINE_TYPE", "CATEGORY", "SERVICE"]),
  engineType: catalogueEngineTypeSchema.nullable().optional(),
  categoryId: z.string().max(30).nullable().optional(),
  serviceId: z.string().max(30).nullable().optional(),
});

const ruleSnapshotSchema: z.ZodType<PricingRuleSnapshot> = z
  .object({
    id: z.string().min(1).max(30),
    publicLabel: z.string().min(1).max(160),
    enabled: z.boolean(),
    ruleType: z.enum([
      "FIXED_ADDITION",
      "PERCENTAGE_ADDITION",
      "MINIMUM_TOTAL",
      "MAXIMUM_TOTAL",
    ]),
    amountCents: z.number().int().min(0).max(MAX_MONEY_CENTS).nullable(),
    valueBps: z.number().int().min(0).max(MAX_BPS).nullable(),
    priority: z.number().int().min(-100_000).max(100_000),
    exclusiveGroupKey: z.string().max(120).nullable(),
    effectiveStart: z.iso.datetime().nullable(),
    effectiveEnd: z.iso.datetime().nullable(),
    applicability: z.array(applicabilitySchema).min(1),
  })
  .superRefine((rule, context) => {
    if (
      ["FIXED_ADDITION", "MINIMUM_TOTAL", "MAXIMUM_TOTAL"].includes(
        rule.ruleType,
      ) &&
      rule.amountCents == null
    ) {
      context.addIssue({
        code: "custom",
        path: ["amountCents"],
        message: "This pricing rule requires an amount in cents.",
      });
    }
    if (rule.ruleType === "PERCENTAGE_ADDITION" && rule.valueBps == null) {
      context.addIssue({
        code: "custom",
        path: ["valueBps"],
        message: "Percentage pricing rules require basis points.",
      });
    }
    if (
      rule.effectiveStart &&
      rule.effectiveEnd &&
      new Date(rule.effectiveEnd) <= new Date(rule.effectiveStart)
    ) {
      context.addIssue({
        code: "custom",
        path: ["effectiveEnd"],
        message: "Effective end must be later than effective start.",
      });
    }
  });

const publishedRevisionSchema: z.ZodType<PublishedPricingRevisionSnapshotV1> =
  z.object({
    schemaVersion: z.literal(PRICING_REVISION_SCHEMA_VERSION),
    ruleSetId: z.string().min(1).max(30),
    revisionId: z.string().min(1).max(30),
    revisionNumber: z.number().int().min(1),
    currencyCode: z.string().length(3),
    publishedAt: z.iso.datetime(),
    rules: z.array(ruleSnapshotSchema),
  });

export function formatCents(amountCents: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amountCents / 100);
}

export function assertMoneyCents(value: number, label = "Amount") {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_MONEY_CENTS) {
    throw new PricingValidationError(
      `${label} must be a safe whole-cent value.`,
    );
  }
}

export function assertBasisPoints(value: number, label = "Percentage") {
  if (!Number.isInteger(value) || value < 0 || value > MAX_BPS) {
    throw new PricingValidationError(`${label} must be valid basis points.`);
  }
}

export function applyBasisPoints(amountCents: number, bps: number) {
  assertMoneyCents(amountCents, "Subtotal");
  assertBasisPoints(bps);
  const rounded = (BigInt(amountCents) * BigInt(bps) + 5_000n) / 10_000n;
  const value = Number(rounded);
  assertMoneyCents(value, "Percentage adjustment");
  return value;
}

function checkedSubtotal(value: number) {
  assertMoneyCents(value, "Subtotal");
  return value;
}

function checkedAdd(left: number, right: number) {
  return checkedSubtotal(left + right);
}

function checkedAdjustment(value: number, label: string) {
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_MONEY_CENTS) {
    throw new PricingValidationError(
      `${label} is outside the safe money range.`,
    );
  }
  return value;
}

function effective(rule: PricingRuleSnapshot, now: Date) {
  const startsAt = rule.effectiveStart ? new Date(rule.effectiveStart) : null;
  const endsAt = rule.effectiveEnd ? new Date(rule.effectiveEnd) : null;
  return (!startsAt || startsAt <= now) && (!endsAt || endsAt > now);
}

function applicabilitySpecificity(
  applicability: PricingApplicabilitySnapshot,
  source: PricingSource,
) {
  if (applicability.scope === "GLOBAL") return scopeSpecificity.GLOBAL;
  if (
    applicability.scope === "ENGINE_TYPE" &&
    applicability.engineType === source.engineType
  ) {
    return scopeSpecificity.ENGINE_TYPE;
  }
  if (
    applicability.scope === "CATEGORY" &&
    applicability.categoryId === source.categoryId
  ) {
    return scopeSpecificity.CATEGORY;
  }
  if (
    applicability.scope === "SERVICE" &&
    applicability.serviceId === source.serviceId
  ) {
    return scopeSpecificity.SERVICE;
  }
  return 0;
}

function matchingSpecificity(rule: PricingRuleSnapshot, source: PricingSource) {
  return Math.max(
    0,
    ...rule.applicability.map((item) => applicabilitySpecificity(item, source)),
  );
}

function sortMatchedRules(left: MatchedRule, right: MatchedRule) {
  if (left.rule.priority !== right.rule.priority) {
    return left.rule.priority - right.rule.priority;
  }
  if (left.specificity !== right.specificity) {
    return right.specificity - left.specificity;
  }
  return left.rule.id.localeCompare(right.rule.id);
}

export function selectApplicableRules({
  source,
  rules,
  now = new Date(),
}: {
  source: PricingSource;
  rules: PricingRuleSnapshot[];
  now?: Date;
}) {
  const candidates = rules
    .filter((rule) => rule.enabled && effective(rule, now))
    .map((rule) => ({ rule, specificity: matchingSpecificity(rule, source) }))
    .filter((rule) => rule.specificity > 0)
    .sort(sortMatchedRules);

  const selected: MatchedRule[] = [];
  const exclusiveGroups = new Map<string, MatchedRule[]>();
  for (const candidate of candidates) {
    const groupKey = candidate.rule.exclusiveGroupKey?.trim();
    if (!groupKey) {
      selected.push(candidate);
      continue;
    }
    const group = exclusiveGroups.get(groupKey) ?? [];
    group.push(candidate);
    exclusiveGroups.set(groupKey, group);
  }

  for (const group of exclusiveGroups.values()) {
    selected.push([...group].sort(sortMatchedRules)[0]!);
  }
  return selected.sort(sortMatchedRules);
}

function ruleAmount(rule: PricingRuleSnapshot) {
  if (rule.amountCents == null) {
    throw new PricingValidationError("Pricing rule amount is missing.");
  }
  assertMoneyCents(rule.amountCents, "Pricing rule amount");
  return rule.amountCents;
}

function ruleBps(rule: PricingRuleSnapshot) {
  if (rule.valueBps == null) {
    throw new PricingValidationError(
      "Pricing rule basis-point value is missing.",
    );
  }
  assertBasisPoints(rule.valueBps, "Pricing rule percentage");
  return rule.valueBps;
}

function applyRuleType(
  ruleType: PricingRuleType,
  rules: MatchedRule[],
  subtotal: number,
  lines: PricingLine[],
) {
  for (const { rule } of rules.filter(
    (item) => item.rule.ruleType === ruleType,
  )) {
    if (ruleType === "FIXED_ADDITION") {
      const amountCents = ruleAmount(rule);
      if (amountCents > 0) {
        subtotal = checkedAdd(subtotal, amountCents);
        lines.push({
          label: rule.publicLabel,
          amountCents,
          ruleId: rule.id,
        });
      }
      continue;
    }
    if (ruleType === "PERCENTAGE_ADDITION") {
      const amountCents = applyBasisPoints(subtotal, ruleBps(rule));
      if (amountCents > 0) {
        subtotal = checkedAdd(subtotal, amountCents);
        lines.push({
          label: rule.publicLabel,
          amountCents,
          ruleId: rule.id,
        });
      }
      continue;
    }
    if (ruleType === "MINIMUM_TOTAL") {
      const minimum = ruleAmount(rule);
      if (subtotal < minimum) {
        const amountCents = checkedAdjustment(
          minimum - subtotal,
          "Minimum-total adjustment",
        );
        subtotal = minimum;
        lines.push({
          label: rule.publicLabel,
          amountCents,
          ruleId: rule.id,
        });
      }
      continue;
    }
    if (ruleType === "MAXIMUM_TOTAL") {
      const maximum = ruleAmount(rule);
      if (subtotal > maximum) {
        const amountCents = checkedAdjustment(
          maximum - subtotal,
          "Maximum-total adjustment",
        );
        subtotal = maximum;
        lines.push({
          label: rule.publicLabel,
          amountCents,
          ruleId: rule.id,
        });
      }
      continue;
    }
    throw new PricingValidationError("Unknown pricing rule type.");
  }
  return subtotal;
}

export function applyGlobalPricing({
  source,
  revision,
  now = new Date(),
}: {
  source: PricingSource;
  revision: PublishedPricingRevisionSnapshotV1;
  now?: Date;
}): AppliedPricingResult {
  assertMoneyCents(source.baseSubtotalCents, "Base subtotal");
  const parsedRevision = normalizePublishedPricingRevision(revision);
  if (source.currency !== parsedRevision.currencyCode) {
    throw new PricingValidationError("Pricing currency does not match source.");
  }

  const applicableRules = selectApplicableRules({
    source,
    rules: parsedRevision.rules,
    now,
  });
  const globalAdjustmentLines: PricingLine[] = [];
  const minimumMaximumAdjustmentLines: PricingLine[] = [];
  let subtotal = source.baseSubtotalCents;

  subtotal = applyRuleType(
    "FIXED_ADDITION",
    applicableRules,
    subtotal,
    globalAdjustmentLines,
  );
  subtotal = applyRuleType(
    "PERCENTAGE_ADDITION",
    applicableRules,
    subtotal,
    globalAdjustmentLines,
  );
  subtotal = applyRuleType(
    "MINIMUM_TOTAL",
    applicableRules,
    subtotal,
    minimumMaximumAdjustmentLines,
  );
  subtotal = applyRuleType(
    "MAXIMUM_TOTAL",
    applicableRules,
    subtotal,
    minimumMaximumAdjustmentLines,
  );

  const pricingRevision = {
    id: parsedRevision.revisionId,
    revisionNumber: parsedRevision.revisionNumber,
  };
  const priceSnapshot = normalizePriceSnapshotV1({
    schemaVersion: PRICE_SNAPSHOT_SCHEMA_VERSION,
    pricingRevision,
    engineConfigurationRevision: source.engineConfigurationRevision ?? {
      id: null,
      version: null,
    },
    service: {
      id: source.serviceId,
      slug: source.serviceSlug,
      categoryId: source.categoryId,
      categorySlug: source.categorySlug ?? null,
      engineType: source.engineType,
    },
    currency: source.currency,
    basePricingLines: source.basePricingLines,
    globalAdjustmentLines,
    minimumMaximumAdjustmentLines,
    finalEstimatedTotalCents: subtotal,
    selectedReferences: source.selectedReferences,
    generatedAt: now.toISOString(),
    repricingRequired: false,
  });

  return {
    lineItems: [
      ...source.basePricingLines,
      ...globalAdjustmentLines,
      ...minimumMaximumAdjustmentLines,
    ],
    basePricingLines: source.basePricingLines,
    globalAdjustmentLines,
    minimumMaximumAdjustmentLines,
    estimatedTotalCents: subtotal,
    estimatedTotal: formatCents(subtotal, source.currency),
    pricingRevision,
    priceSnapshot,
  };
}

export function unchangedPricingResult(
  source: PricingSource,
): AppliedPricingResult {
  return {
    lineItems: source.basePricingLines,
    basePricingLines: source.basePricingLines,
    globalAdjustmentLines: [],
    minimumMaximumAdjustmentLines: [],
    estimatedTotalCents: source.baseSubtotalCents,
    estimatedTotal: formatCents(source.baseSubtotalCents, source.currency),
    pricingRevision: null,
    priceSnapshot: null,
  };
}

export function normalizePriceSnapshotV1(value: unknown): PriceSnapshotV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new PricingValidationError("Price snapshot is malformed.");
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new PricingValidationError("Unknown price snapshot schema version.");
  }
  const parsed = priceSnapshotV1Schema.safeParse(value);
  if (!parsed.success) {
    throw new PricingValidationError("Price snapshot is malformed.");
  }
  return parsed.data;
}

export function normalizePublishedPricingRevision(
  value: unknown,
): PublishedPricingRevisionSnapshotV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new PricingValidationError("Pricing revision snapshot is malformed.");
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new PricingValidationError(
      "Unknown pricing revision snapshot schema version.",
    );
  }
  const parsed = publishedRevisionSchema.safeParse(value);
  if (!parsed.success) {
    throw new PricingValidationError("Pricing revision snapshot is malformed.");
  }
  return parsed.data;
}

export function safePricingJson<T>(value: T) {
  return JSON.parse(JSON.stringify(value)) as T;
}
