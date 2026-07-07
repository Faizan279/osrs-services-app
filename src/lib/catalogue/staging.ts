import { z } from "zod";

import type {
  CatalogueAvailabilityState,
  CatalogueEngineType,
  CatalogueGameMode,
  CatalogueRequirementType,
  CatalogueService,
  CatalogueServiceType,
  RequirementVerificationMode,
} from "@/generated/prisma/client";
import {
  catalogueAvailabilityStates,
  catalogueEngineTypes,
  catalogueGameModes,
  catalogueRequirementTypes,
  requirementVerificationModes,
} from "@/lib/catalogue/constants";
import { CatalogueTransitionError } from "@/lib/catalogue/errors";
import {
  MAX_SAFE_REQUIREMENT_VALUE,
  safeRequirementNumber,
} from "@/lib/catalogue/numeric";
import { isAllowedMetricKey } from "@/lib/eligibility/metrics";

const nullableString = (maximum: number) => z.string().max(maximum).nullable();
const identifierPattern = /^[a-z0-9]+$/i;
const normalizedSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const facetKeyValuePattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const reservedOfferingSlugs = new Set([
  "new",
  "edit",
  "admin",
  "api",
  "requirements",
]);

export const stagedServiceFieldsSchema = z.object({
  categoryId: z.string().min(1).max(30),
  name: z.string().min(2).max(160),
  slug: z.string().min(2).max(180),
  canonicalSlug: z.string().min(2).max(191),
  shortSummary: z.string().min(20).max(500),
  content: z.string().min(40).max(50_000),
  serviceType: z.enum(["SERVICE", "PRODUCT", "MARKETPLACE"]),
  engineType: z.enum(catalogueEngineTypes),
  availabilityState: z.enum(catalogueAvailabilityStates),
  isFeatured: z.boolean(),
  isQuoteOnly: z.boolean(),
  displayOrder: z.number().int().min(0).max(100_000),
  internalNotes: nullableString(20_000),
  publicPreparationNotes: nullableString(20_000),
  seoTitle: nullableString(191),
  seoDescription: nullableString(500),
  publishAt: z.iso.datetime().nullable(),
  unpublishAt: z.iso.datetime().nullable(),
  needsClientReview: z.boolean(),
});

export const stagedRequirementSchema = z.object({
  id: z.string().min(1).max(30),
  title: z.string().min(2).max(191),
  description: z.string().min(10).max(10_000),
  type: z.enum(catalogueRequirementTypes),
  isRequired: z.boolean(),
  displayOrder: z.number().int().min(0).max(100_000),
  verificationMode: z.enum(requirementVerificationModes),
  customerGuidance: z.string().max(10_000).nullable(),
  metricKey: z.string().max(120).nullable(),
  comparisonOperator: z
    .enum([
      "GREATER_THAN_OR_EQUAL",
      "GREATER_THAN",
      "EQUAL",
      "LESS_THAN_OR_EQUAL",
      "LESS_THAN",
    ])
    .nullable(),
  requiredValue: z
    .number()
    .int()
    .min(0)
    .max(MAX_SAFE_REQUIREMENT_VALUE)
    .nullable(),
  recommendedServiceId: z.string().max(30).nullable(),
  seededKey: z.string().max(120).nullable(),
});

export const stagedMediaSchema = z.object({
  id: z.string().min(1).max(30),
  assetPath: z.string().min(1).max(500),
  altText: z.string().min(3).max(300),
  caption: z.string().max(500).nullable(),
  displayOrder: z.number().int().min(0).max(100_000),
  isPrimary: z.boolean(),
});

export const stagedOfferingFacetSchema = z.object({
  id: z.string().min(1).max(30),
  facetKey: z.string().min(2).max(80),
  facetValue: z.string().min(1).max(120),
  label: z.string().min(1).max(160),
  displayOrder: z.number().int().min(0).max(100_000),
});

