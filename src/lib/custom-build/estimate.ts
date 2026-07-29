import { z } from "zod";

import type {
  CatalogueGameMode,
  CustomBuildEstimateState,
  CustomBuildObjectiveType,
  CustomBuildPricingMode,
  SkillingSkillKey,
} from "@/generated/prisma/client";
import {
  CUSTOM_BUILD_ESTIMATE_SNAPSHOT_SCHEMA_VERSION,
  CUSTOM_BUILD_REVISION_SCHEMA_VERSION,
  customBuildEstimateStates,
  customBuildObjectiveTypes,
  customBuildPricingModes,
  customBuildSkillLabels,
  customBuildSkillValueModes,
} from "@/lib/custom-build/constants";
import {
  applyBasisPoints,
  assertMoneyCents,
  formatCents,
  type PricingLine,
} from "@/lib/pricing/engine";
import {
  calculateLevelProgress,
  calculateXpProgress,
  xpForLevel,
} from "@/lib/skilling/xp";

const MAX_MONEY_CENTS = 100_000_000;
const MILLION = 1_000_000n;

const gameModeSchema = z.enum([
  "NORMAL",
  "IRONMAN",
  "HARDCORE_IRONMAN",
  "ULTIMATE_IRONMAN",
]) as z.ZodType<CatalogueGameMode>;

const skillKeySchema = z.enum([
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
]) as z.ZodType<SkillingSkillKey>;

const pricingModeSchema = z.enum(
  customBuildPricingModes,
) as z.ZodType<CustomBuildPricingMode>;

const objectiveTypeSchema = z.enum(
  customBuildObjectiveTypes,
) as z.ZodType<CustomBuildObjectiveType>;

const moneySchema = z.number().int().min(0).max(MAX_MONEY_CENTS);

const skillRuleSchema = z.object({
  stableKey: z.string().min(1).max(160),
  skillKey: skillKeySchema,
  pricingMode: pricingModeSchema,
  gameMode: gameModeSchema.nullable(),
  minimumLevel: z.number().int().min(1).max(99).nullable(),
  maximumLevel: z.number().int().min(1).max(99).nullable(),
  minimumXp: z.string().regex(/^\d+$/).nullable(),
  maximumXp: z.string().regex(/^\d+$/).nullable(),
  centsPerMillionXp: z.number().int().min(0).max(MAX_MONEY_CENTS).nullable(),
  levelBandStart: z.number().int().min(1).max(99).nullable(),
  levelBandEnd: z.number().int().min(1).max(99).nullable(),
  fixedPriceCents: moneySchema.nullable(),
  minimumPriceCents: moneySchema,
  enabled: z.boolean(),
  manualReviewOnly: z.boolean(),
  needsClientReview: z.boolean(),
});

const objectiveSchema = z.object({
  stableKey: z.string().min(1).max(160),
  objectiveType: objectiveTypeSchema,
  objectiveKey: z.string().min(1).max(120),
  publicName: z.string().min(1).max(180),
  publicDescription: z.string().min(1),
  objectiveGroup: z.string().max(120).nullable(),
  difficultyTier: z.string().max(80).nullable(),
  gameMode: gameModeSchema.nullable(),
  prerequisiteText: z.string().nullable(),
  sortOrder: z.number().int(),
  enabled: z.boolean(),
  needsClientReview: z.boolean(),
});

const objectiveRuleSchema = z.object({
  stableKey: z.string().min(1).max(160),
  objectiveStableKey: z.string().min(1).max(160),
  pricingMode: pricingModeSchema,
  fixedPriceCents: moneySchema.nullable(),
  percentBps: z.number().int().min(0).max(100_000).nullable(),
  gameMode: gameModeSchema.nullable(),
  manualReviewOnly: z.boolean(),
  enabled: z.boolean(),
  needsClientReview: z.boolean(),
});

