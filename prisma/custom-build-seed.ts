import type { PrismaClient } from "../src/generated/prisma/client";
import { publishedCustomBuildRevisionSnapshot } from "../src/lib/custom-build/estimate";

const CATEGORY_ID = "custombuildcategory011";
const SERVICE_ID = "custombuildservice011";
const CONFIG_ID = "custombuildconfig011";
const RULE_SET_ID = "custombuilddraft011";
const REVISION_ID = "custombuildrevision011";
const PUBLISHED_AT = new Date("2026-07-28T15:00:00.000Z");

const categoryDescription =
  "Custom account build requests are scoped through safe desired stats, quests, diaries and unlocks. The quote stage never asks for account credentials.";

const serviceContent =
  "Plan a custom OSRS account build around target stats, quests, diaries and unlocks. The engine can provide an automatic or partial estimate where published rules exist, then staff can review and send a versioned quote. No cart, checkout, order, payment or account credential handover is created by this flow.";

const publicInstructions =
  "Choose the target account progress you want and confirm what is already complete. Do not submit passwords, bank PINs, recovery answers, authenticator details, browser cookies or screenshots containing private account information.";

const attachmentPolicy =
  "Private attachments are optional, quarantined and limited to PNG, JPEG, WebP or PDF. Do not upload screenshots containing credentials, private chat, recovery details or personal information.";

const objectiveSeeds = [
  {
    id: "customquestbarrows011",
    stableKey: "custom-build:quest:barrows-gloves",
    objectiveType: "QUEST" as const,
    objectiveKey: "barrows-gloves",
    publicName: "Barrows gloves quest line",
    publicDescription:
      "Representative quest objective for Recipe for Disaster and prerequisite review.",
    objectiveGroup: "Quest progression",
    difficultyTier: "Major unlock",
    sortOrder: 10,
    fixedPriceCents: 11999,
    manualReviewOnly: false,
  },
  {
    id: "customdiaryhard011",
    stableKey: "custom-build:diary:hard-tier",
    objectiveType: "ACHIEVEMENT_DIARY" as const,
    objectiveKey: "hard-diary-tier",
    publicName: "Hard achievement diary tier",
    publicDescription:
      "Representative hard diary package; exact region and missing prerequisites require staff review.",
    objectiveGroup: "Achievement diaries",
    difficultyTier: "Hard",
    sortOrder: 20,
    fixedPriceCents: 0,
    manualReviewOnly: true,
  },
  {
    id: "customunlocklunars011",
    stableKey: "custom-build:unlock:lunar-spellbook",
    objectiveType: "SPELLBOOK" as const,
    objectiveKey: "lunar-spellbook",
    publicName: "Lunar spellbook unlock",
    publicDescription:
      "Representative spellbook unlock objective requiring customer confirmation of prerequisites.",
    objectiveGroup: "Unlocks",
    difficultyTier: "Account unlock",
    sortOrder: 30,
    fixedPriceCents: 6999,
    manualReviewOnly: false,
  },
] as const;

const skillRuleSeeds = [
  {
    id: "customskillattack011",
    stableKey: "custom-build:skill:attack:normal",
    skillKey: "ATTACK" as const,
    centsPerMillionXp: 850,
    minimumPriceCents: 499,
    manualReviewOnly: false,
  },
  {
    id: "customskillranged011",
    stableKey: "custom-build:skill:ranged:normal",
    skillKey: "RANGED" as const,
    centsPerMillionXp: 1050,
    minimumPriceCents: 699,
    manualReviewOnly: false,
  },
  {
    id: "customskillagility011",
    stableKey: "custom-build:skill:agility:review",
    skillKey: "AGILITY" as const,
    centsPerMillionXp: null,
    minimumPriceCents: 0,
    manualReviewOnly: true,
  },
] as const;

