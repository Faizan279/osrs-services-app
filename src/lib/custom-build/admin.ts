import "server-only";

import { randomBytes } from "node:crypto";

import { z, ZodError } from "zod";

import type { Prisma } from "@/generated/prisma/client";
import {
  customBuildAttachmentStatuses,
  customBuildObjectiveTypes,
  customBuildPricingModes,
  customBuildRequestStatuses,
} from "@/lib/custom-build/constants";
import {
  CustomBuildEstimateError,
  publishedCustomBuildRevisionSnapshot,
  safeCustomBuildJson,
  type PublishedCustomBuildRevisionSnapshotV1,
} from "@/lib/custom-build/estimate";
import {
  buildQuoteRevisionSnapshot,
  normalizeQuoteRevisionSnapshot,
} from "@/lib/custom-build/quote";
import { catalogueGameModes } from "@/lib/catalogue/constants";
import { prisma } from "@/lib/db/prisma";
import { publicQuoteNumber } from "@/lib/custom-build/server";

export class CustomBuildConflictError extends Error {}
export class CustomBuildTransitionError extends Error {}

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9]+$/i);

const safeKeySchema = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/i, "Use a stable public key.");

const optionalText = (maximum: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text || null;
  }, z.string().max(maximum).nullable());

const optionalInteger = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text ? Number(text) : null;
}, z.number().int().min(0).max(100_000_000).nullable());

export const customBuildServiceInputSchema = z.object({
  serviceConfigId: idSchema,
  publicName: z.string().trim().min(3).max(160),
  slug: safeKeySchema.max(180),
  publicDescription: z.string().trim().min(20).max(50_000),
  publicInstructions: z.string().trim().min(20).max(50_000),
  privateInternalInstructions: optionalText(50_000),
  availabilityState: z.enum(["AVAILABLE", "PAUSED", "UNAVAILABLE"]),
  minimumAutomaticEstimateCents: z.coerce
    .number()
    .int()
    .min(0)
    .max(100_000_000),
  maximumAutomaticEstimateCents: optionalInteger,
  quoteValidityDaysDefault: z.coerce.number().int().min(1).max(60),
  attachmentPolicy: z.string().trim().min(20).max(50_000),
  maxAttachments: z.coerce.number().int().min(0).max(5),
  maxAttachmentBytes: z.coerce
    .number()
    .int()
    .min(1)
    .max(5 * 1024 * 1024),
  maxTotalAttachmentBytes: z.coerce
    .number()
    .int()
    .min(1)
    .max(20 * 1024 * 1024),
  customerNoteMaxLength: z.coerce.number().int().min(100).max(5000),
  needsClientReview: z.boolean(),
});

export const customBuildSkillRuleInputSchema = z.object({
  ruleId: idSchema.optional(),
  ruleSetId: idSchema,
  skillKey: z.enum([
    "ATTACK",
    "STRENGTH",
    "DEFENCE",
    "RANGED",
    "PRAYER",
    "MAGIC",
    "RUNECRAFT",
    "CONSTRUCTION",
    "HITPOINTS",
    "AGILITY",
    "HERBLORE",
    "THIEVING",
    "CRAFTING",
    "FLETCHING",
    "SLAYER",
    "HUNTER",
    "MINING",
    "SMITHING",
    "FISHING",
    "COOKING",
    "FIREMAKING",
    "WOODCUTTING",
    "FARMING",
  ]),
  pricingMode: z.enum(customBuildPricingModes),
  gameMode: z.enum(catalogueGameModes).nullable(),
  minimumLevel: optionalInteger,
  maximumLevel: optionalInteger,
  minimumXp: optionalInteger,
  maximumXp: optionalInteger,
  centsPerMillionXp: optionalInteger,
  levelBandStart: optionalInteger,
  levelBandEnd: optionalInteger,
  fixedPriceCents: optionalInteger,
  minimumPriceCents: z.coerce.number().int().min(0).max(100_000_000),
  enabled: z.boolean(),
  manualReviewOnly: z.boolean(),
  needsClientReview: z.boolean(),
});

export const customBuildObjectiveInputSchema = z.object({
  objectiveId: idSchema.optional(),
  customBuildServiceId: idSchema,
  objectiveType: z.enum(customBuildObjectiveTypes),
  objectiveKey: safeKeySchema,
  publicName: z.string().trim().min(2).max(180),
  publicDescription: z.string().trim().min(5).max(50_000),
  objectiveGroup: optionalText(120),
  difficultyTier: optionalText(80),
  gameMode: z.enum(catalogueGameModes).nullable(),
  prerequisiteText: optionalText(50_000),
  sortOrder: z.coerce.number().int().min(0).max(100_000),
  enabled: z.boolean(),
  needsClientReview: z.boolean(),
});

export const customBuildObjectiveRuleInputSchema = z.object({
  ruleId: idSchema.optional(),
  ruleSetId: idSchema,
  objectiveId: idSchema,
  pricingMode: z.enum(customBuildPricingModes),
  fixedPriceCents: optionalInteger,
  percentBps: optionalInteger,
  gameMode: z.enum(catalogueGameModes).nullable(),
  manualReviewOnly: z.boolean(),
  enabled: z.boolean(),
  needsClientReview: z.boolean(),
});

