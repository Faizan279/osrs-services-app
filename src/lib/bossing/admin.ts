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
  type StagedBossingBoss,
  type StagedBossingGearRequirement,
  type StagedBossingMethod,
  type StagedBossingRule,
  type StagedBossingStatRequirement,
  type StagedCatalogueAggregate,
} from "@/lib/catalogue/staging";
import { prisma } from "@/lib/db/prisma";
import {
  bossingPriceModes,
  bossingPublicStatMetricKeys,
} from "@/lib/bossing/constants";

const optionalTrimmedString = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

const centsSchema = z.coerce.number().int().min(0).max(100_000_000);
const bpsSchema = z.coerce.number().int().min(0).max(100_000);

export const bossingRuleInputSchema = z.object({
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

export const bossingBossInputSchema = z.object({
  serviceId: z.string().min(1).max(30),
  bossKey: z
    .string()
    .trim()
    .min(1)
    .transform(normalizeSlug)
    .pipe(z.string().min(2).max(120)),
  name: z.string().trim().min(2).max(160),
  enabled: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  groupLabel: optionalTrimmedString(120),
  iconKey: optionalTrimmedString(80),
  description: optionalTrimmedString(20_000),
  needsClientReview: z.boolean(),
});

export const bossingStatRequirementInputSchema = z.object({
  metricKey: z.enum(bossingPublicStatMetricKeys),
  label: z.string().trim().min(2).max(160),
  requiredLevel: z.coerce.number().int().min(1).max(2_277),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  verificationMode: z.literal("AUTOMATIC"),
  customerGuidance: optionalTrimmedString(10_000),
  needsClientReview: z.boolean(),
});

export const bossingGearRequirementInputSchema = z.object({
  label: z.string().trim().min(2).max(160),
  description: z.string().trim().min(5).max(10_000),
  isRequired: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  verificationMode: z.enum(["CUSTOMER_CONFIRMED", "SUPPORT_VERIFIED"]),
  customerGuidance: optionalTrimmedString(10_000),
  needsClientReview: z.boolean(),
});

export const bossingMethodInputSchema = z
  .object({
    serviceId: z.string().min(1).max(30),
    bossId: z.string().min(1).max(30),
    slug: z
      .string()
      .trim()
      .min(1)
      .transform(normalizeSlug)
      .pipe(z.string().min(2).max(180)),
    name: z.string().trim().min(2).max(160),
    shortDescription: z.string().trim().min(10).max(500),
    enabled: z.boolean(),
    displayOrder: z.coerce.number().int().min(0).max(100_000),
    priceMode: z.enum(bossingPriceModes),
    minimumKillCount: z.coerce.number().int().min(1).max(1_000_000),
    maximumKillCount: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().min(1).max(1_000_000).optional(),
    ),
    basePriceCentsPerKill: centsSchema,
    fixedPackagePriceCents: centsSchema,
    minimumPriceCents: centsSchema,
    setupFeeCents: centsSchema,
    difficultyTierLabel: optionalTrimmedString(120),
    expectedRequirementsSummary: optionalTrimmedString(500),
    gearNotes: optionalTrimmedString(20_000),
    supplyNotes: optionalTrimmedString(20_000),
    suppliesEnabled: z.boolean(),
    suppliesLabel: optionalTrimmedString(120),
    suppliesFeeCents: centsSchema,
    customerGearRequired: z.boolean(),
    customerGearLabel: optionalTrimmedString(160),
    gearAdjustmentCents: centsSchema,
    estimatedKillsPerHour: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.coerce.number().int().positive().max(100_000).optional(),
    ),
    needsClientReview: z.boolean(),
    statRequirements: z.array(bossingStatRequirementInputSchema),
    gearRequirements: z.array(bossingGearRequirementInputSchema),
  })
  .superRefine((value, context) => {
    if (
      value.maximumKillCount != null &&
      value.maximumKillCount < value.minimumKillCount
    ) {
      context.addIssue({
        code: "custom",
        path: ["maximumKillCount"],
        message: "Maximum kill count cannot be lower than minimum kill count.",
      });
    }
    if (value.priceMode === "PER_KILL" && value.basePriceCentsPerKill <= 0) {
      context.addIssue({
        code: "custom",
        path: ["basePriceCentsPerKill"],
        message: "Per-kill methods need a positive per-kill rate.",
      });
    }
    if (
      value.priceMode === "FIXED_PACKAGE" &&
      value.fixedPackagePriceCents <= 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["fixedPackagePriceCents"],
        message: "Fixed packages need a positive package price.",
      });
    }
    if (value.suppliesEnabled && !value.suppliesLabel) {
      context.addIssue({
        code: "custom",
        path: ["suppliesLabel"],
        message: "Supply-enabled methods need a label.",
      });
    }
    if (value.customerGearRequired && !value.customerGearLabel) {
      context.addIssue({
        code: "custom",
        path: ["customerGearLabel"],
        message: "Gear-confirmation methods need a label.",
      });
    }
  });