const revisionSchema = z.object({
  schemaVersion: z.literal(CUSTOM_BUILD_REVISION_SCHEMA_VERSION),
  service: z.object({
    id: z.string().min(1).max(30),
    stableKey: z.string().min(1).max(120),
    slug: z.string().min(1).max(180),
    serviceId: z.string().min(1).max(30),
    serviceSlug: z.string().min(1).max(180),
    categoryId: z.string().min(1).max(30),
    categorySlug: z.string().max(180).nullable(),
    publicName: z.string().min(1).max(160),
    currencyCode: z.string().length(3),
    minimumAutomaticEstimateCents: moneySchema,
    maximumAutomaticEstimateCents: moneySchema.nullable(),
    validForMinutes: z
      .number()
      .int()
      .min(5)
      .max(60 * 24 * 30),
  }),
  revision: z.object({
    id: z.string().min(1).max(30),
    revisionNumber: z.number().int().min(1),
    publishedAt: z.iso.datetime(),
  }),
  skillRules: z.array(skillRuleSchema),
  objectives: z.array(objectiveSchema),
  objectiveRules: z.array(objectiveRuleSchema),
});

const publicSkillSelectionSchema = z.object({
  skillKey: skillKeySchema,
  valueMode: z.enum(customBuildSkillValueModes),
  currentLevel: z.number().int().min(1).max(99).nullable(),
  targetLevel: z.number().int().min(1).max(99).nullable(),
  currentXp: z.string().regex(/^\d+$/).nullable(),
  targetXp: z.string().regex(/^\d+$/).nullable(),
  xpRequired: z.string().regex(/^\d+$/).nullable(),
  freshStart: z.boolean(),
});

const publicObjectiveSelectionSchema = z.object({
  stableKey: z.string().min(1).max(160),
  objectiveType: objectiveTypeSchema,
  publicName: z.string().min(1).max(180),
  customerAlreadyCompleted: z.boolean(),
});

const pricingLineSchema = z.object({
  label: z.string().min(1).max(160),
  amountCents: z.number().int().min(-MAX_MONEY_CENTS).max(MAX_MONEY_CENTS),
  ruleId: z.string().max(160).optional(),
});

const estimateSnapshotSchema = z.object({
  schemaVersion: z.literal(CUSTOM_BUILD_ESTIMATE_SNAPSHOT_SCHEMA_VERSION),
  service: z.object({
    stableKey: z.string().min(1).max(120),
    slug: z.string().min(1).max(180),
    serviceId: z.string().min(1).max(30),
    serviceSlug: z.string().min(1).max(180),
    categoryId: z.string().min(1).max(30),
    categorySlug: z.string().max(180).nullable(),
  }),
  currency: z.string().length(3),
  gameMode: gameModeSchema,
  skillSelections: z.array(publicSkillSelectionSchema),
  objectiveSelections: z.array(publicObjectiveSelectionSchema),
  estimateLines: z.array(pricingLineSchema),
  automaticSubtotalCents: moneySchema.nullable(),
  globalPricingAdjustmentLines: z.array(pricingLineSchema),
  estimatedTotalCents: moneySchema.nullable(),
  estimateState: z.enum(customBuildEstimateStates),
  manualReviewReasons: z.array(
    z.object({
      code: z.string().min(1).max(80),
      message: z.string().min(1).max(240),
    }),
  ),
  publishedCustomBuildRevision: z.object({
    id: z.string().min(1).max(30),
    revisionNumber: z.number().int().min(1),
  }),
  publishedGlobalPricingRevision: z
    .object({
      id: z.string().min(1).max(30),
      revisionNumber: z.number().int().min(1),
    })
    .nullable(),
  generatedAt: z.iso.datetime(),
  validUntil: z.iso.datetime(),
  repricingRequired: z.boolean(),
  reviewRequired: z.boolean(),
});

export class CustomBuildEstimateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomBuildEstimateError";
  }
}

