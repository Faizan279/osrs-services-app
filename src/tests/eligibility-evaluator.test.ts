import { describe, expect, it } from "vitest";

import { evaluateRequirements } from "@/lib/eligibility/evaluator";
import type { PublicStatsProfile } from "@/lib/eligibility/profile";

const profile: PublicStatsProfile = {
  normalizedRsn: "Sample User",
  displayName: null,
  fetchedAt: "2026-07-06T00:00:00.000Z",
  provider: "fixture",
  totalLevel: 1500,
  totalXp: 25_000_000,
  skillLevels: { attack: 75 },
  skillXp: { attack: 1_200_000 },
  activityScores: {},
};

const automatic = {
  id: "requirement-1",
  title: "Attack",
  description: "Public Attack level.",
  isRequired: true,
  verificationMode: "AUTOMATIC" as const,
  metricKey: "skill.attack.level",
  requiredValue: 75,
  recommendedService: null,
};

describe("eligibility evaluator", () => {
  it.each([
    ["GREATER_THAN_OR_EQUAL", 75, "MET"],
    ["GREATER_THAN", 74, "MET"],
    ["EQUAL", 75, "MET"],
    ["LESS_THAN_OR_EQUAL", 75, "MET"],
    ["LESS_THAN", 76, "MET"],
    ["GREATER_THAN", 75, "NOT_MET"],
  ] as const)("evaluates %s", (comparisonOperator, requiredValue, status) => {
    const result = evaluateRequirements(profile, [
      { ...automatic, comparisonOperator, requiredValue },
    ]);
    expect(result.results[0]?.status).toBe(status);
  });

  it("does not treat a missing public metric as zero", () => {
    const result = evaluateRequirements(profile, [
      {
        ...automatic,
        metricKey: "skill.magic.level",
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
      },
    ]);
    expect(result.results[0]?.status).toBe("SUPPORT_VERIFICATION_REQUIRED");
    expect(result.results[0]?.actualValue).toBeNull();
  });

  it("keeps customer and support verification explicit", () => {
    const result = evaluateRequirements(profile, [
      {
        ...automatic,
        id: "customer",
        verificationMode: "CUSTOMER_CONFIRMED",
        metricKey: null,
        comparisonOperator: null,
      },
      {
        ...automatic,
        id: "support",
        verificationMode: "SUPPORT_VERIFIED",
        metricKey: null,
        comparisonOperator: null,
      },
    ]);
    expect(result.results.map((item) => item.status)).toEqual([
      "CUSTOMER_CONFIRMATION_REQUIRED",
      "SUPPORT_VERIFICATION_REQUIRED",
    ]);
  });

  it("returns a published prerequisite recommendation for an unmet rule", () => {
    const result = evaluateRequirements(profile, [
      {
        ...automatic,
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
        requiredValue: 80n,
        recommendedService: {
          name: "Skill training request",
          slug: "skill-training-request",
          publicationStatus: "PUBLISHED",
          category: { slug: "power-levelling" },
        },
      },
    ]);
    expect(result.results[0]?.recommendation?.href).toBe(
      "/services/power-levelling/skill-training-request",
    );
    expect(result.summary.NOT_MET).toBe(1);
  });

  it("suppresses prerequisite links that are not publicly reachable", () => {
    const result = evaluateRequirements(profile, [
      {
        ...automatic,
        id: "inactive-category",
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
        requiredValue: 80,
        recommendedService: {
          name: "Inactive category service",
          slug: "inactive-category-service",
          publicationStatus: "PUBLISHED",
          category: { slug: "hidden", isActive: false },
        },
      },
      {
        ...automatic,
        id: "future-publish",
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
        requiredValue: 80,
        recommendedService: {
          name: "Future service",
          slug: "future-service",
          publicationStatus: "PUBLISHED",
          publishAt: "2099-01-01T00:00:00.000Z",
          category: { slug: "hidden", isActive: true },
        },
      },
      {
        ...automatic,
        id: "archived",
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
        requiredValue: 80,
        recommendedService: {
          name: "Archived service",
          slug: "archived-service",
          publicationStatus: "ARCHIVED",
          category: { slug: "hidden", isActive: true },
        },
      },
    ]);
    expect(result.results.map((item) => item.recommendation)).toEqual([
      null,
      null,
      null,
    ]);
  });
});
