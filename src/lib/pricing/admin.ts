import "server-only";

import { randomBytes } from "node:crypto";

import { z, ZodError } from "zod";

import type {
  CatalogueEngineType,
  Prisma,
  PricingScope,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  DEFAULT_PRICING_RULE_SET_NAME,
  publishedRevisionSnapshot,
  pricingRuleSnapshot,
} from "@/lib/pricing/server";
import {
  normalizePublishedPricingRevision,
  PricingValidationError,
  safePricingJson,
  type PricingRuleSnapshot,
  type PublishedPricingRevisionSnapshotV1,
} from "@/lib/pricing/engine";

export class PricingConflictError extends Error {}
export class PricingTransitionError extends Error {}

export const pricingRuleTypes = [
  "FIXED_ADDITION",
  "PERCENTAGE_ADDITION",
  "MINIMUM_TOTAL",
  "MAXIMUM_TOTAL",
] as const;

export const pricingScopes = [
  "GLOBAL",
  "ENGINE_TYPE",
  "CATEGORY",
  "SERVICE",
] as const;

export const pricingRuleTypeLabels = {
  FIXED_ADDITION: "Fixed addition",
  PERCENTAGE_ADDITION: "Percentage addition",
  MINIMUM_TOTAL: "Minimum total",
  MAXIMUM_TOTAL: "Maximum total",
} as const;

export const pricingScopeLabels = {
  GLOBAL: "Global",
  ENGINE_TYPE: "Engine type",
  CATEGORY: "Category",
  SERVICE: "Service",
} as const;

const moneyInput = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().int().min(0).max(100_000_000).nullable(),
);

const bpsInput = z.preprocess(
  (value) => (value === "" || value == null ? null : value),
  z.coerce.number().int().min(0).max(100_000).nullable(),
);

const nullableText = (maximum: number) =>
  z.preprocess((value) => {
    const text = String(value ?? "").trim();
    return text || null;
  }, z.string().max(maximum).nullable());

const dateInput = z.preprocess((value) => {
  const text = String(value ?? "").trim();
  return text ? new Date(text) : null;
}, z.date().nullable());

export const pricingRuleInputSchema = z
  .object({
    ruleSetId: z.string().min(1).max(30),
    publicLabel: z.string().trim().min(2).max(160),
    internalDescription: nullableText(20_000),
    enabled: z.boolean(),
    ruleType: z.enum(pricingRuleTypes),
    amountCents: moneyInput,
    valueBps: bpsInput,
    priority: z.coerce.number().int().min(-100_000).max(100_000),
    exclusiveGroupKey: nullableText(120),
    effectiveStart: dateInput,
    effectiveEnd: dateInput,
    needsClientReview: z.boolean(),
    scope: z.enum(pricingScopes),
    engineType: nullableText(80),
    categoryId: nullableText(30),
    serviceId: nullableText(30),
  })
  .superRefine((input, context) => {
    if (
      ["FIXED_ADDITION", "MINIMUM_TOTAL", "MAXIMUM_TOTAL"].includes(
        input.ruleType,
      ) &&
      input.amountCents == null
    ) {
      context.addIssue({
        code: "custom",
        path: ["amountCents"],
        message: "Enter an amount in cents for this pricing rule.",
      });
    }
    if (input.ruleType === "PERCENTAGE_ADDITION" && input.valueBps == null) {
      context.addIssue({
        code: "custom",
        path: ["valueBps"],
        message: "Enter a basis-point percentage for this pricing rule.",
      });
    }
    if (
      input.effectiveStart &&
      input.effectiveEnd &&
      input.effectiveEnd <= input.effectiveStart
    ) {
      context.addIssue({
        code: "custom",
        path: ["effectiveEnd"],
        message: "Effective end must be later than effective start.",
      });
    }
    if (input.scope === "ENGINE_TYPE" && !input.engineType) {
      context.addIssue({
        code: "custom",
        path: ["engineType"],
        message: "Choose an engine type for engine-scoped pricing.",
      });
    }
    if (input.scope === "CATEGORY" && !input.categoryId) {
      context.addIssue({
        code: "custom",
        path: ["categoryId"],
        message: "Choose a category for category-scoped pricing.",
      });
    }
    if (input.scope === "SERVICE" && !input.serviceId) {
      context.addIssue({
        code: "custom",
        path: ["serviceId"],
        message: "Choose a service for service-scoped pricing.",
      });
    }
  });