export const customBuildStatusInputSchema = z.object({
  requestId: idSchema,
  nextStatus: z.enum(customBuildRequestStatuses),
  publicMessage: optionalText(500),
  internalReason: optionalText(20_000),
});

export const customBuildAttachmentReviewInputSchema = z.object({
  attachmentId: idSchema,
  requestId: idSchema,
  status: z.enum(customBuildAttachmentStatuses),
  reviewNote: optionalText(500),
});

export const customBuildQuoteInputSchema = z.object({
  requestId: idSchema,
  quoteId: idSchema.optional(),
  customerMessage: optionalText(20_000),
  privateInternalNote: optionalText(20_000),
  expiresAt: z.coerce.date(),
  estimatedDeliveryText: z.string().trim().min(3).max(240),
  includedWorkSummary: z.string().trim().min(5).max(50_000),
  exclusions: optionalText(50_000),
  customerSafeTerms: z.string().trim().min(10).max(50_000),
  lineDescription: z.string().trim().min(3).max(240),
  quantity: z.coerce.number().int().min(1).max(10_000),
  unitAmountCents: z.coerce.number().int().min(0).max(100_000_000),
  adjustmentsCents: z.coerce.number().int().min(0).max(100_000_000),
});

type CustomBuildServiceInput = z.infer<typeof customBuildServiceInputSchema>;
type CustomBuildSkillRuleInput = z.infer<
  typeof customBuildSkillRuleInputSchema
>;
type CustomBuildObjectiveInput = z.infer<
  typeof customBuildObjectiveInputSchema
>;
type CustomBuildObjectiveRuleInput = z.infer<
  typeof customBuildObjectiveRuleInputSchema
>;
type CustomBuildStatusInput = z.infer<typeof customBuildStatusInputSchema>;
type CustomBuildAttachmentReviewInput = z.infer<
  typeof customBuildAttachmentReviewInputSchema
>;
type CustomBuildQuoteInput = z.infer<typeof customBuildQuoteInputSchema>;

function stableId() {
  return randomBytes(12).toString("hex");
}