export const stagedOfferingRequirementSchema = stagedRequirementSchema.extend({
  seededKey: z.string().max(160).nullable(),
});

export const stagedOfferingSchema = z.object({
  id: z.string().min(1).max(30),
  seededKey: z.string().max(140).nullable(),
  slug: z.string().min(2).max(180),
  name: z.string().min(2).max(191),
  shortSummary: z.string().min(10).max(500),
  description: z.string().max(20_000).nullable(),
  displayOrder: z.number().int().min(0).max(100_000),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
  needsClientReview: z.boolean(),
  groupLabel: z.string().max(120).nullable(),
  tierLabel: z.string().max(120).nullable(),
  quantityEnabled: z.boolean(),
  quantityUnit: z.string().max(80).nullable(),
  minimumQuantity: z.number().int().min(0).max(1_000_000).nullable(),
  maximumQuantity: z.number().int().min(0).max(1_000_000).nullable(),
  gameModes: z.array(z.enum(catalogueGameModes)),
  facets: z.array(stagedOfferingFacetSchema),
  requirements: z.array(stagedOfferingRequirementSchema),
});

function upgradeLegacyAggregate(value: unknown) {
  if (!value || typeof value !== "object" || !("schemaVersion" in value))
    return value;
  const legacy = value as Record<string, unknown>;
  if (legacy.schemaVersion !== 1 || !Array.isArray(legacy.requirements))
    return value;
  return {
    ...legacy,
    schemaVersion: 2,
    requirements: legacy.requirements.map((requirement) => ({
      ...(requirement as Record<string, unknown>),
      customerGuidance: null,
      metricKey: null,
      comparisonOperator: null,
      requiredValue: null,
      recommendedServiceId: null,
    })),
    offerings: [],
  };
}

function validateStagedRequirementRule(
  requirement: StagedRequirement | StagedOfferingRequirement,
  context: z.RefinementCtx,
  path: (string | number)[],
) {
  const automatic = requirement.verificationMode === "AUTOMATIC";
  if (
    requirement.recommendedServiceId &&
    !identifierPattern.test(requirement.recommendedServiceId)
  ) {
    context.addIssue({
      code: "custom",
      path: [...path, "recommendedServiceId"],
      message: "Recommended service identifier is invalid.",
    });
  }
  if (automatic && !isAllowedMetricKey(requirement.metricKey)) {
    context.addIssue({
      code: "custom",
      path: [...path, "metricKey"],
      message: "Choose a supported public statistic.",
    });
  }
  if (automatic && !requirement.comparisonOperator) {
    context.addIssue({
      code: "custom",
      path: [...path, "comparisonOperator"],
      message: "Automatic requirements need a comparison operator.",
    });
  }
  if (automatic && requirement.requiredValue == null) {
    context.addIssue({
      code: "custom",
      path: [...path, "requiredValue"],
      message: "Automatic requirements need a required value.",
    });
  }
  if (
    !automatic &&
    (requirement.metricKey ||
      requirement.comparisonOperator ||
      requirement.requiredValue != null)
  ) {
    context.addIssue({
      code: "custom",
      path: [...path, "verificationMode"],
      message: "Only automatic requirements can contain public-stat rules.",
    });
  }
}

