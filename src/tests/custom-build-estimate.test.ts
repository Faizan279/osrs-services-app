import { describe, expect, it } from "vitest";

import {
  calculateCustomBuildEstimate,
  normalizeCustomBuildEstimateSnapshot,
  withCustomBuildGlobalPricing,
  type PublishedCustomBuildRevisionSnapshotV1,
} from "@/lib/custom-build/estimate";
import { xpForLevel } from "@/lib/skilling/xp";

const revision: PublishedCustomBuildRevisionSnapshotV1 = {
  schemaVersion: 1,
  service: {
    id: "custombuildconfig011",
    stableKey: "custom-account-build-main",
    slug: "custom-account-build",
    serviceId: "custombuildservice011",
    serviceSlug: "custom-account-build",
    categoryId: "custombuildcategory011",
    categorySlug: "custom-account-builds",
    publicName: "Custom Account Build",
    currencyCode: "USD",
    minimumAutomaticEstimateCents: 0,
    maximumAutomaticEstimateCents: 100_000_000,
    validForMinutes: 60,
  },
  revision: {
    id: "custombuildrevision011",
    revisionNumber: 1,
    publishedAt: "2026-07-28T15:00:00.000Z",
  },
  skillRules: [
    {
      stableKey: "attack-rule",
      skillKey: "ATTACK",
      pricingMode: "PER_XP",
      gameMode: null,
      minimumLevel: null,
      maximumLevel: null,
      minimumXp: null,
      maximumXp: null,
      centsPerMillionXp: 1000,
      levelBandStart: null,
      levelBandEnd: null,
      fixedPriceCents: null,
      minimumPriceCents: 100,
      enabled: true,
      manualReviewOnly: false,
      needsClientReview: true,
    },
    {
      stableKey: "agility-review-rule",
      skillKey: "AGILITY",
      pricingMode: "MANUAL_REVIEW_ONLY",
      gameMode: null,
      minimumLevel: null,
      maximumLevel: null,
      minimumXp: null,
      maximumXp: null,
      centsPerMillionXp: null,
      levelBandStart: null,
      levelBandEnd: null,
      fixedPriceCents: null,
      minimumPriceCents: 0,
      enabled: true,
      manualReviewOnly: true,
      needsClientReview: true,
    },
    {
      stableKey: "ranged-rule",
      skillKey: "RANGED",
      pricingMode: "PER_XP",
      gameMode: null,
      minimumLevel: null,
      maximumLevel: null,
      minimumXp: null,
      maximumXp: null,
      centsPerMillionXp: 1200,
      levelBandStart: null,
      levelBandEnd: null,
      fixedPriceCents: null,
      minimumPriceCents: 200,
      enabled: true,
      manualReviewOnly: false,
      needsClientReview: true,
    },
  ],
  objectives: [
    {
      stableKey: "quest-barrows",
      objectiveType: "QUEST",
      objectiveKey: "barrows-gloves",
      publicName: "Barrows gloves",
      publicDescription: "Quest line review.",
      objectiveGroup: "Quest",
      difficultyTier: "Major",
      gameMode: null,
      prerequisiteText: null,
      sortOrder: 10,
      enabled: true,
      needsClientReview: true,
    },
    {
      stableKey: "diary-hard",
      objectiveType: "ACHIEVEMENT_DIARY",
      objectiveKey: "hard-diary",
      publicName: "Hard diary",
      publicDescription: "Diary review.",
      objectiveGroup: "Diary",
      difficultyTier: "Hard",
      gameMode: null,
      prerequisiteText: null,
      sortOrder: 20,
      enabled: true,
      needsClientReview: true,
    },
    {
      stableKey: "disabled-unlock",
      objectiveType: "UNLOCK",
      objectiveKey: "disabled-unlock",
      publicName: "Disabled unlock",
      publicDescription: "Disabled objective.",
      objectiveGroup: "Unlock",
      difficultyTier: "Review",
      gameMode: null,
      prerequisiteText: null,
      sortOrder: 30,
      enabled: false,
      needsClientReview: true,
    },
    {
      stableKey: "ironman-unlock",
      objectiveType: "UNLOCK",
      objectiveKey: "ironman-unlock",
      publicName: "Ironman unlock",
      publicDescription: "Mode-gated objective.",
      objectiveGroup: "Unlock",
      difficultyTier: "Mode gated",
      gameMode: "IRONMAN",
      prerequisiteText: null,
      sortOrder: 40,
      enabled: true,
      needsClientReview: true,
    },
  ],
  objectiveRules: [
    {
      stableKey: "quest-barrows-rule",
      objectiveStableKey: "quest-barrows",
      pricingMode: "FIXED_ADDITION",
      fixedPriceCents: 5000,
      percentBps: null,
      gameMode: null,
      manualReviewOnly: false,
      enabled: true,
      needsClientReview: true,
    },
    {
      stableKey: "diary-hard-rule",
      objectiveStableKey: "diary-hard",
      pricingMode: "MANUAL_REVIEW_ONLY",
      fixedPriceCents: null,
      percentBps: null,
      gameMode: null,
      manualReviewOnly: true,
      enabled: true,
      needsClientReview: true,
    },
  ],
};