export type PublishedCustomBuildRevisionSnapshotV1 = z.infer<
  typeof revisionSchema
>;
export type CustomBuildEstimateSnapshotV1 = z.infer<
  typeof estimateSnapshotSchema
>;
export type CustomBuildSkillSelectionInput = {
  skillKey: SkillingSkillKey;
  valueMode: (typeof customBuildSkillValueModes)[number];
  currentLevel?: number | null;
  targetLevel?: number | null;
  currentXp?: number | string | bigint | null;
  targetXp?: number | string | bigint | null;
  freshStart?: boolean;
};
export type CustomBuildObjectiveSelectionInput = {
  stableKey: string;
  customerAlreadyCompleted?: boolean;
};
export type ManualReviewReason = {
  code: string;
  message: string;
};
export type CustomBuildEstimateResult = {
  state: CustomBuildEstimateState;
  currency: string;
  estimateLines: PricingLine[];
  globalPricingAdjustmentLines: PricingLine[];
  automaticSubtotalCents: number | null;
  estimatedTotalCents: number | null;
  estimatedTotal: string | null;
  manualReviewReasons: ManualReviewReason[];
  snapshot: CustomBuildEstimateSnapshotV1;
  validUntil: Date;
  finalPriceNote: string;
};

function toBigInt(value: number | string | bigint | null | undefined) {
  if (value == null || value === "") return null;
  if (typeof value === "bigint") return value;
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new CustomBuildEstimateError("XP values must be safe integers.");
    }
    return BigInt(value);
  }
  if (!/^\d+$/.test(value)) {
    throw new CustomBuildEstimateError("XP values must be whole numbers.");
  }
  return BigInt(value);
}

function safeBigIntToNumber(value: bigint, label: string) {
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new CustomBuildEstimateError(`${label} is too large.`);
  }
  return Number(value);
}

function moneyFromBigInt(value: bigint, label: string) {
  if (value < 0n || value > BigInt(MAX_MONEY_CENTS)) {
    throw new CustomBuildEstimateError(`${label} is outside the safe range.`);
  }
  return Number(value);
}

function roundXpPrice(xpRequired: bigint, centsPerMillionXp: number) {
  if (centsPerMillionXp < 0) {
    throw new CustomBuildEstimateError("Skill pricing cannot be negative.");
  }
  return moneyFromBigInt(
    (xpRequired * BigInt(centsPerMillionXp) + MILLION / 2n) / MILLION,
    "Skill price",
  );
}

function checkedAdd(left: number, right: number) {
  assertMoneyCents(left, "Subtotal");
  assertMoneyCents(right, "Line amount");
  const value = left + right;
  assertMoneyCents(value, "Subtotal");
  return value;
}

function normalizeRevision(value: unknown) {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new CustomBuildEstimateError(
      "Custom-build revision snapshot is malformed.",
    );
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new CustomBuildEstimateError(
      "Unknown custom-build revision snapshot schema version.",
    );
  }
  const parsed = revisionSchema.safeParse(value);
  if (!parsed.success) {
    throw new CustomBuildEstimateError(
      "Custom-build revision snapshot is malformed.",
    );
  }
  return parsed.data;
}

export function normalizeCustomBuildEstimateSnapshot(
  value: unknown,
): CustomBuildEstimateSnapshotV1 {
  if (
    typeof value !== "object" ||
    value === null ||
    !("schemaVersion" in value)
  ) {
    throw new CustomBuildEstimateError(
      "Custom-build estimate snapshot is malformed.",
    );
  }
  if ((value as { schemaVersion?: unknown }).schemaVersion !== 1) {
    throw new CustomBuildEstimateError(
      "Unknown custom-build estimate snapshot schema version.",
    );
  }
  const parsed = estimateSnapshotSchema.safeParse(value);
  if (!parsed.success) {
    throw new CustomBuildEstimateError(
      "Custom-build estimate snapshot is malformed.",
    );
  }
  return parsed.data;
}

