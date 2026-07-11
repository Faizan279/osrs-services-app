import "server-only";

import { randomUUID } from "node:crypto";
import { z } from "zod";

import { Prisma } from "@/generated/prisma/client";
import {
  CatalogueConflictError,
  CatalogueTransitionError,
} from "@/lib/catalogue/errors";
import { normalizeSlug } from "@/lib/catalogue/validation";
import {
  editableSnapshot,
  loadServiceAggregate,
  persistServiceStage,
} from "@/lib/catalogue/staging-repository";
import {
  stagedCatalogueAggregateSchema,
  type StagedCatalogueAggregate,
  type StagedSkillingMethod,
  type StagedSkillingRule,
  type StagedSkillingSkill,
} from "@/lib/catalogue/staging";
import { prisma } from "@/lib/db/prisma";
import { skillingSkillKeys } from "@/lib/skilling/constants";

const optionalTrimmedString = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

const centsSchema = z.coerce.number().int().min(0).max(100_000_000);
const bpsSchema = z.coerce.number().int().min(0).max(100_000);

export const skillingSkillInputSchema = z.object({
  serviceId: z.string().min(1).max(30),
  skillId: z.string().min(1).max(30),
  name: z.string().trim().min(2).max(80),
  enabled: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  iconKey: optionalTrimmedString(80),
});

export const skillingMethodInputSchema = z
  .object({
    serviceId: z.string().min(1).max(30),
    skillConfigId: z.string().min(1).max(30),
    slug: z
      .string()
      .trim()
      .min(1)
      .transform(normalizeSlug)
      .pipe(z.string().min(2)),
    name: z.string().trim().min(2).max(160),
    shortDescription: z.string().trim().min(10).max(500),
    enabled: z.boolean(),
    displayOrder: z.coerce.number().int().min(0).max(100_000),
    minimumLevel: z.coerce.number().int().min(1).max(99),
    maximumLevel: z.coerce.number().int().min(1).max(99),
    xpPerHour: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().positive().max(10_000_000).optional(),
    ),
    basePriceCentsPerMillionXp: centsSchema,
    minimumPriceCents: centsSchema,
    fixedFeeCents: centsSchema,
    suppliesEnabled: z.boolean(),
    suppliesLabel: optionalTrimmedString(120),
    suppliesFeeCents: centsSchema,
    notes: optionalTrimmedString(20_000),
    needsClientReview: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.maximumLevel < value.minimumLevel) {
      context.addIssue({
        code: "custom",
        path: ["maximumLevel"],
        message: "Maximum level cannot be lower than minimum level.",
      });
    }
    if (value.suppliesEnabled && !value.suppliesLabel) {
      context.addIssue({
        code: "custom",
        path: ["suppliesLabel"],
        message: "Supply-enabled methods need a label.",
      });
    }
  });

export const skillingRuleInputSchema = z.object({
  serviceId: z.string().min(1).max(30),
  normalModeMultiplierBps: bpsSchema,
  ironmanMultiplierBps: bpsSchema,
  hardcoreIronmanMultiplierBps: bpsSchema,
  ultimateIronmanMultiplierBps: bpsSchema,
  discordStreamEnabled: z.boolean(),
  discordStreamPercentBps: bpsSchema,
  standardDeliveryEnabled: z.boolean(),
  standardDeliveryLabel: z.string().trim().min(2).max(80),
  standardDeliveryDescription: optionalTrimmedString(240),
  standardDeliveryEstimate: optionalTrimmedString(120),
  standardDeliveryMultiplierBps: bpsSchema,
  standardDeliveryFixedFeeCents: centsSchema,
  priorityDeliveryEnabled: z.boolean(),
  priorityDeliveryLabel: z.string().trim().min(2).max(80),
  priorityDeliveryDescription: optionalTrimmedString(240),
  priorityDeliveryEstimate: optionalTrimmedString(120),
  priorityDeliveryMultiplierBps: bpsSchema,
  priorityDeliveryFixedFeeCents: centsSchema,
  expressDeliveryEnabled: z.boolean(),
  expressDeliveryLabel: z.string().trim().min(2).max(80),
  expressDeliveryDescription: optionalTrimmedString(240),
  expressDeliveryEstimate: optionalTrimmedString(120),
  expressDeliveryMultiplierBps: bpsSchema,
  expressDeliveryFixedFeeCents: centsSchema,
  needsClientReview: z.boolean(),
});