function stableKey(prefix: string) {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

function json(value: unknown) {
  return safeCustomBuildJson(value) as Prisma.InputJsonValue;
}

export async function getCustomBuildAdminOverview() {
  const [services, requests, quotes, attachments, review, flag, activity] =
    await Promise.all([
      prisma.customBuildService.count(),
      prisma.customBuildRequest.count(),
      prisma.customBuildQuote.count(),
      prisma.customBuildAttachment.count(),
      prisma.customBuildService.count({ where: { needsClientReview: true } }),
      prisma.featureFlag.findUnique({
        where: { key: "custom_account_build_enabled" },
        select: { enabled: true },
      }),
      prisma.auditLog.findMany({
        where: { action: { startsWith: "custom_build." } },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    ]);
  return {
    services,
    requests,
    quotes,
    attachments,
    needsClientReview: review,
    featureEnabled: Boolean(flag?.enabled),
    activity,
  };
}

export async function getCustomBuildAdminConfig() {
  return prisma.customBuildService.findFirst({
    include: {
      service: { include: { category: true } },
      ruleSets: {
        orderBy: [{ status: "asc" }, { createdAt: "asc" }],
        include: {
          skillRules: { orderBy: [{ skillKey: "asc" }, { stableKey: "asc" }] },
          objectiveRules: {
            orderBy: [
              { objective: { sortOrder: "asc" } },
              { stableKey: "asc" },
            ],
            include: { objective: true },
          },
        },
      },
      objectives: { orderBy: [{ sortOrder: "asc" }, { publicName: "asc" }] },
      revisions: {
        orderBy: [{ revisionNumber: "desc" }],
        include: { publishedBy: { select: { name: true, email: true } } },
      },
    },
  });
}

export async function getCustomBuildRequestsAdmin() {
  return prisma.customBuildRequest.findMany({
    orderBy: [{ submittedAt: "desc" }],
    include: {
      service: { select: { publicName: true } },
      quote: { select: { status: true, publicQuoteNumber: true } },
      attachments: { select: { id: true, status: true, scanStatus: true } },
    },
  });
}

export async function getCustomBuildRequestAdmin(requestId: string) {
  return prisma.customBuildRequest.findUnique({
    where: { id: requestId },
    include: {
      service: true,
      skills: { orderBy: { sortOrder: "asc" } },
      objectives: { orderBy: { sortOrder: "asc" } },
      statusEvents: {
        orderBy: { createdAt: "asc" },
        include: { actor: { select: { name: true, email: true } } },
      },
      attachments: { orderBy: { uploadedAt: "asc" } },
      quote: {
        include: {
          revisions: {
            orderBy: [{ revisionNumber: "desc" }],
            include: {
              lines: { orderBy: { sortOrder: "asc" } },
              createdBy: { select: { name: true, email: true } },
            },
          },
          decisions: { orderBy: { decidedAt: "desc" } },
        },
      },
    },
  });
}

function draftRuleSet(
  config: NonNullable<Awaited<ReturnType<typeof getCustomBuildAdminConfig>>>,
) {
  const draft = config.ruleSets.find((ruleSet) => ruleSet.status === "DRAFT");
  if (!draft) {
    throw new CustomBuildTransitionError("No draft rule set exists.");
  }
  return draft;
}

async function latestRevisionNumber(
  transaction: Prisma.TransactionClient,
  serviceId: string,
) {
  const latest = await transaction.customBuildRevision.findFirst({
    where: { customBuildServiceId: serviceId },
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true },
  });
  return latest?.revisionNumber ?? 0;
}

async function buildRevisionSnapshot({
  transaction,
  serviceConfigId,
  revisionId,
  revisionNumber,
  publishedAt,
}: {
  transaction: Prisma.TransactionClient;
  serviceConfigId: string;
  revisionId: string;
  revisionNumber: number;
  publishedAt: Date;
}) {
  const config = await transaction.customBuildService.findUniqueOrThrow({
    where: { id: serviceConfigId },
    include: {
      service: { include: { category: true } },
      ruleSets: {
        where: { status: "DRAFT" },
        take: 1,
        include: {
          skillRules: { orderBy: [{ skillKey: "asc" }, { stableKey: "asc" }] },
          objectiveRules: {
            orderBy: [{ stableKey: "asc" }],
            include: { objective: true },
          },
        },
      },
      objectives: { orderBy: [{ sortOrder: "asc" }, { publicName: "asc" }] },
    },
  });
  const ruleSet = config.ruleSets[0];
  if (!ruleSet) {
    throw new CustomBuildTransitionError("No draft rule set exists.");
  }
  const snapshot: PublishedCustomBuildRevisionSnapshotV1 = {
    schemaVersion: 1,
    service: {
      id: config.id,
      stableKey: config.stableKey,
      slug: config.slug,
      serviceId: config.serviceId,
      serviceSlug: config.service.slug,
      categoryId: config.service.categoryId,
      categorySlug: config.service.category.slug,
      publicName: config.publicName,
      currencyCode: config.currencyCode,
      minimumAutomaticEstimateCents: config.minimumAutomaticEstimateCents,
      maximumAutomaticEstimateCents: config.maximumAutomaticEstimateCents,
      validForMinutes: config.quoteValidityDaysDefault * 24 * 60,
    },
    revision: {
      id: revisionId,
      revisionNumber,
      publishedAt: publishedAt.toISOString(),
    },
    skillRules: ruleSet.skillRules.map((rule) => ({
      stableKey: rule.stableKey,
      skillKey: rule.skillKey,
      pricingMode: rule.pricingMode,
      gameMode: rule.gameMode,
      minimumLevel: rule.minimumLevel,
      maximumLevel: rule.maximumLevel,
      minimumXp: rule.minimumXp?.toString() ?? null,
      maximumXp: rule.maximumXp?.toString() ?? null,
      centsPerMillionXp: rule.centsPerMillionXp,
      levelBandStart: rule.levelBandStart,
      levelBandEnd: rule.levelBandEnd,
      fixedPriceCents: rule.fixedPriceCents,
      minimumPriceCents: rule.minimumPriceCents,
      enabled: rule.enabled,
      manualReviewOnly: rule.manualReviewOnly,
      needsClientReview: rule.needsClientReview,
    })),
    objectives: config.objectives.map((objective) => ({
      stableKey: objective.stableKey,
      objectiveType: objective.objectiveType,
      objectiveKey: objective.objectiveKey,
      publicName: objective.publicName,
      publicDescription: objective.publicDescription,
      objectiveGroup: objective.objectiveGroup,
      difficultyTier: objective.difficultyTier,
      gameMode: objective.gameMode,
      prerequisiteText: objective.prerequisiteText,
      sortOrder: objective.sortOrder,
      enabled: objective.enabled,
      needsClientReview: objective.needsClientReview,
    })),
    objectiveRules: ruleSet.objectiveRules.map((rule) => ({
      stableKey: rule.stableKey,
      objectiveStableKey: rule.objective.stableKey,
      pricingMode: rule.pricingMode,
      fixedPriceCents: rule.fixedPriceCents,
      percentBps: rule.percentBps,
      gameMode: rule.gameMode,
      manualReviewOnly: rule.manualReviewOnly,
      enabled: rule.enabled,
      needsClientReview: rule.needsClientReview,
    })),
  };
  return publishedCustomBuildRevisionSnapshot(snapshot);
}

export async function saveCustomBuildServiceConfig({
  input,
  actorId,
  expectedVersion,
}: {
  input: CustomBuildServiceInput;
  actorId: string;
  expectedVersion: number;
}) {
  const updated = await prisma.customBuildService.updateMany({
    where: { id: input.serviceConfigId, concurrencyVersion: expectedVersion },
    data: {
      publicName: input.publicName,
      slug: input.slug,
      publicDescription: input.publicDescription,
      publicInstructions: input.publicInstructions,
      privateInternalInstructions: input.privateInternalInstructions,
      availabilityState: input.availabilityState,
      minimumAutomaticEstimateCents: input.minimumAutomaticEstimateCents,
      maximumAutomaticEstimateCents: input.maximumAutomaticEstimateCents,
      quoteValidityDaysDefault: input.quoteValidityDaysDefault,
      attachmentPolicy: input.attachmentPolicy,
      maxAttachments: input.maxAttachments,
      maxAttachmentBytes: input.maxAttachmentBytes,
      maxTotalAttachmentBytes: input.maxTotalAttachmentBytes,
      customerNoteMaxLength: input.customerNoteMaxLength,
      needsClientReview: input.needsClientReview,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new CustomBuildConflictError(
      "Custom-build configuration changed after this page loaded.",
    );
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "custom_build.config.updated",
      targetType: "CustomBuildService",
      targetId: input.serviceConfigId,
      metadata: json({
        availabilityState: input.availabilityState,
        needsClientReview: input.needsClientReview,
      }),
    },
  });
}

export async function saveCustomBuildSkillRule({
  input,
  actorId,
  expectedVersion,
}: {
  input: CustomBuildSkillRuleInput;
  actorId: string;
  expectedVersion?: number;
}) {
  const data = {
    ruleSetId: input.ruleSetId,
    skillKey: input.skillKey,
    pricingMode: input.pricingMode,
    gameMode: input.gameMode,
    minimumLevel: input.minimumLevel,
    maximumLevel: input.maximumLevel,
    minimumXp: input.minimumXp == null ? null : BigInt(input.minimumXp),
    maximumXp: input.maximumXp == null ? null : BigInt(input.maximumXp),
    centsPerMillionXp: input.centsPerMillionXp,
    levelBandStart: input.levelBandStart,
    levelBandEnd: input.levelBandEnd,
    fixedPriceCents: input.fixedPriceCents,
    minimumPriceCents: input.minimumPriceCents,
    enabled: input.enabled,
    manualReviewOnly: input.manualReviewOnly,
    needsClientReview: input.needsClientReview,
  };
  let id = input.ruleId;
  if (input.ruleId) {
    const updated = await prisma.customBuildSkillRule.updateMany({
      where: { id: input.ruleId, concurrencyVersion: expectedVersion },
      data: { ...data, concurrencyVersion: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new CustomBuildConflictError("Skill rule changed. Reload first.");
    }
  } else {
    const created = await prisma.customBuildSkillRule.create({
      data: {
        id: stableId(),
        stableKey: stableKey("custom-skill-rule"),
        ...data,
      },
      select: { id: true },
    });
    id = created.id;
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: input.ruleId
        ? "custom_build.skill_rule.updated"
        : "custom_build.skill_rule.created",
      targetType: "CustomBuildSkillRule",
      targetId: id,
      metadata: json({ skillKey: input.skillKey, enabled: input.enabled }),
    },
  });
}

export async function saveCustomBuildObjective({
  input,
  actorId,
  expectedVersion,
}: {
  input: CustomBuildObjectiveInput;
  actorId: string;
  expectedVersion?: number;
}) {
  const data = {
    customBuildServiceId: input.customBuildServiceId,
    objectiveType: input.objectiveType,
    objectiveKey: input.objectiveKey,
    publicName: input.publicName,
    publicDescription: input.publicDescription,
    objectiveGroup: input.objectiveGroup,
    difficultyTier: input.difficultyTier,
    gameMode: input.gameMode,
    prerequisiteText: input.prerequisiteText,
    sortOrder: input.sortOrder,
    enabled: input.enabled,
    needsClientReview: input.needsClientReview,
  };
  let id = input.objectiveId;
  if (input.objectiveId) {
    const updated = await prisma.customBuildObjective.updateMany({
      where: { id: input.objectiveId, concurrencyVersion: expectedVersion },
      data: { ...data, concurrencyVersion: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new CustomBuildConflictError("Objective changed. Reload first.");
    }
  } else {
    const created = await prisma.customBuildObjective.create({
      data: {
        id: stableId(),
        stableKey: stableKey("custom-objective"),
        ...data,
      },
      select: { id: true },
    });
    id = created.id;
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: input.objectiveId
        ? "custom_build.objective.updated"
        : "custom_build.objective.created",
      targetType: "CustomBuildObjective",
      targetId: id,
      metadata: json({
        objectiveType: input.objectiveType,
        enabled: input.enabled,
      }),
    },
  });
}

export async function saveCustomBuildObjectiveRule({
  input,
  actorId,
  expectedVersion,
}: {
  input: CustomBuildObjectiveRuleInput;
  actorId: string;
  expectedVersion?: number;
}) {
  const data = {
    ruleSetId: input.ruleSetId,
    objectiveId: input.objectiveId,
    pricingMode: input.pricingMode,
    fixedPriceCents: input.fixedPriceCents,
    percentBps: input.percentBps,
    gameMode: input.gameMode,
    manualReviewOnly: input.manualReviewOnly,
    enabled: input.enabled,
    needsClientReview: input.needsClientReview,
  };
  let id = input.ruleId;
  if (input.ruleId) {
    const updated = await prisma.customBuildObjectiveRule.updateMany({
      where: { id: input.ruleId, concurrencyVersion: expectedVersion },
      data: { ...data, concurrencyVersion: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new CustomBuildConflictError(
        "Objective rule changed. Reload first.",
      );
    }
  } else {
    const created = await prisma.customBuildObjectiveRule.create({
      data: {
        id: stableId(),
        stableKey: stableKey("custom-objective-rule"),
        ...data,
      },
      select: { id: true },
    });
    id = created.id;
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: input.ruleId
        ? "custom_build.objective_rule.updated"
        : "custom_build.objective_rule.created",
      targetType: "CustomBuildObjectiveRule",
      targetId: id,
      metadata: json({
        objectiveId: input.objectiveId,
        enabled: input.enabled,
      }),
    },
  });
}

export async function publishCustomBuildConfiguration({
  serviceConfigId,
  actorId,
  expectedVersion,
}: {
  serviceConfigId: string;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const claimed = await transaction.customBuildService.updateMany({
      where: { id: serviceConfigId, concurrencyVersion: expectedVersion },
      data: { concurrencyVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw new CustomBuildConflictError(
        "Configuration changed before it could be published.",
      );
    }
    const revisionId = stableId();
    const revisionNumber =
      (await latestRevisionNumber(transaction, serviceConfigId)) + 1;
    const publishedAt = new Date();
    const snapshot = await buildRevisionSnapshot({
      transaction,
      serviceConfigId,
      revisionId,
      revisionNumber,
      publishedAt,
    });
    const draft = await transaction.customBuildRuleSet.findFirstOrThrow({
      where: { customBuildServiceId: serviceConfigId, status: "DRAFT" },
    });
    await transaction.customBuildRevision.create({
      data: {
        id: revisionId,
        customBuildServiceId: serviceConfigId,
        ruleSetId: draft.id,
        revisionNumber,
        snapshotSchemaVersion: 1,
        snapshot: json(snapshot),
        publishedAt,
        publishedById: actorId,
      },
    });
    await transaction.customBuildRuleSet.update({
      where: { id: draft.id },
      data: {
        publishedAt,
        publishedById: actorId,
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "custom_build.config.published",
        targetType: "CustomBuildRevision",
        targetId: revisionId,
        metadata: json({ serviceConfigId, revisionNumber }),
      },
    });
    return { revisionId, revisionNumber };
  });
}

async function replaceDraftFromRevision({
  transaction,
  serviceConfigId,
  revisionId,
}: {
  transaction: Prisma.TransactionClient;
  serviceConfigId: string;
  revisionId?: string;
}) {
  const revision = revisionId
    ? await transaction.customBuildRevision.findFirst({
        where: { id: revisionId, customBuildServiceId: serviceConfigId },
        select: { snapshot: true },
      })
    : await transaction.customBuildRevision.findFirst({
        where: { customBuildServiceId: serviceConfigId },
        orderBy: [{ revisionNumber: "desc" }],
        select: { snapshot: true },
      });
  if (!revision) {
    throw new CustomBuildTransitionError("No published revision exists.");
  }
  const snapshot = publishedCustomBuildRevisionSnapshot(
    revision.snapshot as PublishedCustomBuildRevisionSnapshotV1,
  );
  const draft = await transaction.customBuildRuleSet.findFirstOrThrow({
    where: { customBuildServiceId: serviceConfigId, status: "DRAFT" },
  });
  await transaction.customBuildSkillRule.deleteMany({
    where: { ruleSetId: draft.id },
  });
  await transaction.customBuildObjectiveRule.deleteMany({
    where: { ruleSetId: draft.id },
  });
  await transaction.customBuildObjective.deleteMany({
    where: { customBuildServiceId: serviceConfigId },
  });
  await transaction.customBuildObjective.createMany({
    data: snapshot.objectives.map((objective) => ({
      id: stableId(),
      stableKey: objective.stableKey,
      customBuildServiceId: serviceConfigId,
      objectiveType: objective.objectiveType,
      objectiveKey: objective.objectiveKey,
      publicName: objective.publicName,
      publicDescription: objective.publicDescription,
      objectiveGroup: objective.objectiveGroup,
      difficultyTier: objective.difficultyTier,
      gameMode: objective.gameMode,
      prerequisiteText: objective.prerequisiteText,
      sortOrder: objective.sortOrder,
      enabled: objective.enabled,
      needsClientReview: objective.needsClientReview,
    })),
  });
  const objectives = await transaction.customBuildObjective.findMany({
    where: { customBuildServiceId: serviceConfigId },
    select: { id: true, stableKey: true },
  });
  const objectiveIds = new Map(
    objectives.map((objective) => [objective.stableKey, objective.id]),
  );
  await transaction.customBuildSkillRule.createMany({
    data: snapshot.skillRules.map((rule) => ({
      id: stableId(),
      stableKey: rule.stableKey,
      ruleSetId: draft.id,
      skillKey: rule.skillKey,
      pricingMode: rule.pricingMode,
      gameMode: rule.gameMode,
      minimumLevel: rule.minimumLevel,
      maximumLevel: rule.maximumLevel,
      minimumXp: rule.minimumXp ? BigInt(rule.minimumXp) : null,
      maximumXp: rule.maximumXp ? BigInt(rule.maximumXp) : null,
      centsPerMillionXp: rule.centsPerMillionXp,
      levelBandStart: rule.levelBandStart,
      levelBandEnd: rule.levelBandEnd,
      fixedPriceCents: rule.fixedPriceCents,
      minimumPriceCents: rule.minimumPriceCents,
      enabled: rule.enabled,
      manualReviewOnly: rule.manualReviewOnly,
      needsClientReview: rule.needsClientReview,
    })),
  });
  await transaction.customBuildObjectiveRule.createMany({
    data: snapshot.objectiveRules.flatMap((rule) => {
      const objectiveId = objectiveIds.get(rule.objectiveStableKey);
      return objectiveId
        ? [
            {
              id: stableId(),
              stableKey: rule.stableKey,
              ruleSetId: draft.id,
              objectiveId,
              pricingMode: rule.pricingMode,
              fixedPriceCents: rule.fixedPriceCents,
              percentBps: rule.percentBps,
              gameMode: rule.gameMode,
              manualReviewOnly: rule.manualReviewOnly,
              enabled: rule.enabled,
              needsClientReview: rule.needsClientReview,
            },
          ]
        : [];
    }),
  });
}

export async function discardCustomBuildDraft({
  serviceConfigId,
  actorId,
  expectedVersion,
}: {
  serviceConfigId: string;
  actorId: string;
  expectedVersion: number;
}) {
  await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.customBuildService.updateMany({
      where: { id: serviceConfigId, concurrencyVersion: expectedVersion },
      data: { concurrencyVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw new CustomBuildConflictError(
        "Configuration changed. Reload first.",
      );
    }
    await replaceDraftFromRevision({ transaction, serviceConfigId });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "custom_build.config.draft_discarded",
        targetType: "CustomBuildService",
        targetId: serviceConfigId,
        metadata: json({ restoredLatestRevision: true }),
      },
    });
  });
}