function validateSkillSelection(input: CustomBuildSkillSelectionInput) {
  const valueMode = input.valueMode;
  if (valueMode === "LEVEL") {
    if (input.currentLevel == null || input.targetLevel == null) {
      throw new CustomBuildEstimateError(
        "Enter both current and target levels.",
      );
    }
    const progress = calculateLevelProgress({
      currentLevel: input.currentLevel,
      targetLevel: input.targetLevel,
    });
    return {
      skillKey: input.skillKey,
      valueMode,
      currentLevel: progress.currentLevel,
      targetLevel: progress.targetLevel,
      currentXp: BigInt(progress.currentXp),
      targetXp: BigInt(progress.targetXp),
      xpRequired: BigInt(progress.xpRequired),
      freshStart: false,
    };
  }
  if (valueMode === "XP") {
    const currentXp = toBigInt(input.currentXp);
    const targetXp = toBigInt(input.targetXp);
    if (currentXp == null || targetXp == null) {
      throw new CustomBuildEstimateError("Enter both current and target XP.");
    }
    const progress = calculateXpProgress({
      currentXp: safeBigIntToNumber(currentXp, "Current XP"),
      targetXp: safeBigIntToNumber(targetXp, "Target XP"),
    });
    return {
      skillKey: input.skillKey,
      valueMode,
      currentLevel: progress.currentLevel,
      targetLevel: progress.targetLevel,
      currentXp,
      targetXp,
      xpRequired: targetXp - currentXp,
      freshStart: false,
    };
  }
  if (valueMode === "FRESH_ACCOUNT") {
    if (input.targetLevel == null && input.targetXp == null) {
      throw new CustomBuildEstimateError(
        "Choose a target when using fresh-account mode.",
      );
    }
    const targetXp =
      input.targetXp != null
        ? toBigInt(input.targetXp)!
        : BigInt(xpForLevel(input.targetLevel!));
    if (targetXp <= 0n) {
      throw new CustomBuildEstimateError("Target XP must be higher than zero.");
    }
    return {
      skillKey: input.skillKey,
      valueMode,
      currentLevel: 1,
      targetLevel:
        input.targetLevel ??
        calculateXpProgress({
          currentXp: 0,
          targetXp: safeBigIntToNumber(targetXp, "Target XP"),
        }).targetLevel,
      currentXp: 0n,
      targetXp,
      xpRequired: targetXp,
      freshStart: true,
    };
  }
  if (valueMode === "UNKNOWN_CURRENT") {
    if (input.targetLevel == null && input.targetXp == null) {
      throw new CustomBuildEstimateError("Choose a target for the skill.");
    }
    const targetXp =
      input.targetXp != null
        ? toBigInt(input.targetXp)
        : BigInt(xpForLevel(input.targetLevel!));
    return {
      skillKey: input.skillKey,
      valueMode,
      currentLevel: null,
      targetLevel: input.targetLevel ?? null,
      currentXp: null,
      targetXp,
      xpRequired: null,
      freshStart: false,
    };
  }
  throw new CustomBuildEstimateError("Unknown skill input mode.");
}

function ruleMatchesGameMode(
  rule: { gameMode: CatalogueGameMode | null },
  gameMode: CatalogueGameMode,
) {
  return rule.gameMode === gameMode || rule.gameMode === null;
}

function gameModeSpecificity(rule: { gameMode: CatalogueGameMode | null }) {
  return rule.gameMode ? 1 : 0;
}

function findSkillRule(
  rules: PublishedCustomBuildRevisionSnapshotV1["skillRules"],
  skillKey: SkillingSkillKey,
  gameMode: CatalogueGameMode,
) {
  return rules
    .filter(
      (rule) =>
        rule.enabled &&
        rule.skillKey === skillKey &&
        ruleMatchesGameMode(rule, gameMode),
    )
    .sort((left, right) => {
      const mode = gameModeSpecificity(right) - gameModeSpecificity(left);
      if (mode) return mode;
      return left.stableKey.localeCompare(right.stableKey);
    })[0];
}

