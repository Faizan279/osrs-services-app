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
  type StagedPremiumFaq,
  type StagedPremiumOption,
  type StagedPremiumPackage,
  type StagedPremiumRequirement,
  type StagedPremiumRequirementGroup,
  type StagedPremiumRule,
} from "@/lib/catalogue/staging";
import { prisma } from "@/lib/db/prisma";
import {
  premiumOptionPricingModes,
  premiumOptionTypes,
  premiumPublicStatMetricKeys,
} from "@/lib/premium/constants";

const optionalTrimmedString = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

const optionalInt = (minimum: number, maximum: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(minimum).max(maximum).optional(),
  );

const centsSchema = z.coerce.number().int().min(0).max(100_000_000);
const bpsSchema = z.coerce.number().int().min(0).max(100_000);

export const premiumRuleInputSchema = z.object({
  serviceId: z.string().min(1).max(30),
  normalModeMultiplierBps: bpsSchema,
  ironmanMultiplierBps: bpsSchema,
  hardcoreIronmanMultiplierBps: bpsSchema,
  ultimateIronmanMultiplierBps: bpsSchema,
  discordStreamEnabled: z.boolean(),
  discordStreamPercentBps: bpsSchema,
  rsnEligibilityEnabled: z.boolean(),
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

export const premiumRequirementInputSchema = z
  .object({
    label: z.string().trim().min(2).max(160),
    description: z.string().trim().min(5).max(10_000),
    isRequired: z.boolean(),
    displayOrder: z.coerce.number().int().min(0).max(100_000),
    verificationMode: z.enum([
      "AUTOMATIC",
      "CUSTOMER_CONFIRMED",
      "SUPPORT_VERIFIED",
    ]),
    metricKey: optionalTrimmedString(120),
    requiredValue: optionalInt(1, 2_277),
    customerGuidance: optionalTrimmedString(10_000),
    needsClientReview: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.verificationMode === "AUTOMATIC") {
      if (
        !value.metricKey ||
        !premiumPublicStatMetricKeys.includes(value.metricKey as never)
      ) {
        context.addIssue({
          code: "custom",
          path: ["metricKey"],
          message: "Choose a supported public premium statistic.",
        });
      }
      if (value.requiredValue == null) {
        context.addIssue({
          code: "custom",
          path: ["requiredValue"],
          message: "Automatic requirements need a required level.",
        });
      }
    }
    if (
      value.verificationMode !== "AUTOMATIC" &&
      (value.metricKey || value.requiredValue != null)
    ) {
      context.addIssue({
        code: "custom",
        path: ["verificationMode"],
        message: "Only automatic requirements can use public-stat rules.",
      });
    }
  });

export const premiumRequirementGroupInputSchema = z.object({
  title: z.string().trim().min(2).max(160),
  description: optionalTrimmedString(20_000),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  needsClientReview: z.boolean(),
  requirements: z.array(premiumRequirementInputSchema),
});

export const premiumFaqInputSchema = z.object({
  question: z.string().trim().min(5).max(240),
  answer: z.string().trim().min(10).max(10_000),
  enabled: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  needsClientReview: z.boolean(),
});

export const premiumPackageInputSchema = z
  .object({
    serviceId: z.string().min(1).max(30),
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
    basePriceCents: centsSchema,
    minimumPriceCents: centsSchema,
    setupFeeCents: centsSchema,
    estimatedHours: optionalInt(1, 100_000),
    difficultyTierLabel: optionalTrimmedString(120),
    requirementsSummary: optionalTrimmedString(500),
    gearNotes: optionalTrimmedString(20_000),
    unlockNotes: optionalTrimmedString(20_000),
    customerGearRequired: z.boolean(),
    customerGearLabel: optionalTrimmedString(160),
    gearUnconfirmedAdjustmentCents: centsSchema,
    needsClientReview: z.boolean(),
    requirementGroups: z.array(premiumRequirementGroupInputSchema),
    faqs: z.array(premiumFaqInputSchema),
  })
  .superRefine((value, context) => {
    if (value.customerGearRequired && !value.customerGearLabel) {
      context.addIssue({
        code: "custom",
        path: ["customerGearLabel"],
        message: "Gear-confirmation packages need a customer-facing label.",
      });
    }
  });

export const premiumOptionInputSchema = z
  .object({
    serviceId: z.string().min(1).max(30),
    packageId: optionalTrimmedString(30),
    slug: z
      .string()
      .trim()
      .min(1)
      .transform(normalizeSlug)
      .pipe(z.string().min(2)),
    name: z.string().trim().min(2).max(160),
    description: z.string().trim().min(10).max(500),
    enabled: z.boolean(),
    displayOrder: z.coerce.number().int().min(0).max(100_000),
    optionType: z.enum(premiumOptionTypes),
    pricingMode: z.enum(premiumOptionPricingModes),
    fixedPriceCents: centsSchema,
    percentBps: bpsSchema,
    perUnitPriceCents: centsSchema,
    minimumQuantity: z.coerce.number().int().min(1).max(1_000_000),
    maximumQuantity: z.coerce.number().int().min(1).max(1_000_000),
    defaultQuantity: z.coerce.number().int().min(1).max(1_000_000),
    customerInputRequired: z.boolean(),
    needsClientReview: z.boolean(),
  })
  .superRefine((value, context) => {
    if (value.maximumQuantity < value.minimumQuantity) {
      context.addIssue({
        code: "custom",
        path: ["maximumQuantity"],
        message: "Maximum quantity cannot be lower than minimum quantity.",
      });
    }
    if (
      value.defaultQuantity < value.minimumQuantity ||
      value.defaultQuantity > value.maximumQuantity
    ) {
      context.addIssue({
        code: "custom",
        path: ["defaultQuantity"],
        message: "Default quantity must fit inside the configured bounds.",
      });
    }
    if (value.pricingMode === "FIXED_FEE" && value.fixedPriceCents <= 0) {
      context.addIssue({
        code: "custom",
        path: ["fixedPriceCents"],
        message: "Fixed-fee options need a positive price.",
      });
    }
    if (value.pricingMode === "PERCENT_OF_BASE" && value.percentBps <= 0) {
      context.addIssue({
        code: "custom",
        path: ["percentBps"],
        message: "Percentage options need positive basis points.",
      });
    }
    if (value.pricingMode === "PER_UNIT" && value.perUnitPriceCents <= 0) {
      context.addIssue({
        code: "custom",
        path: ["perUnitPriceCents"],
        message: "Per-unit options need a positive unit price.",
      });
    }
  });

type PremiumRuleInput = z.infer<typeof premiumRuleInputSchema>;
type PremiumPackageInput = z.infer<typeof premiumPackageInputSchema>;
type PremiumOptionInput = z.infer<typeof premiumOptionInputSchema>;

function stagedId() {
  return `stg${randomUUID().replaceAll("-", "").slice(0, 27)}`;
}

function auditMetadata(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function ensurePremiumAggregate(snapshot: StagedCatalogueAggregate) {
  if (snapshot.service.engineType !== "PREMIUM_SERVICE_CONFIGURATOR") {
    throw new CatalogueTransitionError(
      "Premium configuration is only available for premium service configurators.",
    );
  }
  return stagedCatalogueAggregateSchema.parse({
    ...snapshot,
    premium: snapshot.premium ?? { rule: null, packages: [], options: [] },
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
      engineType: "PREMIUM_SERVICE_CONFIGURATOR",
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
  input: PremiumRuleInput,
  existing?: StagedPremiumRule | null,
): StagedPremiumRule {
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

function requirementFromInput(
  input: z.infer<typeof premiumRequirementInputSchema>,
  existing?: StagedPremiumRequirement,
): StagedPremiumRequirement {
  return {
    id: existing?.id ?? stagedId(),
    seededKey: existing?.seededKey ?? null,
    label: input.label,
    description: input.description,
    isRequired: input.isRequired,
    displayOrder: input.displayOrder,
    verificationMode: input.verificationMode,
    metricKey:
      input.verificationMode === "AUTOMATIC" ? (input.metricKey ?? null) : null,
    requiredValue:
      input.verificationMode === "AUTOMATIC"
        ? (input.requiredValue ?? null)
        : null,
    customerGuidance: input.customerGuidance ?? null,
    needsClientReview: input.needsClientReview,
  };
}

function requirementGroupFromInput(
  input: z.infer<typeof premiumRequirementGroupInputSchema>,
  existing?: StagedPremiumRequirementGroup,
): StagedPremiumRequirementGroup {
  return {
    id: existing?.id ?? stagedId(),
    seededKey: existing?.seededKey ?? null,
    title: input.title,
    description: input.description ?? null,
    displayOrder: input.displayOrder,
    needsClientReview: input.needsClientReview,
    requirements: input.requirements.map((requirement) =>
      requirementFromInput(
        requirement,
        existing?.requirements.find((item) => item.label === requirement.label),
      ),
    ),
  };
}

function faqFromInput(
  input: z.infer<typeof premiumFaqInputSchema>,
  existing?: StagedPremiumFaq,
): StagedPremiumFaq {
  return {
    id: existing?.id ?? stagedId(),
    seededKey: existing?.seededKey ?? null,
    question: input.question,
    answer: input.answer,
    enabled: input.enabled,
    displayOrder: input.displayOrder,
    needsClientReview: input.needsClientReview,
  };
}

function packageFromInput(
  input: PremiumPackageInput,
  id: string,
  existing?: StagedPremiumPackage,
): StagedPremiumPackage {
  return {
    id,
    seededKey: existing?.seededKey ?? null,
    slug: input.slug,
    name: input.name,
    shortDescription: input.shortDescription,
    enabled: input.enabled,
    displayOrder: input.displayOrder,
    basePriceCents: input.basePriceCents,
    minimumPriceCents: input.minimumPriceCents,
    setupFeeCents: input.setupFeeCents,
    estimatedHours: input.estimatedHours ?? null,
    difficultyTierLabel: input.difficultyTierLabel ?? null,
    requirementsSummary: input.requirementsSummary ?? null,
    gearNotes: input.gearNotes ?? null,
    unlockNotes: input.unlockNotes ?? null,
    customerGearRequired: input.customerGearRequired,
    customerGearLabel: input.customerGearRequired
      ? (input.customerGearLabel ?? null)
      : null,
    gearUnconfirmedAdjustmentCents: input.customerGearRequired
      ? input.gearUnconfirmedAdjustmentCents
      : 0,
    needsClientReview: input.needsClientReview,
    requirementGroups: input.requirementGroups.map((group) =>
      requirementGroupFromInput(
        group,
        existing?.requirementGroups.find((item) => item.title === group.title),
      ),
    ),
    faqs: input.faqs.map((faq) =>
      faqFromInput(
        faq,
        existing?.faqs.find((item) => item.question === faq.question),
      ),
    ),
  };
}

function optionFromInput(
  input: PremiumOptionInput,
  id: string,
  existing?: StagedPremiumOption,
): StagedPremiumOption {
  return {
    id,
    seededKey: existing?.seededKey ?? null,
    packageId: input.packageId ?? null,
    slug: input.slug,
    name: input.name,
    description: input.description,
    enabled: input.enabled,
    displayOrder: input.displayOrder,
    optionType: input.optionType,
    pricingMode: input.pricingMode,
    fixedPriceCents:
      input.pricingMode === "FIXED_FEE" ? input.fixedPriceCents : 0,
    percentBps: input.pricingMode === "PERCENT_OF_BASE" ? input.percentBps : 0,
    perUnitPriceCents:
      input.pricingMode === "PER_UNIT" ? input.perUnitPriceCents : 0,
    minimumQuantity: input.minimumQuantity,
    maximumQuantity: input.maximumQuantity,
    defaultQuantity: input.defaultQuantity,
    customerInputRequired: input.customerInputRequired,
    needsClientReview: input.needsClientReview,
  };
}

function packageAction(
  previous: StagedPremiumPackage | undefined,
  current: StagedPremiumPackage,
) {
  if (!previous) return "catalogue.premium.package_created";
  if (previous.enabled !== current.enabled) {
    return current.enabled
      ? "catalogue.premium.package_enabled"
      : "catalogue.premium.package_disabled";
  }
  if (previous.displayOrder !== current.displayOrder) {
    return "catalogue.premium.package_reordered";
  }
  if (
    JSON.stringify(previous.requirementGroups) !==
    JSON.stringify(current.requirementGroups)
  ) {
    return "catalogue.premium.requirements_updated";
  }
  if (JSON.stringify(previous.faqs) !== JSON.stringify(current.faqs)) {
    return "catalogue.premium.faqs_updated";
  }
  return "catalogue.premium.package_updated";
}

function optionAction(
  previous: StagedPremiumOption | undefined,
  current: StagedPremiumOption,
) {
  if (!previous) return "catalogue.premium.option_created";
  if (previous.enabled !== current.enabled) {
    return current.enabled
      ? "catalogue.premium.option_enabled"
      : "catalogue.premium.option_disabled";
  }
  if (previous.displayOrder !== current.displayOrder) {
    return "catalogue.premium.option_reordered";
  }
  return "catalogue.premium.option_updated";
}

async function ensureDraftConfig(
  transaction: Prisma.TransactionClient,
  serviceId: string,
) {
  const existing = await transaction.premiumServiceConfig.findUnique({
    where: { serviceId },
  });
  if (existing) return existing;
  return transaction.premiumServiceConfig.create({
    data: {
      serviceId,
      standardDeliveryDescription: "Standard review queue for premium work.",
      standardDeliveryEstimate: "Estimate confirmed before checkout",
      priorityDeliveryDescription: "Faster queue when staff capacity allows.",
      priorityDeliveryEstimate: "Faster estimate, client review required",
      expressDeliveryDescription:
        "Fastest configured queue for eligible premium work.",
      expressDeliveryEstimate: "Fastest estimate, client review required",
    },
  });
}

export async function savePremiumRule(
  input: PremiumRuleInput,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    if (service.engineType !== "PREMIUM_SERVICE_CONFIGURATOR") {
      throw new CatalogueTransitionError(
        "This service does not use the premium service configurator.",
      );
    }
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = ensurePremiumAggregate(editableSnapshot(service));
      const next = stagedCatalogueAggregateSchema.parse({
        ...snapshot,
        premium: {
          ...snapshot.premium!,
          rule: ruleFromInput(input, snapshot.premium?.rule),
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
          action: "catalogue.premium.rule_updated",
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
    const rule = ruleFromInput(input, service.premiumConfig ?? null);
    const { id: _ruleId, ...ruleUpdate } = rule;
    void _ruleId;
    await transaction.premiumServiceConfig.upsert({
      where: { serviceId: input.serviceId },
      create: { ...rule, serviceId: input.serviceId },
      update: ruleUpdate,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.premium.rule_updated",
        targetType: "CatalogueService",
        targetId: input.serviceId,
        metadata: auditMetadata({ staged: false }),
      },
    });
    return { staged: false };
  });
}

export async function savePremiumPackage(
  input: PremiumPackageInput,
  actorId: string,
  expectedVersion: number,
  packageId?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = ensurePremiumAggregate(editableSnapshot(service));
      const previous = snapshot.premium!.packages.find(
        (item) => item.id === packageId,
      );
      if (packageId && !previous)
        throw new CatalogueConflictError("Premium package not found.");
      const id = packageId ?? stagedId();
      const current = packageFromInput(input, id, previous);
      const next = stagedCatalogueAggregateSchema.parse({
        ...snapshot,
        premium: {
          ...snapshot.premium!,
          packages: [
            ...snapshot.premium!.packages.filter((item) => item.id !== id),
            current,
          ],
          options: snapshot.premium!.options.map((option) =>
            packageId && option.packageId === packageId
              ? { ...option, packageId: id }
              : option,
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
          action: packageAction(previous, current),
          targetType: "PremiumPackage",
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
    const config = await ensureDraftConfig(transaction, input.serviceId);
    const previous = packageId
      ? await transaction.premiumPackage.findFirst({
          where: { id: packageId, serviceId: input.serviceId },
          include: {
            requirementGroups: { include: { requirements: true } },
            faqs: true,
          },
        })
      : null;
    if (packageId && !previous)
      throw new CatalogueConflictError("Premium package not found.");
    const current = packageFromInput(
      input,
      packageId ?? stagedId(),
      previous ?? undefined,
    );
    const data = {
      serviceId: input.serviceId,
      configId: config.id,
      slug: current.slug,
      name: current.name,
      shortDescription: current.shortDescription,
      enabled: current.enabled,
      displayOrder: current.displayOrder,
      basePriceCents: current.basePriceCents,
      minimumPriceCents: current.minimumPriceCents,
      setupFeeCents: current.setupFeeCents,
      estimatedHours: current.estimatedHours,
      difficultyTierLabel: current.difficultyTierLabel,
      requirementsSummary: current.requirementsSummary,
      gearNotes: current.gearNotes,
      unlockNotes: current.unlockNotes,
      customerGearRequired: current.customerGearRequired,
      customerGearLabel: current.customerGearLabel,
      gearUnconfirmedAdjustmentCents: current.gearUnconfirmedAdjustmentCents,
      needsClientReview: current.needsClientReview,
    };
    const saved = packageId
      ? await transaction.premiumPackage.update({
          where: { id: packageId },
          data: {
            ...data,
            requirementGroups: { deleteMany: {} },
            faqs: { deleteMany: {} },
          },
        })
      : await transaction.premiumPackage.create({
          data: { id: current.id, ...data },
        });
    for (const group of current.requirementGroups) {
      await transaction.premiumRequirementGroup.create({
        data: {
          id: group.id,
          serviceId: input.serviceId,
          configId: config.id,
          packageId: saved.id,
          seededKey: group.seededKey,
          title: group.title,
          description: group.description,
          displayOrder: group.displayOrder,
          needsClientReview: group.needsClientReview,
          requirements: {
            create: group.requirements.map((requirement) => ({
              id: requirement.id,
              seededKey: requirement.seededKey,
              label: requirement.label,
              description: requirement.description,
              isRequired: requirement.isRequired,
              displayOrder: requirement.displayOrder,
              verificationMode: requirement.verificationMode,
              metricKey: requirement.metricKey,
              requiredValue: requirement.requiredValue,
              customerGuidance: requirement.customerGuidance,
              needsClientReview: requirement.needsClientReview,
            })),
          },
        },
      });
    }
    if (current.faqs.length) {
      await transaction.premiumFaq.createMany({
        data: current.faqs.map((faq) => ({
          id: faq.id,
          serviceId: input.serviceId,
          configId: config.id,
          packageId: saved.id,
          seededKey: faq.seededKey,
          question: faq.question,
          answer: faq.answer,
          enabled: faq.enabled,
          displayOrder: faq.displayOrder,
          needsClientReview: faq.needsClientReview,
        })),
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: packageAction(previous ?? undefined, current),
        targetType: "PremiumPackage",
        targetId: saved.id,
        metadata: auditMetadata({ serviceId: input.serviceId, staged: false }),
      },
    });
    return { id: saved.id, staged: false };
  });
}

export async function savePremiumOption(
  input: PremiumOptionInput,
  actorId: string,
  expectedVersion: number,
  optionId?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = ensurePremiumAggregate(editableSnapshot(service));
      if (
        input.packageId &&
        !snapshot.premium!.packages.some((item) => item.id === input.packageId)
      ) {
        throw new CatalogueConflictError("Premium package not found.");
      }
      const previous = snapshot.premium!.options.find(
        (item) => item.id === optionId,
      );
      if (optionId && !previous)
        throw new CatalogueConflictError("Premium option not found.");
      const id = optionId ?? stagedId();
      const current = optionFromInput(input, id, previous);
      const next = stagedCatalogueAggregateSchema.parse({
        ...snapshot,
        premium: {
          ...snapshot.premium!,
          options: [
            ...snapshot.premium!.options.filter((item) => item.id !== id),
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
          action: optionAction(previous, current),
          targetType: "PremiumOption",
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
    const config = await ensureDraftConfig(transaction, input.serviceId);
    if (input.packageId) {
      const owner = await transaction.premiumPackage.findFirst({
        where: { id: input.packageId, serviceId: input.serviceId },
      });
      if (!owner)
        throw new CatalogueConflictError("Premium package not found.");
    }
    const previous = optionId
      ? await transaction.premiumOption.findFirst({
          where: { id: optionId, serviceId: input.serviceId },
        })
      : null;
    if (optionId && !previous)
      throw new CatalogueConflictError("Premium option not found.");
    const current = optionFromInput(
      input,
      optionId ?? stagedId(),
      previous ?? undefined,
    );
    const data = {
      serviceId: input.serviceId,
      configId: config.id,
      packageId: current.packageId,
      slug: current.slug,
      name: current.name,
      description: current.description,
      enabled: current.enabled,
      displayOrder: current.displayOrder,
      optionType: current.optionType,
      pricingMode: current.pricingMode,
      fixedPriceCents: current.fixedPriceCents,
      percentBps: current.percentBps,
      perUnitPriceCents: current.perUnitPriceCents,
      minimumQuantity: current.minimumQuantity,
      maximumQuantity: current.maximumQuantity,
      defaultQuantity: current.defaultQuantity,
      customerInputRequired: current.customerInputRequired,
      needsClientReview: current.needsClientReview,
    };
    const saved = optionId
      ? await transaction.premiumOption.update({
          where: { id: optionId },
          data,
        })
      : await transaction.premiumOption.create({
          data: { id: current.id, ...data },
        });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: optionAction(previous ?? undefined, current),
        targetType: "PremiumOption",
        targetId: saved.id,
        metadata: auditMetadata({ serviceId: input.serviceId, staged: false }),
      },
    });
    return { id: saved.id, staged: false };
  });
}

export function premiumPackageOwnsOption(
  packageId: string,
  option: { packageId: string | null },
) {
  return option.packageId === null || option.packageId === packageId;
}