const stagedCatalogueAggregateV2Schema = z
  .object({
    schemaVersion: z.literal(2),
    service: stagedServiceFieldsSchema,
    gameModes: z.array(z.enum(catalogueGameModes)).min(1),
    requirements: z.array(stagedRequirementSchema),
    mediaReferences: z.array(stagedMediaSchema),
    offerings: z.array(stagedOfferingSchema),
  })
  .superRefine((aggregate, context) => {
    if (new Set(aggregate.gameModes).size !== aggregate.gameModes.length) {
      context.addIssue({
        code: "custom",
        path: ["gameModes"],
        message: "Pending game modes must be unique.",
      });
    }

    const requirementIds = aggregate.requirements.map(({ id }) => id);
    if (new Set(requirementIds).size !== requirementIds.length) {
      context.addIssue({
        code: "custom",
        path: ["requirements"],
        message: "Pending requirement identifiers must be unique.",
      });
    }
    aggregate.requirements.forEach((requirement, index) =>
      validateStagedRequirementRule(requirement, context, [
        "requirements",
        index,
      ]),
    );

    const mediaIds = aggregate.mediaReferences.map(({ id }) => id);
    if (new Set(mediaIds).size !== mediaIds.length) {
      context.addIssue({
        code: "custom",
        path: ["mediaReferences"],
        message: "Pending media identifiers must be unique.",
      });
    }

    if (
      aggregate.mediaReferences.filter(({ isPrimary }) => isPrimary).length > 1
    ) {
      context.addIssue({
        code: "custom",
        path: ["mediaReferences"],
        message: "Pending service media may contain only one primary item.",
      });
    }

    const offeringIds = aggregate.offerings.map(({ id }) => id);
    const offeringSlugs = aggregate.offerings.map(({ slug }) => slug);
    if (new Set(offeringIds).size !== offeringIds.length) {
      context.addIssue({
        code: "custom",
        path: ["offerings"],
        message: "Pending offering identifiers must be unique.",
      });
    }
    if (new Set(offeringSlugs).size !== offeringSlugs.length) {
      context.addIssue({
        code: "custom",
        path: ["offerings"],
        message: "Pending offering slugs must be unique.",
      });
    }
    for (const [index, offering] of aggregate.offerings.entries()) {
      if (
        !normalizedSlugPattern.test(offering.slug) ||
        reservedOfferingSlugs.has(offering.slug)
      ) {
        context.addIssue({
          code: "custom",
          path: ["offerings", index, "slug"],
          message: "Offering slug is invalid or reserved.",
        });
      }
      if (offering.quantityEnabled && !offering.quantityUnit) {
        context.addIssue({
          code: "custom",
          path: ["offerings", index, "quantityUnit"],
          message: "Quantity-enabled offerings need a unit.",
        });
      }
      if (
        !offering.quantityEnabled &&
        (offering.minimumQuantity != null || offering.maximumQuantity != null)
      ) {
        context.addIssue({
          code: "custom",
          path: ["offerings", index, "minimumQuantity"],
          message: "Quantity limits must be empty when quantity is disabled.",
        });
      }
      if (
        offering.quantityEnabled &&
        offering.minimumQuantity != null &&
        offering.maximumQuantity != null &&
        offering.maximumQuantity < offering.minimumQuantity
      ) {
        context.addIssue({
          code: "custom",
          path: ["offerings", index, "maximumQuantity"],
          message: "Maximum quantity cannot be lower than minimum quantity.",
        });
      }
      const facetPairs = offering.facets.map(
        ({ facetKey, facetValue }) => `${facetKey}:${facetValue}`,
      );
      const facetIds = offering.facets.map(({ id }) => id);
      if (new Set(facetIds).size !== facetIds.length) {
        context.addIssue({
          code: "custom",
          path: ["offerings", index, "facets"],
          message: "Offering facet identifiers must be unique.",
        });
      }
      offering.facets.forEach((facet, facetIndex) => {
        if (
          !facetKeyValuePattern.test(facet.facetKey) ||
          !facetKeyValuePattern.test(facet.facetValue)
        ) {
          context.addIssue({
            code: "custom",
            path: ["offerings", index, "facets", facetIndex],
            message: "Offering facet keys and values must be normalized.",
          });
        }
      });
      if (new Set(facetPairs).size !== facetPairs.length) {
        context.addIssue({
          code: "custom",
          path: ["offerings", index, "facets"],
          message: "Offering facets must be unique.",
        });
      }
      if (new Set(offering.gameModes).size !== offering.gameModes.length) {
        context.addIssue({
          code: "custom",
          path: ["offerings", index, "gameModes"],
          message: "Offering game modes must be unique.",
        });
      }
      if (
        offering.gameModes.some((mode) => !aggregate.gameModes.includes(mode))
      ) {
        context.addIssue({
          code: "custom",
          path: ["offerings", index, "gameModes"],
          message:
            "Offering game modes must be supported by the parent service.",
        });
      }
      const offeringRequirementIds = offering.requirements.map(({ id }) => id);
      if (
        new Set(offeringRequirementIds).size !== offeringRequirementIds.length
      ) {
        context.addIssue({
          code: "custom",
          path: ["offerings", index, "requirements"],
          message: "Offering requirement identifiers must be unique.",
        });
      }
      offering.requirements.forEach((requirement, requirementIndex) =>
        validateStagedRequirementRule(requirement, context, [
          "offerings",
          index,
          "requirements",
          requirementIndex,
        ]),
      );
    }
  });