export async function restoreCustomBuildRevision({
  serviceConfigId,
  revisionId,
  actorId,
  expectedVersion,
}: {
  serviceConfigId: string;
  revisionId: string;
  actorId: string;
  expectedVersion: number;
}) {
  await prisma.$transaction(async (transaction) => {
    const claimed = await transaction.customBuildService.updateMany({
      where: { id: serviceConfigId, concurrencyVersion: expectedVersion },
      data: { concurrencyVersion: { increment: 1 } },
    });
    if (claimed.count !== 1) {
      throw new CustomBuildConflictError(
        "Configuration changed. Reload first.",
      );
    }
    await replaceDraftFromRevision({
      transaction,
      serviceConfigId,
      revisionId,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "custom_build.config.revision_restored",
        targetType: "CustomBuildRevision",
        targetId: revisionId,
        metadata: json({ serviceConfigId }),
      },
    });
  });
}

const transitions: Record<string, string[]> = {
  SUBMITTED: ["UNDER_REVIEW", "NEEDS_CUSTOMER_INFORMATION", "CANCELLED"],
  UNDER_REVIEW: [
    "NEEDS_CUSTOMER_INFORMATION",
    "ESTIMATE_PROVIDED",
    "QUOTE_DRAFT",
    "CLOSED",
    "CANCELLED",
  ],
  NEEDS_CUSTOMER_INFORMATION: ["UNDER_REVIEW", "CLOSED", "CANCELLED"],
  ESTIMATE_PROVIDED: ["QUOTE_DRAFT", "CLOSED", "CANCELLED"],
  QUOTE_DRAFT: ["QUOTE_SENT", "CLOSED", "CANCELLED"],
  QUOTE_SENT: ["QUOTE_ACCEPTED", "QUOTE_DECLINED", "QUOTE_EXPIRED", "CLOSED"],
  QUOTE_ACCEPTED: ["CLOSED"],
  QUOTE_DECLINED: ["CLOSED"],
  QUOTE_EXPIRED: ["CLOSED"],
  CLOSED: [],
  CANCELLED: [],
};

