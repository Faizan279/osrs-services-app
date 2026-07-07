import { z } from "zod";

import {
  catalogueAvailabilityStates,
  catalogueComparisonOperators,
  catalogueEngineTypes,
  catalogueGameModes,
  catalogueRequirementTypes,
  requirementVerificationModes,
} from "@/lib/catalogue/constants";
import { isAllowedMetricKey } from "@/lib/eligibility/metrics";

const reservedOfferingSlugs = new Set([
  "new",
  "edit",
  "admin",
  "api",
  "requirements",
]);

export function normalizeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

export function isSafeMediaReference(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const optionalTrimmedString = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value, context) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      context.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  });

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform(normalizeSlug)
    .pipe(z.string().min(2)),
  shortDescription: z.string().trim().min(10).max(500),
  description: optionalTrimmedString(10_000),
  iconKey: optionalTrimmedString(80),
  imagePath: optionalTrimmedString(500).refine(
    (value) => !value || isSafeMediaReference(value),
    "Use an internal path or an approved HTTP(S) URL.",
  ),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  isActive: z.boolean(),
  seoTitle: optionalTrimmedString(191),
  seoDescription: optionalTrimmedString(500),
});

export const serviceInputSchema = z
  .object({
    categoryId: z.string().trim().min(1).max(30),
    name: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .min(1)
      .transform(normalizeSlug)
      .pipe(z.string().min(2)),
    canonicalSlug: z
      .string()
      .trim()
      .min(1)
      .transform(normalizeSlug)
      .pipe(z.string().min(2)),
    shortSummary: z.string().trim().min(20).max(500),
    content: z.string().trim().min(40).max(50_000),
    serviceType: z.enum(["SERVICE", "PRODUCT", "MARKETPLACE"]),
    engineType: z.enum(catalogueEngineTypes),
    availabilityState: z.enum(catalogueAvailabilityStates),
    isFeatured: z.boolean(),
    isQuoteOnly: z.boolean(),
    displayOrder: z.coerce.number().int().min(0).max(100_000),
    gameModes: z.array(z.enum(catalogueGameModes)).min(1),
    internalNotes: optionalTrimmedString(20_000),
    publicPreparationNotes: optionalTrimmedString(20_000),
    seoTitle: optionalTrimmedString(191),
    seoDescription: optionalTrimmedString(500),
    publishAt: optionalDate,
    unpublishAt: optionalDate,
    needsClientReview: z.boolean(),
    version: z.coerce.number().int().positive(),
  })
  .superRefine((value, context) => {
    if (
      value.publishAt &&
      value.unpublishAt &&
      value.publishAt >= value.unpublishAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["unpublishAt"],
        message: "Unpublish time must be after publish time.",
      });
    }
  });

const requirementFields = {
  title: z.string().trim().min(2).max(191),
  description: z.string().trim().min(10).max(10_000),
  type: z.enum(catalogueRequirementTypes),
  isRequired: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  verificationMode: z.enum(requirementVerificationModes),
  customerGuidance: optionalTrimmedString(10_000),
  metricKey: optionalTrimmedString(120),
  comparisonOperator: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.enum(catalogueComparisonOperators).optional(),
  ),
  requiredValue: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(0).max(2_147_483_647).optional(),
  ),
  recommendedServiceId: optionalTrimmedString(30),
};

function refineRequirementRule(
  value: z.infer<z.ZodObject<typeof requirementFields>>,
  context: z.RefinementCtx,
) {
  const automatic = value.verificationMode === "AUTOMATIC";
  if (automatic && !isAllowedMetricKey(value.metricKey)) {
    context.addIssue({
      code: "custom",
      path: ["metricKey"],
      message: "Choose a supported public statistic.",
    });
  }
  if (automatic && !value.comparisonOperator) {
    context.addIssue({
      code: "custom",
      path: ["comparisonOperator"],
      message: "Choose a comparison.",
    });
  }
  if (automatic && value.requiredValue == null) {
    context.addIssue({
      code: "custom",
      path: ["requiredValue"],
      message: "Enter a required value.",
    });
  }
  if (
    !automatic &&
    (value.metricKey || value.comparisonOperator || value.requiredValue != null)
  ) {
    context.addIssue({
      code: "custom",
      path: ["verificationMode"],
      message: "Only automatic requirements can use public-stat rules.",
    });
  }
}