type SkillingSkillInput = z.infer<typeof skillingSkillInputSchema>;
type SkillingMethodInput = z.infer<typeof skillingMethodInputSchema>;
type SkillingRuleInput = z.infer<typeof skillingRuleInputSchema>;

function stagedId() {
  return `stg${randomUUID().replaceAll("-", "").slice(0, 27)}`;
}

function auditMetadata(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function ensureSkillingAggregate(snapshot: StagedCatalogueAggregate) {
  if (snapshot.service.engineType !== "SKILLING_CALCULATOR") {
    throw new CatalogueTransitionError(
      "Skilling configuration is only available for skilling calculator services.",
    );
  }
  return stagedCatalogueAggregateSchema.parse({
    ...snapshot,
    skilling: snapshot.skilling ?? { rule: null, skills: [] },
  });
}

async function claimDraftService(
  transaction: Prisma.TransactionClient,
  serviceId: string,
  actorId: string,
  expectedVersion: number,
) {
  const claimed = await transaction.catalogueService.updateMany({
    where: {
      id: serviceId,
      version: expectedVersion,
      publicationStatus: { not: "PUBLISHED" },
      engineType: "SKILLING_CALCULATOR",
    },
    data: { updatedById: actorId, version: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    throw new CatalogueConflictError(
      "This service changed after the editor was opened. Reload before continuing.",
    );
  }
}

function ruleFromInput(
  input: SkillingRuleInput,
  existing?: StagedSkillingRule | null,
): StagedSkillingRule {
  const { serviceId: _serviceId, ...rule } = input;
  void _serviceId;
  return {
    id: existing?.id ?? stagedId(),
    ...rule,
    standardDeliveryDescription: input.standardDeliveryDescription ?? null,
    standardDeliveryEstimate: input.standardDeliveryEstimate ?? null,
    priorityDeliveryDescription: input.priorityDeliveryDescription ?? null,
    priorityDeliveryEstimate: input.priorityDeliveryEstimate ?? null,
    expressDeliveryDescription: input.expressDeliveryDescription ?? null,
    expressDeliveryEstimate: input.expressDeliveryEstimate ?? null,
  };
}

function skillFromInput(
  input: SkillingSkillInput,
  existing: StagedSkillingSkill,
): StagedSkillingSkill {
  return {
    ...existing,
    name: input.name,
    enabled: input.enabled,
    displayOrder: input.displayOrder,
    iconKey: input.iconKey ?? null,
  };
}

function methodFromInput(
  input: SkillingMethodInput,
  id: string,
  existing?: StagedSkillingMethod,
): StagedSkillingMethod {
  return {
    id,
    seededKey: existing?.seededKey ?? null,
    slug: input.slug,
    name: input.name,
    shortDescription: input.shortDescription,
    enabled: input.enabled,
    displayOrder: input.displayOrder,
    minimumLevel: input.minimumLevel,
    maximumLevel: input.maximumLevel,
    xpPerHour: input.xpPerHour ?? null,
    basePriceCentsPerMillionXp: input.basePriceCentsPerMillionXp,
    minimumPriceCents: input.minimumPriceCents,
    fixedFeeCents: input.fixedFeeCents,
    suppliesEnabled: input.suppliesEnabled,
    suppliesLabel: input.suppliesEnabled ? (input.suppliesLabel ?? null) : null,
    suppliesFeeCents: input.suppliesEnabled ? input.suppliesFeeCents : 0,
    notes: input.notes ?? null,
    needsClientReview: input.needsClientReview,
  };
}

function skillAction(
  previous: StagedSkillingSkill,
  current: StagedSkillingSkill,
) {
  if (previous.enabled !== current.enabled) {
    return current.enabled
      ? "catalogue.skilling.skill_enabled"
      : "catalogue.skilling.skill_disabled";
  }
  if (previous.displayOrder !== current.displayOrder) {
    return "catalogue.skilling.skill_reordered";
  }
  return "catalogue.skilling.skill_updated";
}

function methodAction(
  previous: StagedSkillingMethod | undefined,
  current: StagedSkillingMethod,
) {
  if (!previous) return "catalogue.skilling.method_created";
  if (previous.enabled !== current.enabled) {
    return current.enabled
      ? "catalogue.skilling.method_enabled"
      : "catalogue.skilling.method_disabled";
  }
  if (previous.displayOrder !== current.displayOrder) {
    return "catalogue.skilling.method_reordered";
  }
  return "catalogue.skilling.method_updated";
}

export async function saveSkillingRule(
  input: SkillingRuleInput,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    if (service.engineType !== "SKILLING_CALCULATOR") {
      throw new CatalogueTransitionError(
        "This service does not use the skilling calculator engine.",
      );
    }
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = ensureSkillingAggregate(editableSnapshot(service));
      const next = stagedCatalogueAggregateSchema.parse({
        ...snapshot,
        skilling: {
          ...snapshot.skilling!,
          rule: ruleFromInput(input, snapshot.skilling?.rule),
        },
      });
      const persisted = await persistServiceStage({
        transaction,
        service,
        snapshot: next,
        actorId,
        expectedVersion,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.skilling.rule_updated",
          targetType: "CatalogueService",
          targetId: input.serviceId,
          metadata: auditMetadata({
            staged: true,
            stageVersion: persisted.version,
          }),
        },
      });
      return { staged: true };
    }

    await claimDraftService(
      transaction,
      input.serviceId,
      actorId,
      expectedVersion,
    );
    const rule = ruleFromInput(input, service.skillingRule ?? null);
    const { id: _ruleId, ...ruleUpdate } = rule;
    void _ruleId;
    await transaction.skillingCalculatorRule.upsert({
      where: { serviceId: input.serviceId },
      create: { ...rule, serviceId: input.serviceId },
      update: ruleUpdate,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.skilling.rule_updated",
        targetType: "CatalogueService",
        targetId: input.serviceId,
        metadata: auditMetadata({ staged: false }),
      },
    });
    return { staged: false };
  });
}