export async function seedCustomBuild(prisma: PrismaClient) {
  const category = await prisma.catalogueCategory.upsert({
    where: { seededKey: "custom-account-builds" },
    create: {
      id: CATEGORY_ID,
      seededKey: "custom-account-builds",
      name: "Custom Account Builds",
      slug: "custom-account-builds",
      shortDescription:
        "Desired account progress scoped through safe quote requests.",
      description: categoryDescription,
      iconKey: "hammer",
      displayOrder: 38,
      isActive: true,
      seoTitle: "Custom OSRS account builds",
      seoDescription:
        "Request safe custom OSRS account build estimates and staff-reviewed quotes.",
    },
    update: {},
    select: { id: true },
  });

  const service = await prisma.catalogueService.upsert({
    where: { seededKey: "custom-account-build" },
    create: {
      id: SERVICE_ID,
      seededKey: "custom-account-build",
      categoryId: category.id,
      name: "Custom account build",
      slug: "custom-account-build",
      canonicalSlug: "custom-account-builds/custom-account-build",
      shortSummary:
        "Configure target stats, quests, diaries and unlocks for a reviewed custom account-build quote.",
      content: serviceContent,
      serviceType: "SERVICE",
      engineType: "CUSTOM_ACCOUNT_BUILD",
      publicationStatus: "PUBLISHED",
      availabilityState: "AVAILABLE",
      isFeatured: true,
      isQuoteOnly: true,
      displayOrder: 38,
      publicPreparationNotes:
        "We never ask for an account password during the quote stage. Do not upload screenshots containing credentials or private account information.",
      seoTitle: "Custom OSRS account build quotes",
      seoDescription:
        "Build a safe custom account request with server-authoritative estimates and staff-reviewed quote revisions.",
      needsClientReview: true,
    },
    update: {},
    select: { id: true },
  });

  await prisma.catalogueServiceGameMode.createMany({
    data: [
      { serviceId: service.id, gameMode: "NORMAL" },
      { serviceId: service.id, gameMode: "IRONMAN" },
      { serviceId: service.id, gameMode: "HARDCORE_IRONMAN" },
      { serviceId: service.id, gameMode: "ULTIMATE_IRONMAN" },
    ],
    skipDuplicates: true,
  });

  await prisma.catalogueRequirement.createMany({
    data: [
      {
        seededKey: "custom-account-build:no-credentials",
        serviceId: service.id,
        title: "No credential submission",
        description:
          "Do not provide passwords, bank PINs, recovery answers, authenticator details, cookies or private account screenshots.",
        type: "ACCOUNT",
        isRequired: true,
        displayOrder: 10,
        verificationMode: "CUSTOMER_CONFIRMED",
      },
      {
        seededKey: "custom-account-build:consent",
        serviceId: service.id,
        title: "Support follow-up consent",
        description:
          "Provide only minimal contact details needed for support follow-up. No marketing subscription is created.",
        type: "OTHER",
        isRequired: true,
        displayOrder: 20,
        verificationMode: "CUSTOMER_CONFIRMED",
      },
    ],
    skipDuplicates: true,
  });

  const config = await prisma.customBuildService.upsert({
    where: { stableKey: "custom-account-build-main" },
    create: {
      id: CONFIG_ID,
      stableKey: "custom-account-build-main",
      serviceId: service.id,
      publicName: "Custom Account Build",
      slug: "custom-account-build",
      publicDescription:
        "Configure desired account progress and submit a secure request for staff quote review.",
      publicInstructions,
      privateInternalInstructions:
        "Seeded Task 011 configuration. Review pricing, prerequisites and attachment operations before enabling intake.",
      currencyCode: "USD",
      availabilityState: "AVAILABLE",
      minimumAutomaticEstimateCents: 500,
      maximumAutomaticEstimateCents: 50000,
      quoteValidityDaysDefault: 7,
      attachmentPolicy,
      maxAttachments: 5,
      maxAttachmentBytes: 5 * 1024 * 1024,
      maxTotalAttachmentBytes: 20 * 1024 * 1024,
      customerNoteMaxLength: 2000,
      consentPolicyVersion: "custom-build-request-v1",
      needsClientReview: true,
    },
    update: {},
    select: { id: true },
  });

  const ruleSet = await prisma.customBuildRuleSet.upsert({
    where: { id: RULE_SET_ID },
    create: {
      id: RULE_SET_ID,
      customBuildServiceId: config.id,
      name: "Custom build draft rules",
      description: "Representative draft rules for Task 011 validation.",
      status: "DRAFT",
      currencyCode: "USD",
      needsClientReview: true,
      internalNotes:
        "Seeded rules are representative only and remain disabled publicly until the feature flag is reviewed.",
    },
    update: {},
    select: { id: true },
  });

  for (const rule of skillRuleSeeds) {
    await prisma.customBuildSkillRule.upsert({
      where: { stableKey: rule.stableKey },
      create: {
        id: rule.id,
        stableKey: rule.stableKey,
        ruleSetId: ruleSet.id,
        skillKey: rule.skillKey,
        pricingMode: rule.manualReviewOnly ? "MANUAL_REVIEW_ONLY" : "PER_XP",
        centsPerMillionXp: rule.centsPerMillionXp,
        minimumPriceCents: rule.minimumPriceCents,
        enabled: true,
        manualReviewOnly: Boolean(rule.manualReviewOnly),
        needsClientReview: true,
      },
      update: {},
    });
  }

  for (const objective of objectiveSeeds) {
    const record = await prisma.customBuildObjective.upsert({
      where: { stableKey: objective.stableKey },
      create: {
        id: objective.id,
        stableKey: objective.stableKey,
        customBuildServiceId: config.id,
        objectiveType: objective.objectiveType,
        objectiveKey: objective.objectiveKey,
        publicName: objective.publicName,
        publicDescription: objective.publicDescription,
        objectiveGroup: objective.objectiveGroup,
        difficultyTier: objective.difficultyTier,
        prerequisiteText:
          "Customer confirms current completion state; staff reviews missing or conflicting requirements.",
        sortOrder: objective.sortOrder,
        enabled: true,
        needsClientReview: true,
      },
      update: {},
      select: { id: true },
    });
    await prisma.customBuildObjectiveRule.upsert({
      where: { stableKey: `${objective.stableKey}:rule` },
      create: {
        id: `${objective.id.slice(0, 20)}rule`,
        stableKey: `${objective.stableKey}:rule`,
        ruleSetId: ruleSet.id,
        objectiveId: record.id,
        pricingMode: objective.manualReviewOnly
          ? "MANUAL_REVIEW_ONLY"
          : "FIXED_ADDITION",
        fixedPriceCents: objective.fixedPriceCents,
        manualReviewOnly: objective.manualReviewOnly,
        enabled: true,
        needsClientReview: true,
      },
      update: {},
    });
  }

  const existingRevision = await prisma.customBuildRevision.findFirst({
    where: { customBuildServiceId: config.id },
    select: { id: true },
  });
  if (existingRevision) return;

  const snapshot = publishedCustomBuildRevisionSnapshot({
    schemaVersion: 1,
    service: {
      id: config.id,
      stableKey: "custom-account-build-main",
      slug: "custom-account-build",
      serviceId: service.id,
      serviceSlug: "custom-account-build",
      categoryId: category.id,
      categorySlug: "custom-account-builds",
      publicName: "Custom Account Build",
      currencyCode: "USD",
      minimumAutomaticEstimateCents: 500,
      maximumAutomaticEstimateCents: 50000,
      validForMinutes: 7 * 24 * 60,
    },
    revision: {
      id: REVISION_ID,
      revisionNumber: 1,
      publishedAt: PUBLISHED_AT.toISOString(),
    },
    skillRules: skillRuleSeeds.map((rule) => ({
      stableKey: rule.stableKey,
      skillKey: rule.skillKey,
      pricingMode: rule.manualReviewOnly ? "MANUAL_REVIEW_ONLY" : "PER_XP",
      gameMode: null,
      minimumLevel: null,
      maximumLevel: null,
      minimumXp: null,
      maximumXp: null,
      centsPerMillionXp: rule.centsPerMillionXp,
      levelBandStart: null,
      levelBandEnd: null,
      fixedPriceCents: null,
      minimumPriceCents: rule.minimumPriceCents,
      enabled: true,
      manualReviewOnly: Boolean(rule.manualReviewOnly),
      needsClientReview: true,
    })),
    objectives: objectiveSeeds.map((objective) => ({
      stableKey: objective.stableKey,
      objectiveType: objective.objectiveType,
      objectiveKey: objective.objectiveKey,
      publicName: objective.publicName,
      publicDescription: objective.publicDescription,
      objectiveGroup: objective.objectiveGroup,
      difficultyTier: objective.difficultyTier,
      gameMode: null,
      prerequisiteText:
        "Customer confirms current completion state; staff reviews missing or conflicting requirements.",
      sortOrder: objective.sortOrder,
      enabled: true,
      needsClientReview: true,
    })),
    objectiveRules: objectiveSeeds.map((objective) => ({
      stableKey: `${objective.stableKey}:rule`,
      objectiveStableKey: objective.stableKey,
      pricingMode: objective.manualReviewOnly
        ? "MANUAL_REVIEW_ONLY"
        : "FIXED_ADDITION",
      fixedPriceCents: objective.fixedPriceCents,
      percentBps: null,
      gameMode: null,
      manualReviewOnly: objective.manualReviewOnly,
      enabled: true,
      needsClientReview: true,
    })),
  });

  await prisma.customBuildRevision.create({
    data: {
      id: REVISION_ID,
      customBuildServiceId: config.id,
      ruleSetId: ruleSet.id,
      revisionNumber: 1,
      snapshotSchemaVersion: 1,
      snapshot,
      publishedAt: PUBLISHED_AT,
    },
  });
}
