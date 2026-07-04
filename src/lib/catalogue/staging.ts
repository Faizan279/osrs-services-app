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

const nullableString = (maximum: number) => z.string().max(maximum).nullable();

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

export const stagedCatalogueAggregateSchema = z
  .object({
    schemaVersion: z.literal(1),
    service: stagedServiceFieldsSchema,
    gameModes: z.array(z.enum(catalogueGameModes)).min(1),
    requirements: z.array(stagedRequirementSchema),
    mediaReferences: z.array(stagedMediaSchema),
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
  });

export type StagedCatalogueAggregate = z.infer<
  typeof stagedCatalogueAggregateSchema
>;
export type StagedRequirement = z.infer<typeof stagedRequirementSchema>;
export type StagedMedia = z.infer<typeof stagedMediaSchema>;

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
    schemaVersion: 1,
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
  requirement: StagedRequirement,
) {
  return stagedCatalogueAggregateSchema.parse({
    ...aggregate,
    requirements: [...aggregate.requirements, requirement],
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