export async function saveSkillingSkill(
  input: SkillingSkillInput,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = ensureSkillingAggregate(editableSnapshot(service));
      const previous = snapshot.skilling!.skills.find(
        (skill) => skill.id === input.skillId,
      );
      if (!previous) throw new CatalogueConflictError("Skill not found.");
      const current = skillFromInput(input, previous);
      const next = stagedCatalogueAggregateSchema.parse({
        ...snapshot,
        skilling: {
          ...snapshot.skilling!,
          skills: snapshot.skilling!.skills.map((skill) =>
            skill.id === input.skillId ? current : skill,
          ),
        },
      });
      const persisted = await persistServiceStage({
        transaction,
        service,
        snapshot: next,
        actorId,
        expectedVersion,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: skillAction(previous, current),
          targetType: "SkillingSkillConfig",
          targetId: input.skillId,
          metadata: auditMetadata({
            serviceId: input.serviceId,
            staged: true,
            stageVersion: persisted.version,
          }),
        },
      });
      return { staged: true };
    }

    const previous = await transaction.skillingSkillConfig.findFirst({
      where: { id: input.skillId, serviceId: input.serviceId },
    });
    if (!previous) throw new CatalogueConflictError("Skill not found.");
    await claimDraftService(
      transaction,
      input.serviceId,
      actorId,
      expectedVersion,
    );
    const current = await transaction.skillingSkillConfig.update({
      where: { id: input.skillId },
      data: {
        name: input.name,
        enabled: input.enabled,
        displayOrder: input.displayOrder,
        iconKey: input.iconKey ?? null,
      },
      include: { methods: true },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: skillAction({ ...previous, methods: [] }, current),
        targetType: "SkillingSkillConfig",
        targetId: input.skillId,
        metadata: auditMetadata({ serviceId: input.serviceId, staged: false }),
      },
    });
    return { staged: false };
  });
}