type BossingRuleInput = z.infer<typeof bossingRuleInputSchema>;
type BossingBossInput = z.infer<typeof bossingBossInputSchema>;
type BossingMethodInput = z.infer<typeof bossingMethodInputSchema>;

function stagedId() {
  return `stg${randomUUID().replaceAll("-", "").slice(0, 27)}`;
}

function auditMetadata(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function ensureBossingAggregate(snapshot: StagedCatalogueAggregate) {
  if (snapshot.service.engineType !== "BOSSING_ENGINE") {
    throw new CatalogueTransitionError(
      "Bossing configuration is only available for bossing engine services.",
    );
  }
  return stagedCatalogueAggregateSchema.parse({
    ...snapshot,
    bossing: snapshot.bossing ?? { rule: null, bosses: [] },
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
      engineType: "BOSSING_ENGINE",
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
  input: BossingRuleInput,
  existing?: StagedBossingRule | null,
): StagedBossingRule {
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

function bossFromInput(
  input: BossingBossInput,
  id: string,
  existing?: StagedBossingBoss,
): StagedBossingBoss {
  return {
    id,
    seededKey: existing?.seededKey ?? null,
    bossKey: input.bossKey,
    name: input.name,
    enabled: input.enabled,
    displayOrder: input.displayOrder,
    groupLabel: input.groupLabel ?? null,
    iconKey: input.iconKey ?? null,
    description: input.description ?? null,
    needsClientReview: input.needsClientReview,
    methods: existing?.methods ?? [],
  };
}

function statRequirementFromInput(
  input: BossingMethodInput["statRequirements"][number],
  existing?: StagedBossingStatRequirement,
): StagedBossingStatRequirement {
  return {
    id: existing?.id ?? stagedId(),
    seededKey: existing?.seededKey ?? null,
    metricKey: input.metricKey,
    label: input.label,
    requiredLevel: input.requiredLevel,
    displayOrder: input.displayOrder,
    verificationMode: input.verificationMode,
    customerGuidance: input.customerGuidance ?? null,
    needsClientReview: input.needsClientReview,
  };
}

function gearRequirementFromInput(
  input: BossingMethodInput["gearRequirements"][number],
  existing?: StagedBossingGearRequirement,
): StagedBossingGearRequirement {
  return {
    id: existing?.id ?? stagedId(),
    seededKey: existing?.seededKey ?? null,
    label: input.label,
    description: input.description,
    isRequired: input.isRequired,
    displayOrder: input.displayOrder,
    verificationMode: input.verificationMode,
    customerGuidance: input.customerGuidance ?? null,
    needsClientReview: input.needsClientReview,
  };
}

function methodFromInput(
  input: BossingMethodInput,
  id: string,
  existing?: StagedBossingMethod,
): StagedBossingMethod {
  return {
    id,
    seededKey: existing?.seededKey ?? null,
    slug: input.slug,
    name: input.name,
    shortDescription: input.shortDescription,
    enabled: input.enabled,
    displayOrder: input.displayOrder,
    priceMode: input.priceMode,
    minimumKillCount: input.minimumKillCount,
    maximumKillCount: input.maximumKillCount ?? null,
    basePriceCentsPerKill: input.basePriceCentsPerKill,
    fixedPackagePriceCents: input.fixedPackagePriceCents,
    minimumPriceCents: input.minimumPriceCents,
    setupFeeCents: input.setupFeeCents,
    difficultyTierLabel: input.difficultyTierLabel ?? null,
    expectedRequirementsSummary: input.expectedRequirementsSummary ?? null,
    gearNotes: input.gearNotes ?? null,
    supplyNotes: input.supplyNotes ?? null,
    suppliesEnabled: input.suppliesEnabled,
    suppliesLabel: input.suppliesEnabled ? (input.suppliesLabel ?? null) : null,
    suppliesFeeCents: input.suppliesEnabled ? input.suppliesFeeCents : 0,
    customerGearRequired: input.customerGearRequired,
    customerGearLabel: input.customerGearRequired
      ? (input.customerGearLabel ?? null)
      : null,
    gearAdjustmentCents: input.customerGearRequired
      ? input.gearAdjustmentCents
      : 0,
    estimatedKillsPerHour: input.estimatedKillsPerHour ?? null,
    needsClientReview: input.needsClientReview,
    statRequirements: input.statRequirements.map((requirement, index) =>
      statRequirementFromInput(
        {
          ...requirement,
          displayOrder: requirement.displayOrder || (index + 1) * 10,
        },
        existing?.statRequirements[index],
      ),
    ),
    gearRequirements: input.gearRequirements.map((requirement, index) =>
      gearRequirementFromInput(
        {
          ...requirement,
          displayOrder: requirement.displayOrder || (index + 1) * 10,
        },
        existing?.gearRequirements[index],
      ),
    ),
  };
}

function bossAction(
  previous: StagedBossingBoss | undefined,
  current: StagedBossingBoss,
) {
  if (!previous) return "catalogue.bossing.boss_created";
  if (previous.enabled !== current.enabled) {
    return current.enabled
      ? "catalogue.bossing.boss_enabled"
      : "catalogue.bossing.boss_disabled";
  }
  if (previous.displayOrder !== current.displayOrder) {
    return "catalogue.bossing.boss_reordered";
  }
  return "catalogue.bossing.boss_updated";
}

function methodAction(
  previous: StagedBossingMethod | undefined,
  current: StagedBossingMethod,
) {
  if (!previous) return "catalogue.bossing.method_created";
  if (previous.enabled !== current.enabled) {
    return current.enabled
      ? "catalogue.bossing.method_enabled"
      : "catalogue.bossing.method_disabled";
  }
  if (previous.displayOrder !== current.displayOrder) {
    return "catalogue.bossing.method_reordered";
  }
  if (
    JSON.stringify(previous.statRequirements) !==
    JSON.stringify(current.statRequirements)
  ) {
    return "catalogue.bossing.stat_requirement_updated";
  }
  if (
    JSON.stringify(previous.gearRequirements) !==
    JSON.stringify(current.gearRequirements)
  ) {
    return "catalogue.bossing.gear_requirement_updated";
  }
  return "catalogue.bossing.method_updated";
}

export async function saveBossingRule(
  input: BossingRuleInput,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    if (service.engineType !== "BOSSING_ENGINE") {
      throw new CatalogueTransitionError(
        "This service does not use the bossing engine.",
      );
    }
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = ensureBossingAggregate(editableSnapshot(service));
      const next = stagedCatalogueAggregateSchema.parse({
        ...snapshot,
        bossing: {
          ...snapshot.bossing!,
          rule: ruleFromInput(input, snapshot.bossing?.rule),
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
          action: "catalogue.bossing.rule_updated",
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
    const rule = ruleFromInput(input, service.bossingRule ?? null);
    const { id: _ruleId, ...ruleUpdate } = rule;
    void _ruleId;
    await transaction.bossingCalculatorRule.upsert({
      where: { serviceId: input.serviceId },
      create: { ...rule, serviceId: input.serviceId },
      update: ruleUpdate,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.bossing.rule_updated",
        targetType: "CatalogueService",
        targetId: input.serviceId,
        metadata: auditMetadata({ staged: false }),
      },
    });
    return { staged: false };
  });
}

export async function saveBossingBoss(
  input: BossingBossInput,
  actorId: string,
  expectedVersion: number,
  bossId?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    const id = bossId ?? stagedId();
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = ensureBossingAggregate(editableSnapshot(service));
      const previous = snapshot.bossing!.bosses.find((boss) => boss.id === id);
      if (bossId && !previous)
        throw new CatalogueConflictError("Boss not found.");
      const current = bossFromInput(input, id, previous);
      const next = stagedCatalogueAggregateSchema.parse({
        ...snapshot,
        bossing: {
          ...snapshot.bossing!,
          bosses: [
            ...snapshot.bossing!.bosses.filter((boss) => boss.id !== id),
            current,
          ],
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
          action: bossAction(previous, current),
          targetType: "BossingBossConfig",
          targetId: id,
          metadata: auditMetadata({
            serviceId: input.serviceId,
            staged: true,
            stageVersion: persisted.version,
          }),
        },
      });
      return { id, staged: true };
    }

    await claimDraftService(
      transaction,
      input.serviceId,
      actorId,
      expectedVersion,
    );
    const previous = bossId
      ? await transaction.bossingBossConfig.findFirst({
          where: { id: bossId, serviceId: input.serviceId },
          include: { methods: true },
        })
      : null;
    if (bossId && !previous)
      throw new CatalogueConflictError("Boss not found.");
    const data = {
      bossKey: input.bossKey,
      name: input.name,
      enabled: input.enabled,
      displayOrder: input.displayOrder,
      groupLabel: input.groupLabel ?? null,
      iconKey: input.iconKey ?? null,
      description: input.description ?? null,
      needsClientReview: input.needsClientReview,
    };
    const boss = bossId
      ? await transaction.bossingBossConfig.update({
          where: { id: bossId },
          data,
          include: { methods: true },
        })
      : await transaction.bossingBossConfig.create({
          data: { ...data, serviceId: input.serviceId },
          include: { methods: true },
        });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: bossAction(
          previous
            ? {
                ...previous,
                methods: [],
                seededKey: previous.seededKey,
                groupLabel: previous.groupLabel,
                iconKey: previous.iconKey,
                description: previous.description,
              }
            : undefined,
          { ...boss, methods: [] },
        ),
        targetType: "BossingBossConfig",
        targetId: boss.id,
        metadata: auditMetadata({ serviceId: input.serviceId, staged: false }),
      },
    });
    return { id: boss.id, staged: false };
  });
}