type PricingRuleInput = z.infer<typeof pricingRuleInputSchema>;

function auditMetadata(value: Record<string, unknown>) {
  return safePricingJson(value) as Prisma.InputJsonValue;
}

function jsonSnapshot(value: PublishedPricingRevisionSnapshotV1) {
  return safePricingJson(value) as Prisma.InputJsonValue;
}

function stableId() {
  return randomBytes(12).toString("hex");
}

export async function ensureDraftPricingRuleSet(
  transaction: Prisma.TransactionClient,
) {
  const existing = await transaction.pricingRuleSet.findFirst({
    where: { status: "DRAFT" },
    orderBy: { createdAt: "asc" },
  });
  if (existing) return existing;
  const created = await transaction.pricingRuleSet.create({
    data: {
      name: DEFAULT_PRICING_RULE_SET_NAME,
      description:
        "Draft global pricing rules. Published revisions are immutable.",
      status: "DRAFT",
      currencyCode: "USD",
      needsClientReview: true,
      internalNotes:
        "Seed-safe default created because the pricing draft was missing.",
    },
  });
  await transaction.auditLog.create({
    data: {
      action: "pricing.rule_set.created",
      targetType: "PricingRuleSet",
      targetId: created.id,
      metadata: auditMetadata({ seededFallback: true }),
    },
  });
  return created;
}

async function claimDraft(
  transaction: Prisma.TransactionClient,
  ruleSetId: string,
  expectedVersion: number,
  data: Prisma.PricingRuleSetUncheckedUpdateManyInput = {},
) {
  const claimed = await transaction.pricingRuleSet.updateMany({
    where: {
      id: ruleSetId,
      status: "DRAFT",
      draftVersion: expectedVersion,
    },
    data: {
      ...data,
      draftVersion: { increment: 1 },
    },
  });
  if (claimed.count !== 1) {
    throw new PricingConflictError(
      "The pricing draft changed after this page loaded. Reload before continuing.",
    );
  }
}

function applicabilityFromInput(input: PricingRuleInput) {
  return {
    scope: input.scope,
    engineType:
      input.scope === "ENGINE_TYPE"
        ? (input.engineType as CatalogueEngineType)
        : null,
    categoryId: input.scope === "CATEGORY" ? input.categoryId : null,
    serviceId: input.scope === "SERVICE" ? input.serviceId : null,
  };
}

async function assertScopeTarget(
  transaction: Prisma.TransactionClient,
  input: PricingRuleInput,
) {
  if (input.scope === "CATEGORY") {
    const category = await transaction.catalogueCategory.findUnique({
      where: { id: input.categoryId! },
      select: { id: true },
    });
    if (!category) throw new PricingTransitionError("Category not found.");
  }
  if (input.scope === "SERVICE") {
    const service = await transaction.catalogueService.findUnique({
      where: { id: input.serviceId! },
      select: { id: true },
    });
    if (!service) throw new PricingTransitionError("Service not found.");
  }
}

function changedScope(
  previous: {
    applicability: Array<{
      scope: PricingScope;
      engineType: unknown;
      categoryId: string | null;
      serviceId: string | null;
    }>;
  },
  current: ReturnType<typeof applicabilityFromInput>,
) {
  const item = previous.applicability[0];
  return (
    !item ||
    item.scope !== current.scope ||
    item.engineType !== current.engineType ||
    item.categoryId !== current.categoryId ||
    item.serviceId !== current.serviceId
  );
}

function ruleData(input: PricingRuleInput) {
  return {
    publicLabel: input.publicLabel,
    internalDescription: input.internalDescription,
    enabled: input.enabled,
    ruleType: input.ruleType,
    amountCents:
      input.ruleType === "PERCENTAGE_ADDITION" ? null : input.amountCents,
    valueBps: input.ruleType === "PERCENTAGE_ADDITION" ? input.valueBps : null,
    priority: input.priority,
    exclusiveGroupKey: input.exclusiveGroupKey,
    effectiveStart: input.effectiveStart,
    effectiveEnd: input.effectiveEnd,
    needsClientReview: input.needsClientReview,
  };
}