function findObjectiveRule(
  rules: PublishedCustomBuildRevisionSnapshotV1["objectiveRules"],
  objectiveStableKey: string,
  gameMode: CatalogueGameMode,
) {
  return rules
    .filter(
      (rule) =>
        rule.enabled &&
        rule.objectiveStableKey === objectiveStableKey &&
        ruleMatchesGameMode(rule, gameMode),
    )
    .sort((left, right) => {
      const mode = gameModeSpecificity(right) - gameModeSpecificity(left);
      if (mode) return mode;
      return left.stableKey.localeCompare(right.stableKey);
    })[0];
}

function amountForSkillRule(
  selection: ReturnType<typeof validateSkillSelection>,
  rule: PublishedCustomBuildRevisionSnapshotV1["skillRules"][number],
) {
  if (rule.manualReviewOnly || rule.pricingMode === "MANUAL_REVIEW_ONLY") {
    return null;
  }
  if (selection.xpRequired == null) return null;
  let amount = 0;
  if (rule.pricingMode === "PER_XP") {
    if (rule.centsPerMillionXp == null) {
      throw new CustomBuildEstimateError("Skill rule is missing XP pricing.");
    }
    amount = roundXpPrice(selection.xpRequired, rule.centsPerMillionXp);
  } else if (rule.pricingMode === "PER_LEVEL_BAND") {
    if (
      rule.fixedPriceCents == null ||
      selection.currentLevel == null ||
      selection.targetLevel == null
    ) {
      return null;
    }
    const levels = selection.targetLevel - selection.currentLevel;
    amount = levels * rule.fixedPriceCents;
  } else if (
    rule.pricingMode === "FIXED_TARGET_PACKAGE" ||
    rule.pricingMode === "FIXED_ADDITION"
  ) {
    if (rule.fixedPriceCents == null) {
      throw new CustomBuildEstimateError(
        "Skill rule is missing fixed pricing.",
      );
    }
    amount = rule.fixedPriceCents;
  }
  assertMoneyCents(amount, "Skill line");
  return Math.max(amount, rule.minimumPriceCents);
}

function publicSkillSelection(
  selection: ReturnType<typeof validateSkillSelection>,
) {
  return {
    skillKey: selection.skillKey,
    valueMode: selection.valueMode,
    currentLevel: selection.currentLevel,
    targetLevel: selection.targetLevel,
    currentXp: selection.currentXp?.toString() ?? null,
    targetXp: selection.targetXp?.toString() ?? null,
    xpRequired: selection.xpRequired?.toString() ?? null,
    freshStart: selection.freshStart,
  };
}

function stateFor(subtotal: number, reasons: ManualReviewReason[]) {
  if (reasons.length === 0) return "AUTOMATIC" as const;
  if (subtotal > 0) return "PARTIAL" as const;
  return "MANUAL_REVIEW_REQUIRED" as const;
}

export function publishedCustomBuildRevisionSnapshot(
  value: PublishedCustomBuildRevisionSnapshotV1,
) {
  return normalizeRevision(value);
}