export const requirementInputSchema = z
  .object({
    serviceId: z.string().trim().min(1).max(30),
    ...requirementFields,
  })
  .superRefine(refineRequirementRule);

export const offeringFacetInputSchema = z.object({
  facetKey: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(80)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  facetValue: z
    .string()
    .trim()
    .toLowerCase()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  label: z.string().trim().min(1).max(160),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
});

export const offeringInputSchema = z
  .object({
    serviceId: z.string().trim().min(1).max(30),
    slug: z
      .string()
      .trim()
      .transform(normalizeSlug)
      .pipe(
        z
          .string()
          .min(2)
          .refine(
            (value) => !reservedOfferingSlugs.has(value),
            "This slug is reserved.",
          ),
      ),
    name: z.string().trim().min(2).max(191),
    shortSummary: z.string().trim().min(10).max(500),
    description: optionalTrimmedString(20_000),
    displayOrder: z.coerce.number().int().min(0).max(100_000),
    isActive: z.boolean(),
    isFeatured: z.boolean(),
    needsClientReview: z.boolean(),
    groupLabel: optionalTrimmedString(120),
    tierLabel: optionalTrimmedString(120),
    quantityEnabled: z.boolean(),
    quantityUnit: optionalTrimmedString(80),
    minimumQuantity: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().min(0).max(1_000_000).optional(),
    ),
    maximumQuantity: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().min(0).max(1_000_000).optional(),
    ),
    gameModes: z.array(z.enum(catalogueGameModes)),
    facets: z.array(offeringFacetInputSchema),
  })
  .superRefine((value, context) => {
    if (value.quantityEnabled && !value.quantityUnit) {
      context.addIssue({
        code: "custom",
        path: ["quantityUnit"],
        message: "Enter a quantity unit.",
      });
    }
    if (
      value.quantityEnabled &&
      value.minimumQuantity != null &&
      value.maximumQuantity != null &&
      value.maximumQuantity < value.minimumQuantity
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximumQuantity"],
        message: "Maximum quantity cannot be lower than minimum quantity.",
      });
    }
    const pairs = value.facets.map(
      (facet) => `${facet.facetKey}:${facet.facetValue}`,
    );
    if (new Set(pairs).size !== pairs.length) {
      context.addIssue({
        code: "custom",
        path: ["facets"],
        message: "Facet key and value pairs must be unique.",
      });
    }
    if (new Set(value.gameModes).size !== value.gameModes.length) {
      context.addIssue({
        code: "custom",
        path: ["gameModes"],
        message: "Game modes must be unique.",
      });
    }
  });

export const offeringRequirementInputSchema = z
  .object({
    offeringId: z.string().trim().min(1).max(30),
    serviceId: z.string().trim().min(1).max(30),
    ...requirementFields,
  })
  .superRefine(refineRequirementRule);

const optionalParentId = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.string().trim().min(1).max(30).optional(),
);

export const mediaReferenceInputSchema = z
  .object({
    categoryId: optionalParentId,
    serviceId: optionalParentId,
    assetPath: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .refine(
        isSafeMediaReference,
        "Use an internal path or an approved HTTP(S) URL.",
      ),
    altText: z.string().trim().min(3).max(300),
    caption: optionalTrimmedString(500),
    displayOrder: z.coerce.number().int().min(0).max(100_000),
    isPrimary: z.boolean(),
  })
  .superRefine((value, context) => {
    if (Boolean(value.categoryId) === Boolean(value.serviceId)) {
      context.addIssue({
        code: "custom",
        path: ["serviceId"],
        message: "A media reference must belong to exactly one parent.",
      });
    }
  });

export function nextDuplicateSlug(
  baseSlug: string,
  existingSlugs: readonly string[],
) {
  const base = `${normalizeSlug(baseSlug)}-copy`;
  const used = new Set(existingSlugs);
  if (!used.has(base)) return base;

  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