export async function savePricingRule({
  input,
  actorId,
  expectedDraftVersion,
  ruleId,
  expectedRuleVersion,
}: {
  input: PricingRuleInput;
  actorId: string;
  expectedDraftVersion: number;
  ruleId?: string;
  expectedRuleVersion?: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const draft = await ensureDraftPricingRuleSet(transaction);
    if (draft.id !== input.ruleSetId) {
      throw new PricingConflictError("Pricing draft not found.");
    }
    await assertScopeTarget(transaction, input);
    const applicability = applicabilityFromInput(input);
    await claimDraft(transaction, draft.id, expectedDraftVersion);

    if (ruleId) {
      const previous = await transaction.pricingRule.findUnique({
        where: { id: ruleId },
        include: { applicability: true },
      });
      if (!previous || previous.ruleSetId !== draft.id) {
        throw new PricingConflictError("Pricing rule not found.");
      }
      const update = await transaction.pricingRule.updateMany({
        where: {
          id: ruleId,
          ruleSetId: draft.id,
          version: expectedRuleVersion,
        },
        data: {
          ...ruleData(input),
          version: { increment: 1 },
        },
      });
      if (update.count !== 1) {
        throw new PricingConflictError(
          "This pricing rule changed after the editor opened. Reload before saving.",
        );
      }
      await transaction.pricingRuleApplicability.deleteMany({
        where: { ruleId },
      });
      await transaction.pricingRuleApplicability.create({
        data: { ruleId, ...applicability },
      });
      const action =
        previous.enabled !== input.enabled
          ? input.enabled
            ? "pricing.rule.enabled"
            : "pricing.rule.disabled"
          : changedScope(previous, applicability)
            ? "pricing.rule.scope_changed"
            : previous.effectiveStart?.getTime() !==
                  input.effectiveStart?.getTime() ||
                previous.effectiveEnd?.getTime() !==
                  input.effectiveEnd?.getTime()
              ? "pricing.rule.effective_dates_changed"
              : "pricing.rule.updated";
      await transaction.auditLog.create({
        data: {
          actorId,
          action,
          targetType: "PricingRule",
          targetId: ruleId,
          metadata: auditMetadata({
            ruleSetId: draft.id,
            draftVersion: expectedDraftVersion + 1,
            ruleType: input.ruleType,
            scope: input.scope,
          }),
        },
      });
      return { id: ruleId };
    }

    const created = await transaction.pricingRule.create({
      data: {
        ruleSetId: draft.id,
        ...ruleData(input),
        applicability: { create: applicability },
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "pricing.rule.created",
        targetType: "PricingRule",
        targetId: created.id,
        metadata: auditMetadata({
          ruleSetId: draft.id,
          draftVersion: expectedDraftVersion + 1,
          ruleType: input.ruleType,
          scope: input.scope,
        }),
      },
    });
    return { id: created.id };
  });
}

async function draftWithRules(transaction: Prisma.TransactionClient) {
  const draft = await ensureDraftPricingRuleSet(transaction);
  return transaction.pricingRuleSet.findUniqueOrThrow({
    where: { id: draft.id },
    include: {
      rules: {
        orderBy: [{ priority: "asc" }, { id: "asc" }],
        include: { applicability: true },
      },
    },
  });
}

async function latestRevisionNumber(
  transaction: Prisma.TransactionClient,
  ruleSetId: string,
) {
  const latest = await transaction.pricingRevision.findFirst({
    where: { ruleSetId },
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true },
  });
  return latest?.revisionNumber ?? 0;
}

export async function publishPricingDraft({
  actorId,
  expectedDraftVersion,
}: {
  actorId: string;
  expectedDraftVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const draft = await draftWithRules(transaction);
    const revisionNumber =
      (await latestRevisionNumber(transaction, draft.id)) + 1;
    const revisionId = stableId();
    const publishedAt = new Date();
    const snapshot = publishedRevisionSnapshot({
      ruleSetId: draft.id,
      revisionId,
      revisionNumber,
      currencyCode: draft.currencyCode,
      publishedAt,
      rules: draft.rules,
    });
    await claimDraft(transaction, draft.id, expectedDraftVersion, {
      publishedAt,
      publishedById: actorId,
    });
    await transaction.pricingRevision.create({
      data: {
        id: revisionId,
        ruleSetId: draft.id,
        revisionNumber,
        snapshot: jsonSnapshot(snapshot),
        publishedAt,
        publishedById: actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "pricing.draft.published",
        targetType: "PricingRuleSet",
        targetId: draft.id,
        metadata: auditMetadata({
          revisionId,
          revisionNumber,
          ruleCount: draft.rules.length,
        }),
      },
    });
    return { revisionId, revisionNumber };
  });
}