export function calculateCustomBuildEstimate({
  revision,
  gameMode,
  skills,
  objectives,
  now = new Date(),
}: {
  revision: PublishedCustomBuildRevisionSnapshotV1 | unknown;
  gameMode: CatalogueGameMode;
  skills: CustomBuildSkillSelectionInput[];
  objectives: CustomBuildObjectiveSelectionInput[];
  now?: Date;
}): CustomBuildEstimateResult {
  const publishedRevision = normalizeRevision(revision);
  if (publishedRevision.service.currencyCode !== "USD") {
    throw new CustomBuildEstimateError("Unsupported custom-build currency.");
  }
  if (skills.length === 0 && objectives.length === 0) {
    throw new CustomBuildEstimateError(
      "Choose at least one skill target or objective.",
    );
  }

  const estimateLines: PricingLine[] = [];
  const reviewReasons: ManualReviewReason[] = [];
  let subtotal = 0;

  const normalizedSkills = skills.map(validateSkillSelection);
  for (const selection of normalizedSkills) {
    if (selection.valueMode === "UNKNOWN_CURRENT") {
      reviewReasons.push({
        code: "unknown-current-state",
        message: `${customBuildSkillLabels[selection.skillKey]} needs support review because current progress is unknown.`,
      });
      continue;
    }
    const rule = findSkillRule(
      publishedRevision.skillRules,
      selection.skillKey,
      gameMode,
    );
    if (!rule) {
      reviewReasons.push({
        code: "missing-skill-rule",
        message: `${customBuildSkillLabels[selection.skillKey]} needs manual pricing review.`,
      });
      continue;
    }
    const amount = amountForSkillRule(selection, rule);
    if (amount == null) {
      reviewReasons.push({
        code: "manual-skill-rule",
        message: `${customBuildSkillLabels[selection.skillKey]} requires support review.`,
      });
      continue;
    }
    subtotal = checkedAdd(subtotal, amount);
    estimateLines.push({
      label: `${customBuildSkillLabels[selection.skillKey]} target`,
      amountCents: amount,
      ruleId: rule.stableKey,
    });
  }

  const objectiveByKey = new Map(
    publishedRevision.objectives.map((objective) => [
      objective.stableKey,
      objective,
    ]),
  );
  const objectiveSelections = objectives.map((selection) => {
    const objective = objectiveByKey.get(selection.stableKey);
    if (!objective || !objective.enabled) {
      throw new CustomBuildEstimateError("Choose an available objective.");
    }
    if (objective.gameMode && objective.gameMode !== gameMode) {
      throw new CustomBuildEstimateError(
        `${objective.publicName} is not available for this game mode.`,
      );
    }
    return { ...selection, objective };
  });

  for (const selection of objectiveSelections) {
    const objective = selection.objective;
    if (selection.customerAlreadyCompleted) continue;
    const rule = findObjectiveRule(
      publishedRevision.objectiveRules,
      objective.stableKey,
      gameMode,
    );
    if (!rule) {
      reviewReasons.push({
        code: "missing-objective-rule",
        message: `${objective.publicName} needs manual pricing review.`,
      });
      continue;
    }
    if (rule.manualReviewOnly || rule.pricingMode === "MANUAL_REVIEW_ONLY") {
      reviewReasons.push({
        code: "manual-objective-rule",
        message: `${objective.publicName} requires support review.`,
      });
      continue;
    }
    let amount = 0;
    if (rule.pricingMode === "FIXED_ADDITION") {
      if (rule.fixedPriceCents == null) {
        throw new CustomBuildEstimateError(
          "Objective rule is missing fixed pricing.",
        );
      }
      amount = rule.fixedPriceCents;
    } else if (rule.pricingMode === "FIXED_TARGET_PACKAGE") {
      amount = rule.fixedPriceCents ?? 0;
    } else if (rule.percentBps != null) {
      amount = applyBasisPoints(subtotal, rule.percentBps);
    } else {
      reviewReasons.push({
        code: "unsupported-objective-pricing",
        message: `${objective.publicName} needs manual pricing review.`,
      });
      continue;
    }
    subtotal = checkedAdd(subtotal, amount);
    estimateLines.push({
      label: objective.publicName,
      amountCents: amount,
      ruleId: rule.stableKey,
    });
  }

  const state = stateFor(subtotal, reviewReasons);
  const hasPricedSubtotal = state === "AUTOMATIC" || state === "PARTIAL";
  const automaticSubtotalCents = hasPricedSubtotal ? subtotal : null;
  if (
    automaticSubtotalCents != null &&
    automaticSubtotalCents <
      publishedRevision.service.minimumAutomaticEstimateCents
  ) {
    reviewReasons.push({
      code: "below-minimum-automatic-estimate",
      message:
        "This combination is below the automatic-estimate floor and needs support review.",
    });
  }
  if (
    automaticSubtotalCents != null &&
    publishedRevision.service.maximumAutomaticEstimateCents != null &&
    automaticSubtotalCents >
      publishedRevision.service.maximumAutomaticEstimateCents
  ) {
    reviewReasons.push({
      code: "above-automatic-review-threshold",
      message:
        "This combination is above the automatic-review threshold and needs support review.",
    });
  }
  const finalState =
    reviewReasons.length === 0
      ? ("AUTOMATIC" as const)
      : subtotal > 0
        ? ("PARTIAL" as const)
        : ("MANUAL_REVIEW_REQUIRED" as const);
  const validUntil = new Date(
    now.getTime() + publishedRevision.service.validForMinutes * 60 * 1000,
  );

  const snapshot = normalizeCustomBuildEstimateSnapshot({
    schemaVersion: CUSTOM_BUILD_ESTIMATE_SNAPSHOT_SCHEMA_VERSION,
    service: {
      stableKey: publishedRevision.service.stableKey,
      slug: publishedRevision.service.slug,
      serviceId: publishedRevision.service.serviceId,
      serviceSlug: publishedRevision.service.serviceSlug,
      categoryId: publishedRevision.service.categoryId,
      categorySlug: publishedRevision.service.categorySlug,
    },
    currency: publishedRevision.service.currencyCode,
    gameMode,
    skillSelections: normalizedSkills.map(publicSkillSelection),
    objectiveSelections: objectiveSelections.map(({ objective, ...item }) => ({
      stableKey: objective.stableKey,
      objectiveType: objective.objectiveType,
      publicName: objective.publicName,
      customerAlreadyCompleted: Boolean(item.customerAlreadyCompleted),
    })),
    estimateLines,
    automaticSubtotalCents:
      finalState === "MANUAL_REVIEW_REQUIRED" ? null : subtotal,
    globalPricingAdjustmentLines: [],
    estimatedTotalCents:
      finalState === "MANUAL_REVIEW_REQUIRED" ? null : subtotal,
    estimateState: finalState,
    manualReviewReasons: reviewReasons,
    publishedCustomBuildRevision: {
      id: publishedRevision.revision.id,
      revisionNumber: publishedRevision.revision.revisionNumber,
    },
    publishedGlobalPricingRevision: null,
    generatedAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
    repricingRequired: false,
    reviewRequired: finalState !== "AUTOMATIC",
  });

  return {
    state: snapshot.estimateState,
    currency: snapshot.currency,
    estimateLines,
    globalPricingAdjustmentLines: [],
    automaticSubtotalCents: snapshot.automaticSubtotalCents,
    estimatedTotalCents: snapshot.estimatedTotalCents,
    estimatedTotal:
      snapshot.estimatedTotalCents == null
        ? null
        : formatCents(snapshot.estimatedTotalCents, snapshot.currency),
    manualReviewReasons: reviewReasons,
    snapshot,
    validUntil,
    finalPriceNote:
      finalState === "AUTOMATIC"
        ? "This is an automatic estimate. Staff still review the request before any future order step."
        : "This is not a final price. Staff will review the missing or risky items before quoting.",
  };
}