describe("custom build estimate engine", () => {
  it("calculates a fully automatic skill and objective estimate", () => {
    const estimate = calculateCustomBuildEstimate({
      revision,
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "ATTACK",
          valueMode: "LEVEL",
          currentLevel: 1,
          targetLevel: 50,
        },
      ],
      objectives: [{ stableKey: "quest-barrows" }],
      now: new Date("2026-07-29T00:00:00.000Z"),
    });

    const expectedSkillCents = Math.round((xpForLevel(50) * 1000) / 1_000_000);
    expect(estimate.state).toBe("AUTOMATIC");
    expect(estimate.estimatedTotalCents).toBe(expectedSkillCents + 5000);
    expect(estimate.snapshot.skillSelections[0]?.currentXp).toBe("0");
    expect(JSON.stringify(estimate.snapshot)).not.toMatch(
      /email|discord|rsn|notes|attachment/i,
    );
  });

  it("returns a partial estimate when one item needs review", () => {
    const estimate = calculateCustomBuildEstimate({
      revision,
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "ATTACK",
          valueMode: "FRESH_ACCOUNT",
          targetLevel: 40,
        },
      ],
      objectives: [{ stableKey: "diary-hard" }],
    });

    expect(estimate.state).toBe("PARTIAL");
    expect(estimate.estimatedTotalCents).toBeGreaterThan(0);
    expect(estimate.manualReviewReasons[0]?.code).toBe("manual-objective-rule");
  });

  it("supports current/target XP and multiple skill selections", () => {
    const estimate = calculateCustomBuildEstimate({
      revision,
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "ATTACK",
          valueMode: "XP",
          currentXp: "1000",
          targetXp: "101000",
        },
        {
          skillKey: "RANGED",
          valueMode: "LEVEL",
          currentLevel: 20,
          targetLevel: 45,
        },
      ],
      objectives: [],
    });

    expect(estimate.state).toBe("AUTOMATIC");
    expect(estimate.snapshot.skillSelections).toHaveLength(2);
    expect(estimate.estimatedTotalCents).toBeGreaterThan(0);
  });

  it("requires manual review when current state is unknown", () => {
    const estimate = calculateCustomBuildEstimate({
      revision,
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "ATTACK",
          valueMode: "UNKNOWN_CURRENT",
          targetLevel: 60,
        },
      ],
      objectives: [],
    });

    expect(estimate.state).toBe("MANUAL_REVIEW_REQUIRED");
    expect(estimate.estimatedTotalCents).toBeNull();
  });

  it("rejects invalid target progress and unknown snapshot versions", () => {
    expect(() =>
      calculateCustomBuildEstimate({
        revision,
        gameMode: "NORMAL",
        skills: [
          {
            skillKey: "ATTACK",
            valueMode: "LEVEL",
            currentLevel: 50,
            targetLevel: 49,
          },
        ],
        objectives: [],
      }),
    ).toThrow(/Target level/);

    expect(() =>
      normalizeCustomBuildEstimateSnapshot({ schemaVersion: 999 }),
    ).toThrow(/Unknown custom-build estimate snapshot/);
  });

  it("rejects disabled and game-mode-incompatible objectives", () => {
    expect(() =>
      calculateCustomBuildEstimate({
        revision,
        gameMode: "NORMAL",
        skills: [],
        objectives: [{ stableKey: "disabled-unlock" }],
      }),
    ).toThrow(/available objective/);

    expect(() =>
      calculateCustomBuildEstimate({
        revision,
        gameMode: "NORMAL",
        skills: [],
        objectives: [{ stableKey: "ironman-unlock" }],
      }),
    ).toThrow(/not available/);
  });

  it("appends customer-safe global pricing only to priced estimates", () => {
    const estimate = calculateCustomBuildEstimate({
      revision,
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "ATTACK",
          valueMode: "LEVEL",
          currentLevel: 1,
          targetLevel: 20,
        },
      ],
      objectives: [],
    });
    const priced = withCustomBuildGlobalPricing(estimate, {
      globalAdjustmentLines: [{ label: "Priority review", amountCents: 250 }],
      minimumMaximumAdjustmentLines: [],
      estimatedTotalCents: estimate.estimatedTotalCents! + 250,
      estimatedTotal: "$2.50",
      pricingRevision: { id: "pricingrevision011", revisionNumber: 1 },
    });

    expect(priced.snapshot.publishedGlobalPricingRevision?.id).toBe(
      "pricingrevision011",
    );
    expect(priced.estimatedTotalCents).toBe(
      estimate.estimatedTotalCents! + 250,
    );
  });

  it("does not invent global pricing for manual-review-only estimates", () => {
    const estimate = calculateCustomBuildEstimate({
      revision,
      gameMode: "NORMAL",
      skills: [
        {
          skillKey: "AGILITY",
          valueMode: "LEVEL",
          currentLevel: 1,
          targetLevel: 50,
        },
      ],
      objectives: [],
    });
    const priced = withCustomBuildGlobalPricing(estimate, {
      globalAdjustmentLines: [{ label: "Priority review", amountCents: 250 }],
      minimumMaximumAdjustmentLines: [],
      estimatedTotalCents: 250,
      estimatedTotal: "$2.50",
      pricingRevision: { id: "pricingrevision011", revisionNumber: 1 },
    });

    expect(priced.state).toBe("MANUAL_REVIEW_REQUIRED");
    expect(priced.estimatedTotalCents).toBeNull();
    expect(priced.snapshot.publishedGlobalPricingRevision).toBeNull();
  });
});