export async function saveBossingMethod(
  input: BossingMethodInput,
  actorId: string,
  expectedVersion: number,
  methodId?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    const id = methodId ?? stagedId();
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = ensureBossingAggregate(editableSnapshot(service));
      const targetBoss = snapshot.bossing!.bosses.find(
        (boss) => boss.id === input.bossId,
      );
      if (!targetBoss) throw new CatalogueConflictError("Boss not found.");
      const previous = snapshot
        .bossing!.bosses.flatMap((boss) => boss.methods)
        .find((method) => method.id === methodId);
      if (methodId && !previous)
        throw new CatalogueConflictError("Method not found.");
      const current = methodFromInput(input, id, previous);
      const next = stagedCatalogueAggregateSchema.parse({
        ...snapshot,
        bossing: {
          ...snapshot.bossing!,
          bosses: snapshot.bossing!.bosses.map((boss) => ({
            ...boss,
            methods:
              boss.id === input.bossId
                ? [
                    ...boss.methods.filter((method) => method.id !== id),
                    current,
                  ]
                : boss.methods.filter((method) => method.id !== id),
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
          targetType: "BossingMethod",
          targetId: id,
          metadata: auditMetadata({
            serviceId: input.serviceId,
            bossId: input.bossId,
            staged: true,
            stageVersion: persisted.version,
          }),
        },
      });
      return { id, staged: true };
    }

    const boss = await transaction.bossingBossConfig.findFirst({
      where: { id: input.bossId, serviceId: input.serviceId },
    });
    if (!boss) throw new CatalogueConflictError("Boss not found.");
    const previous = methodId
      ? await transaction.bossingMethod.findFirst({
          where: { id: methodId, serviceId: input.serviceId },
          include: { statRequirements: true, gearRequirements: true },
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
    const current = methodFromInput(input, methodId ?? stagedId());
    const data = {
      bossId: input.bossId,
      slug: current.slug,
      name: current.name,
      shortDescription: current.shortDescription,
      enabled: current.enabled,
      displayOrder: current.displayOrder,
      priceMode: current.priceMode,
      minimumKillCount: current.minimumKillCount,
      maximumKillCount: current.maximumKillCount,
      basePriceCentsPerKill: current.basePriceCentsPerKill,
      fixedPackagePriceCents: current.fixedPackagePriceCents,
      minimumPriceCents: current.minimumPriceCents,
      setupFeeCents: current.setupFeeCents,
      difficultyTierLabel: current.difficultyTierLabel,
      expectedRequirementsSummary: current.expectedRequirementsSummary,
      gearNotes: current.gearNotes,
      supplyNotes: current.supplyNotes,
      suppliesEnabled: current.suppliesEnabled,
      suppliesLabel: current.suppliesLabel,
      suppliesFeeCents: current.suppliesFeeCents,
      customerGearRequired: current.customerGearRequired,
      customerGearLabel: current.customerGearLabel,
      gearAdjustmentCents: current.gearAdjustmentCents,
      estimatedKillsPerHour: current.estimatedKillsPerHour,
      needsClientReview: current.needsClientReview,
    };
    const method = methodId
      ? await transaction.bossingMethod.update({
          where: { id: methodId },
          data: {
            ...data,
            statRequirements: {
              deleteMany: {},
              create: current.statRequirements,
            },
            gearRequirements: {
              deleteMany: {},
              create: current.gearRequirements,
            },
          },
        })
      : await transaction.bossingMethod.create({
          data: {
            id: current.id,
            serviceId: input.serviceId,
            ...data,
            statRequirements: { create: current.statRequirements },
            gearRequirements: { create: current.gearRequirements },
          },
        });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: methodAction(
          previous
            ? {
                ...previous,
                statRequirements: previous.statRequirements,
                gearRequirements: previous.gearRequirements,
              }
            : undefined,
          current,
        ),
        targetType: "BossingMethod",
        targetId: method.id,
        metadata: auditMetadata({
          serviceId: input.serviceId,
          bossId: input.bossId,
          staged: false,
        }),
      },
    });
    return { id: method.id, staged: false };
  });
}

export function methodBelongsToBoss(
  boss: { methods: Array<{ id: string }> },
  methodId: string,
) {
  return boss.methods.some((method) => method.id === methodId);
}