export async function saveSkillingMethod(
  input: SkillingMethodInput,
  actorId: string,
  expectedVersion: number,
  methodId?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = ensureSkillingAggregate(editableSnapshot(service));
      const targetSkill = snapshot.skilling!.skills.find(
        (skill) => skill.id === input.skillConfigId,
      );
      if (!targetSkill) throw new CatalogueConflictError("Skill not found.");
      const previous = snapshot
        .skilling!.skills.flatMap((skill) => skill.methods)
        .find((method) => method.id === methodId);
      if (methodId && !previous)
        throw new CatalogueConflictError("Method not found.");
      const id = methodId ?? stagedId();
      const current = methodFromInput(input, id, previous);
      const next = stagedCatalogueAggregateSchema.parse({
        ...snapshot,
        skilling: {
          ...snapshot.skilling!,
          skills: snapshot.skilling!.skills.map((skill) => ({
            ...skill,
            methods:
              skill.id === input.skillConfigId
                ? [
                    ...skill.methods.filter((method) => method.id !== id),
                    current,
                  ]
                : skill.methods.filter((method) => method.id !== id),
          })),
        },
      });
      const persisted = await persistServiceStage({
        transaction,
        service,
        snapshot: next,
        actorId,
        expectedVersion,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: methodAction(previous, current),
          targetType: "SkillingTrainingMethod",
          targetId: id,
          metadata: auditMetadata({
            serviceId: input.serviceId,
            skillConfigId: input.skillConfigId,
            staged: true,
            stageVersion: persisted.version,
          }),
        },
      });
      return { id, staged: true };
    }

    const skill = await transaction.skillingSkillConfig.findFirst({
      where: { id: input.skillConfigId, serviceId: input.serviceId },
    });
    if (!skill) throw new CatalogueConflictError("Skill not found.");
    const previous = methodId
      ? await transaction.skillingTrainingMethod.findFirst({
          where: { id: methodId, serviceId: input.serviceId },
        })
      : null;
    if (methodId && !previous)
      throw new CatalogueConflictError("Method not found.");
    await claimDraftService(
      transaction,
      input.serviceId,
      actorId,
      expectedVersion,
    );
    const data = {
      skillConfigId: input.skillConfigId,
      slug: input.slug,
      name: input.name,
      shortDescription: input.shortDescription,
      enabled: input.enabled,
      displayOrder: input.displayOrder,
      minimumLevel: input.minimumLevel,
      maximumLevel: input.maximumLevel,
      xpPerHour: input.xpPerHour ?? null,
      basePriceCentsPerMillionXp: input.basePriceCentsPerMillionXp,
      minimumPriceCents: input.minimumPriceCents,
      fixedFeeCents: input.fixedFeeCents,
      suppliesEnabled: input.suppliesEnabled,
      suppliesLabel: input.suppliesEnabled
        ? (input.suppliesLabel ?? null)
        : null,
      suppliesFeeCents: input.suppliesEnabled ? input.suppliesFeeCents : 0,
      notes: input.notes ?? null,
      needsClientReview: input.needsClientReview,
    };
    const method = methodId
      ? await transaction.skillingTrainingMethod.update({
          where: { id: methodId },
          data,
        })
      : await transaction.skillingTrainingMethod.create({
          data: { ...data, serviceId: input.serviceId },
        });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: methodAction(previous ?? undefined, method),
        targetType: "SkillingTrainingMethod",
        targetId: method.id,
        metadata: auditMetadata({
          serviceId: input.serviceId,
          skillConfigId: input.skillConfigId,
          staged: false,
        }),
      },
    });
    return { id: method.id, staged: false };
  });
}

export function methodBelongsToSkill(
  skill: { methods: Array<{ id: string }> },
  methodId: string,
) {
  return skill.methods.some((method) => method.id === methodId);
}

export function sortedSkillingSkills(
  skills: Array<{
    skillKey: (typeof skillingSkillKeys)[number];
    displayOrder: number;
  }>,
) {
  return [...skills].sort(
    (left, right) =>
      left.displayOrder - right.displayOrder ||
      skillingSkillKeys.indexOf(left.skillKey) -
        skillingSkillKeys.indexOf(right.skillKey),
  );
}