export const stagedCatalogueAggregateSchema = z.preprocess(
  upgradeLegacyAggregate,
  stagedCatalogueAggregateV2Schema,
);

export type StagedCatalogueAggregate = z.infer<
  typeof stagedCatalogueAggregateSchema
>;
export type StagedRequirement = z.infer<typeof stagedRequirementSchema>;
export type StagedMedia = z.infer<typeof stagedMediaSchema>;
export type StagedOffering = z.infer<typeof stagedOfferingSchema>;
export type StagedOfferingRequirement = z.infer<
  typeof stagedOfferingRequirementSchema
>;

type AggregateSource = CatalogueService & {
  gameModes: { gameMode: CatalogueGameMode }[];
  requirements: Array<{
    id: string;
    title: string;
    description: string;
    type: CatalogueRequirementType;
    isRequired: boolean;
    displayOrder: number;
    verificationMode: RequirementVerificationMode;
    customerGuidance?: string | null;
    metricKey?: string | null;
    comparisonOperator?:
      | "GREATER_THAN_OR_EQUAL"
      | "GREATER_THAN"
      | "EQUAL"
      | "LESS_THAN_OR_EQUAL"
      | "LESS_THAN"
      | null;
    requiredValue?: number | bigint | null;
    recommendedServiceId?: string | null;
    seededKey: string | null;
  }>;
  mediaReferences: Array<{
    id: string;
    assetPath: string;
    altText: string;
    caption: string | null;
    displayOrder: number;
    isPrimary: boolean;
  }>;
  offerings?: Array<{
    id: string;
    seededKey: string | null;
    slug: string;
    name: string;
    shortSummary: string;
    description: string | null;
    displayOrder: number;
    isActive: boolean;
    isFeatured: boolean;
    needsClientReview: boolean;
    groupLabel: string | null;
    tierLabel: string | null;
    quantityEnabled: boolean;
    quantityUnit: string | null;
    minimumQuantity: number | null;
    maximumQuantity: number | null;
    gameModes: Array<{ gameMode: CatalogueGameMode }>;
    facets: Array<{
      id: string;
      facetKey: string;
      facetValue: string;
      label: string;
      displayOrder: number;
    }>;
    requirements: Array<{
      id: string;
      title: string;
      description: string;
      type: CatalogueRequirementType;
      isRequired: boolean;
      displayOrder: number;
      verificationMode: RequirementVerificationMode;
      customerGuidance: string | null;
      metricKey: string | null;
      comparisonOperator:
        | "GREATER_THAN_OR_EQUAL"
        | "GREATER_THAN"
        | "EQUAL"
        | "LESS_THAN_OR_EQUAL"
        | "LESS_THAN"
        | null;
      requiredValue: number | bigint | null;
      recommendedServiceId: string | null;
      seededKey: string | null;
    }>;
  }>;
};