export async function transitionCustomBuildRequest({
  input,
  actorId,
  expectedVersion,
}: {
  input: CustomBuildStatusInput;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.customBuildRequest.findUniqueOrThrow({
      where: { id: input.requestId },
      select: { status: true, concurrencyVersion: true },
    });
    if (request.concurrencyVersion !== expectedVersion) {
      throw new CustomBuildConflictError("Request changed. Reload first.");
    }
    if (!transitions[request.status]?.includes(input.nextStatus)) {
      throw new CustomBuildTransitionError(
        "That status transition is invalid.",
      );
    }
    await transaction.customBuildRequest.update({
      where: { id: input.requestId },
      data: {
        status: input.nextStatus,
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.customBuildRequestStatusEvent.create({
      data: {
        requestId: input.requestId,
        previousStatus: request.status,
        newStatus: input.nextStatus,
        publicMessage: input.publicMessage,
        internalReason: input.internalReason,
        actorId,
        safeMetadata: json({ status: input.nextStatus }),
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "custom_build.request.status_changed",
        targetType: "CustomBuildRequest",
        targetId: input.requestId,
        metadata: json({ from: request.status, to: input.nextStatus }),
      },
    });
  });
}

export async function reviewCustomBuildAttachment({
  input,
  actorId,
  expectedVersion,
}: {
  input: CustomBuildAttachmentReviewInput;
  actorId: string;
  expectedVersion: number;
}) {
  const updated = await prisma.customBuildAttachment.updateMany({
    where: {
      id: input.attachmentId,
      requestId: input.requestId,
      concurrencyVersion: expectedVersion,
    },
    data: {
      status: input.status,
      scanStatus: input.status === "REJECTED" ? "REJECTED" : "NOT_SCANNED",
      reviewNote: input.reviewNote,
      reviewedAt: new Date(),
      reviewedById: actorId,
      concurrencyVersion: { increment: 1 },
    },
  });
  if (updated.count !== 1) {
    throw new CustomBuildConflictError("Attachment changed. Reload first.");
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action:
        input.status === "APPROVED"
          ? "custom_build.attachment.approved"
          : "custom_build.attachment.rejected",
      targetType: "CustomBuildAttachment",
      targetId: input.attachmentId,
      metadata: json({
        requestId: input.requestId,
        status: input.status,
        scanStatus: input.status === "REJECTED" ? "REJECTED" : "NOT_SCANNED",
      }),
    },
  });
}