export function withCustomBuildGlobalPricing(
  estimate: CustomBuildEstimateResult,
  pricing: {
    globalAdjustmentLines: PricingLine[];
    minimumMaximumAdjustmentLines: PricingLine[];
    estimatedTotalCents: number;
    estimatedTotal: string;
    pricingRevision: { id: string; revisionNumber: number } | null;
  },
) {
  if (estimate.state !== "AUTOMATIC" && estimate.state !== "PARTIAL") {
    return estimate;
  }
  const globalPricingAdjustmentLines = [
    ...pricing.globalAdjustmentLines,
    ...pricing.minimumMaximumAdjustmentLines,
  ];
  const snapshot = normalizeCustomBuildEstimateSnapshot({
    ...estimate.snapshot,
    globalPricingAdjustmentLines,
    estimatedTotalCents: pricing.estimatedTotalCents,
    publishedGlobalPricingRevision: pricing.pricingRevision,
  });
  return {
    ...estimate,
    estimateLines: [...estimate.estimateLines, ...globalPricingAdjustmentLines],
    globalPricingAdjustmentLines,
    estimatedTotalCents: pricing.estimatedTotalCents,
    estimatedTotal: pricing.estimatedTotal,
    snapshot,
  } satisfies CustomBuildEstimateResult;
}