async function createDraftRulesFromSnapshot({
  transaction,
  ruleSetId,
  rules,
}: {
  transaction: Prisma.TransactionClient;
  ruleSetId: string;
  rules: PricingRuleSnapshot[];
}) {
  await transaction.pricingRule.deleteMany({ where: { ruleSetId } });
  for (const rule of rules) {
    await transaction.pricingRule.create({
      data: {
        id: rule.id,
        ruleSetId,
        publicLabel: rule.publicLabel,
        internalDescription: null,
        enabled: rule.enabled,
        ruleType: rule.ruleType,
        amountCents: rule.amountCents,
        valueBps: rule.valueBps,
        priority: rule.priority,
        exclusiveGroupKey: rule.exclusiveGroupKey,
        effectiveStart: rule.effectiveStart
          ? new Date(rule.effectiveStart)
          : null,
        effectiveEnd: rule.effectiveEnd ? new Date(rule.effectiveEnd) : null,
        needsClientReview: true,
        applicability: {
          create: rule.applicability.map((item) => ({
            scope: item.scope,
            engineType: item.engineType ?? null,
            categoryId: item.categoryId ?? null,
            serviceId: item.serviceId ?? null,
          })),
        },
      },
    });
  }
}

async function latestSnapshot(transaction: Prisma.TransactionClient) {
  const revision = await transaction.pricingRevision.findFirst({
    orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
    select: { snapshot: true },
  });
  if (!revision) return null;
  return normalizePublishedPricingRevision(revision.snapshot);
}

export async function discardPricingDraft({
  actorId,
  expectedDraftVersion,
}: {
  actorId: string;
  expectedDraftVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const draft = await ensureDraftPricingRuleSet(transaction);
    await claimDraft(transaction, draft.id, expectedDraftVersion);
    const snapshot = await latestSnapshot(transaction);
    await createDraftRulesFromSnapshot({
      transaction,
      ruleSetId: draft.id,
      rules: snapshot?.rules ?? [],
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "pricing.draft.discarded",
        targetType: "PricingRuleSet",
        targetId: draft.id,
        metadata: auditMetadata({
          restoredRevision: snapshot?.revisionNumber ?? null,
        }),
      },
    });
  });
}

export async function restorePricingRevision({
  revisionId,
  actorId,
  expectedDraftVersion,
}: {
  revisionId: string;
  actorId: string;
  expectedDraftVersion: number;
}) {
  return prisma.$transaction(async (transaction) => {
    const draft = await ensureDraftPricingRuleSet(transaction);
    const revision = await transaction.pricingRevision.findUnique({
      where: { id: revisionId },
      select: { snapshot: true, revisionNumber: true },
    });
    if (!revision)
      throw new PricingTransitionError("Pricing revision not found.");
    const snapshot = normalizePublishedPricingRevision(revision.snapshot);
    await claimDraft(transaction, draft.id, expectedDraftVersion);
    await createDraftRulesFromSnapshot({
      transaction,
      ruleSetId: draft.id,
      rules: snapshot.rules,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "pricing.revision.restored_to_draft",
        targetType: "PricingRevision",
        targetId: revisionId,
        metadata: auditMetadata({
          ruleSetId: draft.id,
          revisionNumber: revision.revisionNumber,
        }),
      },
    });
  });
}

export function pricingActionErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Check the submitted values.";
  }
  if (
    error instanceof PricingConflictError ||
    error instanceof PricingTransitionError ||
    error instanceof PricingValidationError
  ) {
    return error.message;
  }
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (code === "P2002") return "That pricing rule identifier already exists.";
    if (code === "P2003")
      return "This pricing record is still referenced and cannot be removed.";
    if (code === "P2025") return "This pricing record no longer exists.";
  }
  console.error("[pricing:action]", error);
  return "The pricing action could not be completed. Please try again.";
}

export function draftRuleSnapshot(rule: PricingRuleWithApplicability) {
  return pricingRuleSnapshot(rule);
}

type PricingRuleWithApplicability = Prisma.PricingRuleGetPayload<{
  include: { applicability: true };
}>;
