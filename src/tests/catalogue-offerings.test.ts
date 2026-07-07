import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { CatalogueConflictError } from "@/lib/catalogue/errors";
import { assertOfferingBelongsToService } from "@/lib/catalogue/mutations";
import { publicOfferingSelect } from "@/lib/catalogue/public-select";
import {
  MAX_SAFE_REQUIREMENT_VALUE,
  prismaRequirementBigInt,
} from "@/lib/catalogue/numeric";
import { wouldCreateRecommendationCycle } from "@/lib/catalogue/recommendations";
import {
  offeringInputSchema,
  requirementInputSchema,
} from "@/lib/catalogue/validation";
import { normalizeRsn, rsnSchema } from "@/lib/eligibility/rsn";

const offering = {
  serviceId: "service1",
  slug: "kandarin-hard",
  name: "Kandarin Hard",
  shortSummary: "A sufficiently detailed offering summary.",
  description: "A safe description.",
  displayOrder: 10,
  isActive: true,
  isFeatured: false,
  needsClientReview: true,
  groupLabel: "Kandarin",
  tierLabel: "Hard",
  quantityEnabled: false,
  quantityUnit: "",
  minimumQuantity: "",
  maximumQuantity: "",
  gameModes: ["NORMAL"],
  facets: [
    { facetKey: "tier", facetValue: "hard", label: "Hard", displayOrder: 10 },
  ],
};

describe("catalogue offering rules", () => {
  it("rejects reserved slugs, duplicate facets and invalid quantity limits", () => {
    expect(
      offeringInputSchema.safeParse({ ...offering, slug: "admin" }).success,
    ).toBe(false);
    expect(
      offeringInputSchema.safeParse({
        ...offering,
        facets: [...offering.facets, ...offering.facets],
      }).success,
    ).toBe(false);
    expect(
      offeringInputSchema.safeParse({
        ...offering,
        quantityEnabled: true,
        quantityUnit: "points",
        minimumQuantity: 500,
        maximumQuantity: 100,
      }).success,
    ).toBe(false);
  });

  it("requires allow-listed automatic metrics and complete numeric rules", () => {
    const base = {
      serviceId: "service1",
      title: "Attack level",
      description: "A public Attack level requirement.",
      type: "SKILL",
      isRequired: true,
      displayOrder: 10,
      verificationMode: "AUTOMATIC",
    };
    expect(
      requirementInputSchema.safeParse({
        ...base,
        metricKey: "profile.secret",
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
        requiredValue: 70,
      }).success,
    ).toBe(false);
    expect(
      requirementInputSchema.safeParse({
        ...base,
        metricKey: "skill.attack.level",
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
        requiredValue: 70,
      }).success,
    ).toBe(true);
    expect(
      requirementInputSchema.safeParse({
        ...base,
        metricKey: "skill.attack.level",
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
        requiredValue: String(MAX_SAFE_REQUIREMENT_VALUE),
      }).success,
    ).toBe(true);
    expect(
      requirementInputSchema.safeParse({
        ...base,
        metricKey: "skill.attack.level",
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
        requiredValue: String(MAX_SAFE_REQUIREMENT_VALUE + 1),
      }).success,
    ).toBe(false);
    expect(
      requirementInputSchema.safeParse({
        ...base,
        metricKey: "skill.attack.level",
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
        requiredValue: "75.5",
      }).success,
    ).toBe(false);
  });

  it("converts requirement values to BigInt only within the JSON-safe range", () => {
    expect(prismaRequirementBigInt(MAX_SAFE_REQUIREMENT_VALUE)).toBe(
      9007199254740991n,
    );
    expect(() => prismaRequirementBigInt(-1)).toThrow();
    expect(() =>
      prismaRequirementBigInt(MAX_SAFE_REQUIREMENT_VALUE + 1),
    ).toThrow();
  });

  it("detects direct and transitive recommendation cycles", () => {
    const edges = new Map<string, string[]>([["service-b", ["service-a"]]]);
    expect(
      wouldCreateRecommendationCycle(edges, "service-a", "service-a"),
    ).toBe(true);
    expect(
      wouldCreateRecommendationCycle(edges, "service-a", "service-b"),
    ).toBe(true);
    expect(
      wouldCreateRecommendationCycle(edges, "service-a", "service-c"),
    ).toBe(false);
  });

  it("fails safely when an offering belongs to a different service", async () => {
    const transaction = {
      catalogueOffering: {
        findUnique: vi.fn().mockResolvedValue({ serviceId: "service-2" }),
      },
    };

    await expect(
      assertOfferingBelongsToService(
        transaction as never,
        "service-1",
        "offering-1",
      ),
    ).rejects.toBeInstanceOf(CatalogueConflictError);
    expect(transaction.catalogueOffering.findUnique).toHaveBeenCalledWith({
      where: { id: "offering-1" },
      select: { serviceId: true },
    });
  });

  it("keeps seeded and client-review fields out of the public offering projection", () => {
    expect("seededKey" in publicOfferingSelect).toBe(false);
    expect("needsClientReview" in publicOfferingSelect).toBe(false);
  });

  it("normalizes and validates RSNs without accepting passwords or controls", () => {
    expect(normalizeRsn("  Sample__User  ")).toBe("Sample User");
    expect(rsnSchema.safeParse("Sample User").success).toBe(true);
    expect(rsnSchema.safeParse("bad\u0000name").success).toBe(false);
    expect(rsnSchema.safeParse("way-too-long-name").success).toBe(false);
  });

  it("ships one additive migration with normalized query indexes", () => {
    const migration = fs.readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260706150000_task004_catalogue_engine_eligibility/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("CatalogueOffering_serviceId_slug_key");
    expect(migration).toContain(
      "CatalogueOfferingFacet_facetKey_facetValue_idx",
    );
    expect(migration).toContain("RsnLookupCache_lookupKey_provider_key");
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE TABLE|DELETE FROM/);
  });
});