export function unavailableCustomBuildEstimate({
  revision,
  gameMode,
  skills,
  objectives,
  reason,
  now = new Date(),
}: {
  revision: PublishedCustomBuildRevisionSnapshotV1 | unknown;
  gameMode: CatalogueGameMode;
  skills: CustomBuildSkillSelectionInput[];
  objectives: CustomBuildObjectiveSelectionInput[];
  reason: string;
  now?: Date;
}) {
  const parsedRevision = normalizeRevision(revision);
  const validUntil = new Date(now.getTime() + 5 * 60 * 1000);
  const normalizedSkills = skills.map(validateSkillSelection);
  const objectiveByKey = new Map(
    parsedRevision.objectives.map((objective) => [
      objective.stableKey,
      objective,
    ]),
  );
  const snapshot = normalizeCustomBuildEstimateSnapshot({
    schemaVersion: CUSTOM_BUILD_ESTIMATE_SNAPSHOT_SCHEMA_VERSION,
    service: {
      stableKey: parsedRevision.service.stableKey,
      slug: parsedRevision.service.slug,
      serviceId: parsedRevision.service.serviceId,
      serviceSlug: parsedRevision.service.serviceSlug,
      categoryId: parsedRevision.service.categoryId,
      categorySlug: parsedRevision.service.categorySlug,
    },
    currency: parsedRevision.service.currencyCode,
    gameMode,
    skillSelections: normalizedSkills.map(publicSkillSelection),
    objectiveSelections: objectives.flatMap((selection) => {
      const objective = objectiveByKey.get(selection.stableKey);
      return objective
        ? [
            {
              stableKey: objective.stableKey,
              objectiveType: objective.objectiveType,
              publicName: objective.publicName,
              customerAlreadyCompleted: Boolean(
                selection.customerAlreadyCompleted,
              ),
            },
          ]
        : [];
    }),
    estimateLines: [],
    automaticSubtotalCents: null,
    globalPricingAdjustmentLines: [],
    estimatedTotalCents: null,
    estimateState: "UNAVAILABLE",
    manualReviewReasons: [{ code: "unavailable", message: reason }],
    publishedCustomBuildRevision: {
      id: parsedRevision.revision.id,
      revisionNumber: parsedRevision.revision.revisionNumber,
    },
    publishedGlobalPricingRevision: null,
    generatedAt: now.toISOString(),
    validUntil: validUntil.toISOString(),
    repricingRequired: false,
    reviewRequired: true,
  });
  return {
    state: "UNAVAILABLE" as const,
    currency: snapshot.currency,
    estimateLines: [],
    globalPricingAdjustmentLines: [],
    automaticSubtotalCents: null,
    estimatedTotalCents: null,
    estimatedTotal: null,
    manualReviewReasons: snapshot.manualReviewReasons,
    snapshot,
    validUntil,
    finalPriceNote:
      "This custom build is unavailable for the selected configuration.",
  } satisfies CustomBuildEstimateResult;
}

export function safeCustomBuildJson<T>(value: T) {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested,
    ),
  ) as T;
}