export type StagedServiceEdit = {
  categoryId: string;
  name: string;
  slug: string;
  canonicalSlug: string;
  shortSummary: string;
  content: string;
  serviceType: CatalogueServiceType;
  engineType: CatalogueEngineType;
  availabilityState: CatalogueAvailabilityState;
  isFeatured: boolean;
  isQuoteOnly: boolean;
  displayOrder: number;
  gameModes: CatalogueGameMode[];
  internalNotes?: string;
  publicPreparationNotes?: string;
  seoTitle?: string;
  seoDescription?: string;
  publishAt?: Date;
  unpublishAt?: Date;
  needsClientReview: boolean;
};

function dateValue(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

export function snapshotFromService(
  source: AggregateSource,
): StagedCatalogueAggregate {
  return stagedCatalogueAggregateSchema.parse({
    schemaVersion: 2,
    service: {
      categoryId: source.categoryId,
      name: source.name,
      slug: source.slug,
      canonicalSlug: source.canonicalSlug,
      shortSummary: source.shortSummary,
      content: source.content,
      serviceType: source.serviceType,
      engineType: source.engineType,
      availabilityState: source.availabilityState,
      isFeatured: source.isFeatured,
      isQuoteOnly: source.isQuoteOnly,
      displayOrder: source.displayOrder,
      internalNotes: source.internalNotes,
      publicPreparationNotes: source.publicPreparationNotes,
      seoTitle: source.seoTitle,
      seoDescription: source.seoDescription,
      publishAt: dateValue(source.publishAt),
      unpublishAt: dateValue(source.unpublishAt),
      needsClientReview: source.needsClientReview,
    },
    gameModes: source.gameModes.map(({ gameMode }) => gameMode),
    requirements: source.requirements.map((requirement) => ({
      id: requirement.id,
      title: requirement.title,
      description: requirement.description,
      type: requirement.type,
      isRequired: requirement.isRequired,
      displayOrder: requirement.displayOrder,
      verificationMode: requirement.verificationMode,
      customerGuidance: requirement.customerGuidance ?? null,
      metricKey: requirement.metricKey ?? null,
      comparisonOperator: requirement.comparisonOperator ?? null,
      requiredValue: safeRequirementNumber(requirement.requiredValue),
      recommendedServiceId: requirement.recommendedServiceId ?? null,
      seededKey: requirement.seededKey,
    })),
    mediaReferences: source.mediaReferences.map((media) => ({
      id: media.id,
      assetPath: media.assetPath,
      altText: media.altText,
      caption: media.caption,
      displayOrder: media.displayOrder,
      isPrimary: media.isPrimary,
    })),
    offerings: (source.offerings ?? []).map((offering) => ({
      id: offering.id,
      seededKey: offering.seededKey,
      slug: offering.slug,
      name: offering.name,
      shortSummary: offering.shortSummary,
      description: offering.description,
      displayOrder: offering.displayOrder,
      isActive: offering.isActive,
      isFeatured: offering.isFeatured,
      needsClientReview: offering.needsClientReview,
      groupLabel: offering.groupLabel,
      tierLabel: offering.tierLabel,
      quantityEnabled: offering.quantityEnabled,
      quantityUnit: offering.quantityUnit,
      minimumQuantity: offering.minimumQuantity,
      maximumQuantity: offering.maximumQuantity,
      gameModes: offering.gameModes.map(({ gameMode }) => gameMode),
      facets: offering.facets,
      requirements: offering.requirements,
    })),
  });
}

export function applyServiceEdit(
  aggregate: StagedCatalogueAggregate,
  input: StagedServiceEdit,
): StagedCatalogueAggregate {
  return stagedCatalogueAggregateSchema.parse({
    ...aggregate,
    service: {
      categoryId: input.categoryId,
      name: input.name,
      slug: input.slug,
      canonicalSlug: input.canonicalSlug,
      shortSummary: input.shortSummary,
      content: input.content,
      serviceType: input.serviceType,
      engineType: input.engineType,
      availabilityState: input.availabilityState,
      isFeatured: input.isFeatured,
      isQuoteOnly: input.isQuoteOnly,
      displayOrder: input.displayOrder,
      internalNotes: input.internalNotes ?? null,
      publicPreparationNotes: input.publicPreparationNotes ?? null,
      seoTitle: input.seoTitle ?? null,
      seoDescription: input.seoDescription ?? null,
      publishAt: dateValue(input.publishAt),
      unpublishAt: dateValue(input.unpublishAt),
      needsClientReview: input.needsClientReview,
    },
    gameModes: input.gameModes,
  });
}

export function addStagedRequirement(
  aggregate: StagedCatalogueAggregate,
  requirement: Omit<
    StagedRequirement,
    | "customerGuidance"
    | "metricKey"
    | "comparisonOperator"
    | "requiredValue"
    | "recommendedServiceId"
  > &
    Partial<
      Pick<
        StagedRequirement,
        | "customerGuidance"
        | "metricKey"
        | "comparisonOperator"
        | "requiredValue"
        | "recommendedServiceId"
      >
    >,
) {
  return stagedCatalogueAggregateSchema.parse({
    ...aggregate,
    requirements: [
      ...aggregate.requirements,
      {
        ...requirement,
        customerGuidance: requirement.customerGuidance ?? null,
        metricKey: requirement.metricKey ?? null,
        comparisonOperator: requirement.comparisonOperator ?? null,
        requiredValue: safeRequirementNumber(requirement.requiredValue),
        recommendedServiceId: requirement.recommendedServiceId ?? null,
      },
    ],
  });
}

export function removeStagedRequirement(
  aggregate: StagedCatalogueAggregate,
  requirementId: string,
) {
  return stagedCatalogueAggregateSchema.parse({
    ...aggregate,
    requirements: aggregate.requirements.filter(
      (requirement) => requirement.id !== requirementId,
    ),
  });
}

export function addStagedMedia(
  aggregate: StagedCatalogueAggregate,
  media: StagedMedia,
) {
  return stagedCatalogueAggregateSchema.parse({
    ...aggregate,
    mediaReferences: [
      ...aggregate.mediaReferences.map((item) => ({
        ...item,
        isPrimary: media.isPrimary ? false : item.isPrimary,
      })),
      media,
    ],
  });
}

export function removeStagedMedia(
  aggregate: StagedCatalogueAggregate,
  mediaId: string,
) {
  return stagedCatalogueAggregateSchema.parse({
    ...aggregate,
    mediaReferences: aggregate.mediaReferences.filter(
      (media) => media.id !== mediaId,
    ),
  });
}

export function upsertStagedOffering(
  aggregate: StagedCatalogueAggregate,
  offering: StagedOffering,
) {
  const existing = aggregate.offerings.some(({ id }) => id === offering.id);
  return stagedCatalogueAggregateSchema.parse({
    ...aggregate,
    offerings: existing
      ? aggregate.offerings.map((item) =>
          item.id === offering.id ? offering : item,
        )
      : [...aggregate.offerings, offering],
  });
}

export function removeStagedOffering(
  aggregate: StagedCatalogueAggregate,
  offeringId: string,
) {
  return stagedCatalogueAggregateSchema.parse({
    ...aggregate,
    offerings: aggregate.offerings.filter(({ id }) => id !== offeringId),
  });
}

export function primaryMedia(
  aggregate: Pick<StagedCatalogueAggregate, "mediaReferences">,
) {
  return aggregate.mediaReferences.find((media) => media.isPrimary) ?? null;
}

export function publicationEventFromHistory(events: readonly string[]) {
  return events.some(
    (event) => event === "PUBLISHED" || event === "REPUBLISHED",
  )
    ? ("REPUBLISHED" as const)
    : ("PUBLISHED" as const);
}

export function assertArchiveTransition(status: string, hasPending: boolean) {
  if (status !== "PUBLISHED") {
    throw new CatalogueTransitionError(
      "Only a currently published service can be archived.",
    );
  }
  if (hasPending) {
    throw new CatalogueTransitionError(
      "Republish or discard pending changes before archiving this service.",
    );
  }
}