export async function createCustomBuildQuoteRevision({
  input,
  actorId,
  expectedRequestVersion,
}: {
  input: CustomBuildQuoteInput;
  actorId: string;
  expectedRequestVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const request = await transaction.customBuildRequest.findUniqueOrThrow({
      where: { id: input.requestId },
      include: { quote: true },
    });
    if (request.concurrencyVersion !== expectedRequestVersion) {
      throw new CustomBuildConflictError("Request changed. Reload first.");
    }
    let quote = request.quote;
    if (!quote) {
      quote = await transaction.customBuildQuote.create({
        data: {
          id: stableId(),
          publicQuoteNumber: publicQuoteNumber(),
          requestId: request.id,
          currencyCode: "USD",
          status: "DRAFT",
          customerMessage: input.customerMessage,
          privateInternalNote: input.privateInternalNote,
          expiresAt: input.expiresAt,
        },
      });
    } else {
      quote = await transaction.customBuildQuote.update({
        where: { id: quote.id },
        data: {
          status: "DRAFT",
          customerMessage: input.customerMessage,
          privateInternalNote: input.privateInternalNote,
          expiresAt: input.expiresAt,
          concurrencyVersion: { increment: 1 },
        },
      });
    }
    const revisionNumber = quote.currentRevisionNumber + 1;
    const snapshot = buildQuoteRevisionSnapshot({
      publicQuoteNumber: quote.publicQuoteNumber,
      revisionNumber,
      currencyCode: "USD",
      expiresAt: input.expiresAt,
      lines: [
        {
          publicDescription: input.lineDescription,
          quantity: input.quantity,
          unitAmountCents: input.unitAmountCents,
          lineType: "SERVICE",
        },
      ],
      adjustmentsCents: input.adjustmentsCents,
      estimatedDeliveryText: input.estimatedDeliveryText,
      includedWorkSummary: input.includedWorkSummary,
      exclusions: input.exclusions,
      customerSafeTerms: input.customerSafeTerms,
    });
    const revision = await transaction.customBuildQuoteRevision.create({
      data: {
        id: stableId(),
        quoteId: quote.id,
        revisionNumber,
        snapshot: json(snapshot),
        subtotalCents: snapshot.subtotalCents,
        adjustmentsCents: snapshot.adjustmentsCents,
        finalTotalCents: snapshot.finalTotalCents,
        estimatedDeliveryText: snapshot.estimatedDeliveryText,
        includedWorkSummary: snapshot.includedWorkSummary,
        exclusions: snapshot.exclusions,
        customerSafeTerms: snapshot.customerSafeTerms,
        createdById: actorId,
        lines: {
          create: snapshot.lines.map((line) => ({
            lineType: line.lineType,
            publicDescription: line.publicDescription,
            quantity: line.quantity,
            unitAmountCents: line.unitAmountCents,
            lineTotalCents: line.lineTotalCents,
            sortOrder: line.sortOrder,
          })),
        },
      },
    });
    await transaction.customBuildQuote.update({
      where: { id: quote.id },
      data: { currentRevisionNumber: revisionNumber },
    });
    await transaction.customBuildRequest.update({
      where: { id: request.id },
      data: {
        status: "QUOTE_DRAFT",
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.customBuildRequestStatusEvent.create({
      data: {
        requestId: request.id,
        previousStatus: request.status,
        newStatus: "QUOTE_DRAFT",
        actorId,
        publicMessage: "A quote draft is being prepared.",
        safeMetadata: json({ quoteId: quote.id, revisionNumber }),
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "custom_build.quote.revision_created",
        targetType: "CustomBuildQuoteRevision",
        targetId: revision.id,
        metadata: json({
          quoteId: quote.id,
          requestId: request.id,
          revisionNumber,
        }),
      },
    });
    return { quoteId: quote.id, revisionId: revision.id, revisionNumber };
  });
}

export async function sendCustomBuildQuote({
  quoteId,
  actorId,
  expectedVersion,
}: {
  quoteId: string;
  actorId: string;
  expectedVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const quote = await transaction.customBuildQuote.findUniqueOrThrow({
      where: { id: quoteId },
      include: {
        request: true,
        revisions: {
          orderBy: [{ revisionNumber: "desc" }],
          take: 1,
        },
      },
    });
    if (quote.concurrencyVersion !== expectedVersion) {
      throw new CustomBuildConflictError("Quote changed. Reload first.");
    }
    const revision = quote.revisions[0];
    if (!revision) {
      throw new CustomBuildTransitionError("Create a quote revision first.");
    }
    normalizeQuoteRevisionSnapshot(revision.snapshot);
    const now = new Date();
    await transaction.customBuildQuote.update({
      where: { id: quote.id },
      data: {
        status: "SENT",
        issuedAt: now,
        expiresAt: quote.expiresAt ?? new Date(now.getTime() + 7 * 86400_000),
        currentRevisionNumber: revision.revisionNumber,
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.customBuildQuoteRevision.update({
      where: { id: revision.id },
      data: { sentAt: now },
    });
    await transaction.customBuildRequest.update({
      where: { id: quote.requestId },
      data: {
        status: "QUOTE_SENT",
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.customBuildRequestStatusEvent.create({
      data: {
        requestId: quote.requestId,
        previousStatus: quote.request.status,
        newStatus: "QUOTE_SENT",
        actorId,
        publicMessage: "Your quote is ready to review.",
        safeMetadata: json({
          quoteId: quote.id,
          revisionNumber: revision.revisionNumber,
        }),
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "custom_build.quote.sent",
        targetType: "CustomBuildQuote",
        targetId: quote.id,
        metadata: json({
          requestId: quote.requestId,
          revisionNumber: revision.revisionNumber,
        }),
      },
    });
  });
}

export async function voidCustomBuildQuote({
  quoteId,
  actorId,
  expectedVersion,
}: {
  quoteId: string;
  actorId: string;
  expectedVersion: number;
}) {
  const updated = await prisma.customBuildQuote.updateMany({
    where: { id: quoteId, concurrencyVersion: expectedVersion },
    data: { status: "VOID", concurrencyVersion: { increment: 1 } },
  });
  if (updated.count !== 1) {
    throw new CustomBuildConflictError("Quote changed. Reload first.");
  }
  await prisma.auditLog.create({
    data: {
      actorId,
      action: "custom_build.quote.voided",
      targetType: "CustomBuildQuote",
      targetId: quoteId,
      metadata: json({ voided: true }),
    },
  });
}

export async function expireCustomBuildQuotes({
  actorId,
}: {
  actorId: string;
}) {
  const now = new Date();
  const quotes = await prisma.customBuildQuote.findMany({
    where: { status: "SENT", expiresAt: { lte: now } },
    include: { request: true },
  });
  for (const quote of quotes) {
    await prisma.$transaction(async (transaction) => {
      await transaction.customBuildQuote.update({
        where: { id: quote.id },
        data: { status: "EXPIRED", concurrencyVersion: { increment: 1 } },
      });
      await transaction.customBuildRequest.update({
        where: { id: quote.requestId },
        data: {
          status: "QUOTE_EXPIRED",
          concurrencyVersion: { increment: 1 },
        },
      });
      await transaction.customBuildRequestStatusEvent.create({
        data: {
          requestId: quote.requestId,
          previousStatus: quote.request.status,
          newStatus: "QUOTE_EXPIRED",
          actorId,
          publicMessage: "The quote expired.",
          safeMetadata: json({ quoteId: quote.id }),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "custom_build.quote.expired",
          targetType: "CustomBuildQuote",
          targetId: quote.id,
          metadata: json({ requestId: quote.requestId }),
        },
      });
    });
  }
  return quotes.length;
}

export function customBuildActionErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the submitted values.";
  }
  if (
    error instanceof CustomBuildConflictError ||
    error instanceof CustomBuildTransitionError ||
    error instanceof CustomBuildEstimateError
  ) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "P2002") return "That custom-build record already exists.";
    if (code === "P2003") {
      return "This custom-build record is still referenced.";
    }
    if (code === "P2025") return "This custom-build record no longer exists.";
  }
  console.error("[custom-build:action]", {
    errorName: error instanceof Error ? error.name : typeof error,
  });
  return "The custom-build action could not be completed. Please try again.";
}

export { draftRuleSet };
