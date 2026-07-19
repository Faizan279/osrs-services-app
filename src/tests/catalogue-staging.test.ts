import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { catalogueActionErrorMessage } from "@/lib/catalogue/action-errors";
import { CatalogueConflictError } from "@/lib/catalogue/errors";
import { revisionSnapshot } from "@/lib/catalogue/mutations";
import { publicServiceSelect } from "@/lib/catalogue/public-select";
import { editableSnapshot } from "@/lib/catalogue/staging-repository";
import {
  addStagedMedia,
  addStagedRequirement,
  applyServiceEdit,
  assertArchiveTransition,
  primaryMedia,
  publicationEventFromHistory,
  snapshotFromService,
  stagedCatalogueAggregateSchema,
} from "@/lib/catalogue/staging";

const now = new Date("2026-07-03T12:00:00.000Z");
const bigintRequirementValue = 2147483648n;
const bigintRequirementNumber = 2147483648;
const liveService = {
  id: "service-1",
  categoryId: "category-1",
  name: "Published service",
  slug: "published-service",
  canonicalSlug: "published-service",
  shortSummary: "The currently published service summary.",
  content: "The currently published service content is long enough to use.",
  serviceType: "SERVICE" as const,
  engineType: "CATALOGUE_CARD" as const,
  publicationStatus: "PUBLISHED" as const,
  availabilityState: "AVAILABLE" as const,
  isFeatured: false,
  isQuoteOnly: true,
  displayOrder: 10,
  internalNotes: null,
  publicPreparationNotes: "Prepare the account details for review.",
  primaryMediaPath: "/media/live.webp",
  seoTitle: null,
  seoDescription: null,
  publishAt: null,
  unpublishAt: null,
  createdById: null,
  updatedById: null,
  version: 4,
  legacySource: null,
  seededKey: null,
  needsClientReview: true,
  createdAt: now,
  updatedAt: now,
  gameModes: [{ gameMode: "NORMAL" as const }],
  requirements: [
    {
      id: "requirement-1",
      title: "Published requirement",
      description: "The requirement currently shown to customers.",
      type: "ACCOUNT" as const,
      isRequired: true,
      displayOrder: 10,
      verificationMode: "CUSTOMER_CONFIRMED" as const,
      seededKey: null,
    },
  ],
  mediaReferences: [
    {
      id: "media-1",
      assetPath: "/media/live.webp",
      altText: "Published service artwork",
      caption: null,
      displayOrder: 10,
      isPrimary: true,
    },
  ],
};

function liveServiceWithBigintOfferingRequirement() {
  return {
    ...liveService,
    stage: null,
    requirements: [
      {
        id: "requirement-1",
        title: "Total XP requirement",
        description: "The service requires a large public total XP value.",
        type: "SKILL" as const,
        isRequired: true,
        displayOrder: 10,
        verificationMode: "AUTOMATIC" as const,
        customerGuidance: "Set your public profile visibility before ordering.",
        metricKey: "total.xp",
        comparisonOperator: "GREATER_THAN_OR_EQUAL" as const,
        requiredValue: bigintRequirementValue,
        recommendedServiceId: null,
        seededKey: null,
      },
    ],
    offerings: [
      {
        id: "offering-1",
        seededKey: "offering-seeded-key",
        slug: "expert",
        name: "Expert",
        shortSummary: "Expert offering summary.",
        description: null,
        displayOrder: 10,
        isActive: true,
        isFeatured: false,
        needsClientReview: true,
        groupLabel: null,
        tierLabel: "Expert",
        quantityEnabled: false,
        quantityUnit: null,
        minimumQuantity: null,
        maximumQuantity: null,
        gameModes: [{ gameMode: "NORMAL" as const }],
        facets: [
          {
            id: "facet-1",
            facetKey: "tier",
            facetValue: "expert",
            label: "Expert",
            displayOrder: 10,
          },
        ],
        requirements: [
          {
            id: "offering-requirement-1",
            title: "Offering total XP",
            description: "The offering requires a large public total XP value.",
            type: "SKILL" as const,
            isRequired: true,
            displayOrder: 10,
            verificationMode: "AUTOMATIC" as const,
            customerGuidance:
              "Set your public profile visibility before ordering.",
            metricKey: "total.xp",
            comparisonOperator: "GREATER_THAN_OR_EQUAL" as const,
            requiredValue: bigintRequirementValue,
            recommendedServiceId: null,
            seededKey: "offering-requirement-seeded-key",
          },
        ],
      },
    ],
  };
}

function livePremiumService() {
  return {
    ...liveService,
    id: "premium-service-1",
    name: "Premium service",
    slug: "premium-service",
    canonicalSlug: "premium-service",
    engineType: "PREMIUM_SERVICE_CONFIGURATOR" as const,
    gameModes: [
      { gameMode: "NORMAL" as const },
      { gameMode: "IRONMAN" as const },
    ],
    premiumConfig: {
      id: "premium-rule-1",
      normalModeMultiplierBps: 0,
      ironmanMultiplierBps: 1000,
      hardcoreIronmanMultiplierBps: 2000,
      ultimateIronmanMultiplierBps: 3000,
      discordStreamEnabled: true,
      discordStreamPercentBps: 200,
      rsnEligibilityEnabled: true,
      standardDeliveryEnabled: true,
      standardDeliveryLabel: "Standard",
      standardDeliveryDescription: "Standard queue.",
      standardDeliveryEstimate: "Confirmed before checkout",
      standardDeliveryMultiplierBps: 0,
      standardDeliveryFixedFeeCents: 0,
      priorityDeliveryEnabled: false,
      priorityDeliveryLabel: "Priority",
      priorityDeliveryDescription: "Faster queue.",
      priorityDeliveryEstimate: "Client review required",
      priorityDeliveryMultiplierBps: 1500,
      priorityDeliveryFixedFeeCents: 0,
      expressDeliveryEnabled: false,
      expressDeliveryLabel: "Express",
      expressDeliveryDescription: "Fastest queue.",
      expressDeliveryEstimate: "Client review required",
      expressDeliveryMultiplierBps: 3000,
      expressDeliveryFixedFeeCents: 0,
      needsClientReview: true,
    },
    premiumPackages: [
      {
        id: "premium-package-1",
        seededKey: null,
        slug: "standard-fire-cape",
        name: "Standard Fire Cape run",
        shortDescription:
          "Representative premium package used to verify staging snapshots.",
        enabled: true,
        displayOrder: 10,
        basePriceCents: 2499,
        minimumPriceCents: 2499,
        setupFeeCents: 0,
        estimatedHours: 2,
        difficultyTierLabel: "Standard",
        requirementsSummary: "Public stats plus confirmed gear.",
        gearNotes: "Gear ownership is customer-confirmed.",
        unlockNotes: "Unlocks are support verified.",
        customerGearRequired: true,
        customerGearLabel: "Customer confirms Fire Cape-ready gear",
        gearUnconfirmedAdjustmentCents: 700,
        needsClientReview: true,
        requirementGroups: [
          {
            id: "premium-group-1",
            seededKey: null,
            title: "Public combat stats",
            description: "Allow-listed public stats only.",
            displayOrder: 10,
            needsClientReview: true,
            requirements: [
              {
                id: "premium-requirement-1",
                seededKey: null,
                label: "Ranged level",
                description: "Recommended public Ranged level.",
                isRequired: true,
                displayOrder: 10,
                verificationMode: "AUTOMATIC" as const,
                metricKey: "skill.ranged.level",
                requiredValue: 70,
                customerGuidance:
                  "This public stat can be checked by RSN when enabled.",
                needsClientReview: true,
              },
              {
                id: "premium-requirement-2",
                seededKey: null,
                label: "Gear confirmation",
                description: "Customer confirms gear without sharing secrets.",
                isRequired: true,
                displayOrder: 20,
                verificationMode: "CUSTOMER_CONFIRMED" as const,
                metricKey: null,
                requiredValue: null,
                customerGuidance: "Do not provide a RuneScape password.",
                needsClientReview: true,
              },
            ],
          },
        ],
        faqs: [
          {
            id: "premium-faq-1",
            seededKey: null,
            question: "Do you need my RuneScape password?",
            answer:
              "No. The configurator never asks for passwords, PINs or authentication codes.",
            enabled: true,
            displayOrder: 10,
            needsClientReview: true,
          },
        ],
      },
    ],
    premiumOptions: [
      {
        id: "premium-option-1",
        seededKey: null,
        packageId: "premium-package-1",
        slug: "supply-support",
        name: "Supply support",
        description: "Representative reviewed supply support option.",
        enabled: true,
        displayOrder: 10,
        optionType: "SUPPLIES" as const,
        pricingMode: "FIXED_FEE" as const,
        fixedPriceCents: 500,
        percentBps: 0,
        perUnitPriceCents: 0,
        minimumQuantity: 1,
        maximumQuantity: 1,
        defaultQuantity: 1,
        customerInputRequired: false,
        needsClientReview: true,
      },
    ],
  };
}

describe("catalogue publication staging", () => {
  it("keeps the live aggregate unchanged while public edits are staged", () => {
    const initial = snapshotFromService(liveService);
    const staged = applyServiceEdit(initial, {
      ...initial.service,
      shortSummary: "A pending summary that is not public before republish.",
      publishAt: undefined,
      unpublishAt: undefined,
      gameModes: ["IRONMAN"],
      internalNotes: undefined,
      publicPreparationNotes:
        initial.service.publicPreparationNotes ?? undefined,
      seoTitle: undefined,
      seoDescription: undefined,
    });

    expect(liveService.shortSummary).toBe(
      "The currently published service summary.",
    );
    expect(liveService.gameModes).toEqual([{ gameMode: "NORMAL" }]);
    expect(staged.service.shortSummary).toContain("pending summary");
    expect(staged.gameModes).toEqual(["IRONMAN"]);
    expect(snapshotFromService(liveService)).toEqual(initial);
  });

  it("stages requirements and one authoritative primary media record", () => {
    const initial = snapshotFromService(liveService);
    const withRequirement = addStagedRequirement(initial, {
      id: "requirement-2",
      title: "Pending requirement",
      description: "This requirement remains private until republish.",
      type: "ACCOUNT",
      isRequired: true,
      displayOrder: 20,
      verificationMode: "SUPPORT_VERIFIED",
      seededKey: null,
    });
    const withMedia = addStagedMedia(withRequirement, {
      id: "media-2",
      assetPath: "/media/pending.webp",
      altText: "Pending primary artwork",
      caption: null,
      displayOrder: 20,
      isPrimary: true,
    });

    expect(liveService.requirements).toHaveLength(1);
    expect(withMedia.requirements).toHaveLength(2);
    expect(
      withMedia.mediaReferences.filter((item) => item.isPrimary),
    ).toHaveLength(1);
    expect(primaryMedia(withMedia)).toEqual(
      expect.objectContaining({
        assetPath: "/media/pending.webp",
        altText: "Pending primary artwork",
      }),
    );
  });

  it("normalizes live service and offering BigInt requirements into JSON-safe snapshots", () => {
    const aggregate = snapshotFromService(
      liveServiceWithBigintOfferingRequirement(),
    );
    const serviceRequirement = aggregate.requirements[0];
    const offeringRequirement = aggregate.offerings[0]?.requirements[0];

    expect(serviceRequirement?.requiredValue).toBe(bigintRequirementNumber);
    expect(offeringRequirement).toEqual(
      expect.objectContaining({
        id: "offering-requirement-1",
        title: "Offering total XP",
        description: "The offering requires a large public total XP value.",
        type: "SKILL",
        isRequired: true,
        displayOrder: 10,
        verificationMode: "AUTOMATIC",
        customerGuidance: "Set your public profile visibility before ordering.",
        metricKey: "total.xp",
        comparisonOperator: "GREATER_THAN_OR_EQUAL",
        requiredValue: bigintRequirementNumber,
        recommendedServiceId: null,
        seededKey: "offering-requirement-seeded-key",
      }),
    );
    expect(typeof offeringRequirement?.requiredValue).toBe("number");
    expect(() => JSON.stringify(aggregate)).not.toThrow();
  });

  it("builds editable snapshots for published offering BigInt requirements", () => {
    const aggregate = editableSnapshot(
      liveServiceWithBigintOfferingRequirement() as never,
    );

    expect(aggregate.offerings[0]?.requirements[0]?.requiredValue).toBe(
      bigintRequirementNumber,
    );
    expect(() => JSON.stringify(aggregate)).not.toThrow();
  });

  it("serializes revision snapshots without raw offering requirement BigInts", () => {
    const published = liveServiceWithBigintOfferingRequirement();
    const snapshot = revisionSnapshot(published) as unknown as {
      requirements: Array<{ requiredValue: number | null }>;
      offerings: Array<{
        requirements: Array<{ requiredValue: number | null }>;
      }>;
    };

    expect(snapshot.requirements[0]?.requiredValue).toBe(
      bigintRequirementNumber,
    );
    expect(snapshot.offerings[0]?.requirements[0]?.requiredValue).toBe(
      bigintRequirementNumber,
    );
    expect(() => JSON.stringify(snapshot)).not.toThrow();
  });

  it("derives publication semantics from immutable history", () => {
    expect(publicationEventFromHistory([])).toBe("PUBLISHED");
    expect(publicationEventFromHistory(["PUBLISHED"])).toBe("REPUBLISHED");
    expect(publicationEventFromHistory(["PUBLISHED", "ARCHIVED"])).toBe(
      "REPUBLISHED",
    );
  });

  it("rejects repeated archives and archives with pending changes", () => {
    expect(() => assertArchiveTransition("ARCHIVED", false)).toThrow(
      /currently published/,
    );
    expect(() => assertArchiveTransition("PUBLISHED", true)).toThrow(
      /discard pending changes/,
    );
    expect(() => assertArchiveTransition("PUBLISHED", false)).not.toThrow();
  });

  it("never exposes unexpected internal error details", () => {
    const report = vi.fn();
    const message = catalogueActionErrorMessage(
      new Error("CatalogueService SQL failure at C:\\private\\server.ts"),
      "test-operation",
      report,
    );
    expect(message).toBe(
      "The catalogue action could not be completed. Please try again.",
    );
    expect(message).not.toMatch(/CatalogueService|SQL|private|server\.ts/);
    expect(report).toHaveBeenCalledOnce();
    expect(
      catalogueActionErrorMessage(
        new CatalogueConflictError("Reload before saving."),
        "test-operation",
        report,
      ),
    ).toBe("Reload before saving.");
  });

  it("removes the direct media-path bypass from forms and public projection", () => {
    const formSource = fs.readFileSync(
      path.join(process.cwd(), "src/components/catalogue-admin.tsx"),
      "utf8",
    );
    const actionsSource = fs.readFileSync(
      path.join(process.cwd(), "src/app/(admin)/admin/catalogue/actions.ts"),
      "utf8",
    );
    expect(formSource).not.toContain('name="primaryMediaPath"');
    expect(actionsSource).not.toContain('formData.get("primaryMediaPath")');
    expect("primaryMediaPath" in publicServiceSelect).toBe(false);
    expect(publicServiceSelect.mediaReferences).toEqual(
      expect.objectContaining({ where: { isPrimary: true }, take: 1 }),
    );
  });

  it("ships an additive staging migration", () => {
    const migration = fs.readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260703210000_task003_publication_staging/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("CREATE TABLE `CatalogueServiceStage`");
    expect(migration).toContain("`snapshot` JSON NOT NULL");
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE TABLE|DELETE FROM/);
  });

  it("rejects duplicate staged identifiers and game modes", () => {
    const aggregate = snapshotFromService(liveService);
    const requirement = aggregate.requirements[0];
    const media = aggregate.mediaReferences[0];
    if (!requirement || !media)
      throw new Error("Expected seeded aggregate data.");
    expect(
      stagedCatalogueAggregateSchema.safeParse({
        ...aggregate,
        gameModes: ["NORMAL", "NORMAL"],
      }).success,
    ).toBe(false);
    expect(
      stagedCatalogueAggregateSchema.safeParse({
        ...aggregate,
        requirements: [requirement, requirement],
      }).success,
    ).toBe(false);
    expect(
      stagedCatalogueAggregateSchema.safeParse({
        ...aggregate,
        mediaReferences: [media, media],
      }).success,
    ).toBe(false);
  });

  it("rejects more than one staged primary media reference", () => {
    const aggregate = snapshotFromService(liveService);
    const firstPrimary = aggregate.mediaReferences[0];
    if (!firstPrimary) throw new Error("Expected seeded media data.");
    const secondPrimary = {
      ...firstPrimary,
      id: "media-2",
      assetPath: "/media/second.webp",
    };
    const result = stagedCatalogueAggregateSchema.safeParse({
      ...aggregate,
      mediaReferences: [...aggregate.mediaReferences, secondPrimary],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/only one primary/i);
    }
  });

  it("rejects malformed staged requirement and offering aggregate data", () => {
    const aggregate = snapshotFromService(liveService);
    const requirement = aggregate.requirements[0];
    if (!requirement) throw new Error("Expected seeded requirement data.");
    expect(
      stagedCatalogueAggregateSchema.safeParse({
        ...aggregate,
        requirements: [
          {
            ...requirement,
            verificationMode: "AUTOMATIC",
            metricKey: "profile.secret",
            comparisonOperator: "GREATER_THAN_OR_EQUAL",
            requiredValue: 70,
          },
        ],
      }).success,
    ).toBe(false);

    const offering = {
      id: "offering-1",
      seededKey: null,
      slug: "starter",
      name: "Starter",
      shortSummary: "Starter offering summary.",
      description: null,
      displayOrder: 10,
      isActive: true,
      isFeatured: false,
      needsClientReview: true,
      groupLabel: null,
      tierLabel: null,
      quantityEnabled: false,
      quantityUnit: null,
      minimumQuantity: 1,
      maximumQuantity: null,
      gameModes: ["NORMAL"],
      facets: [
        {
          id: "facet-1",
          facetKey: "Tier",
          facetValue: "starter",
          label: "Starter",
          displayOrder: 10,
        },
      ],
      requirements: [
        {
          ...requirement,
          id: "offering-requirement-1",
          verificationMode: "CUSTOMER_CONFIRMED",
          metricKey: "skill.attack.level",
          comparisonOperator: "GREATER_THAN_OR_EQUAL",
          requiredValue: 70,
        },
      ],
    };
    expect(
      stagedCatalogueAggregateSchema.safeParse({
        ...aggregate,
        offerings: [offering],
      }).success,
    ).toBe(false);
  });

  it("snapshots premium configurator data into versioned staged aggregates", () => {
    const aggregate = snapshotFromService(livePremiumService() as never);

    expect(aggregate.schemaVersion).toBe(5);
    expect(aggregate.premium?.rule?.rsnEligibilityEnabled).toBe(true);
    expect(aggregate.premium?.packages[0]?.name).toBe("Standard Fire Cape run");
    expect(
      aggregate.premium?.packages[0]?.requirementGroups[0]?.requirements[0],
    ).toEqual(
      expect.objectContaining({
        verificationMode: "AUTOMATIC",
        metricKey: "skill.ranged.level",
        requiredValue: 70,
      }),
    );
    expect(aggregate.premium?.options[0]?.packageId).toBe("premium-package-1");
    expect(() => JSON.stringify(aggregate)).not.toThrow();
  });

  it("preserves premium snapshots only while the premium engine is selected", () => {
    const initial = snapshotFromService(livePremiumService() as never);
    const preserved = applyServiceEdit(initial, {
      ...initial.service,
      engineType: "PREMIUM_SERVICE_CONFIGURATOR",
      gameModes: ["NORMAL"],
      internalNotes: undefined,
      publicPreparationNotes:
        initial.service.publicPreparationNotes ?? undefined,
      seoTitle: undefined,
      seoDescription: undefined,
      publishAt: undefined,
      unpublishAt: undefined,
    });
    const removed = applyServiceEdit(initial, {
      ...initial.service,
      engineType: "CATALOGUE_CARD",
      gameModes: ["NORMAL"],
      internalNotes: undefined,
      publicPreparationNotes:
        initial.service.publicPreparationNotes ?? undefined,
      seoTitle: undefined,
      seoDescription: undefined,
      publishAt: undefined,
      unpublishAt: undefined,
    });

    expect(preserved.premium?.packages).toHaveLength(1);
    expect(removed.premium).toBeNull();
  });

  it("rejects unsafe premium staged aggregate data", () => {
    const aggregate = snapshotFromService(livePremiumService() as never);
    const premium = aggregate.premium;
    if (!premium) throw new Error("Expected premium aggregate data.");
    const premiumPackage = premium.packages[0];
    const premiumOption = premium.options[0];
    const requirementGroup = premiumPackage?.requirementGroups[0];
    const requirement = requirementGroup?.requirements[0];
    if (
      !premiumPackage ||
      !premiumOption ||
      !requirementGroup ||
      !requirement
    ) {
      throw new Error("Expected premium package data.");
    }

    expect(
      stagedCatalogueAggregateSchema.safeParse({
        ...aggregate,
        premium: {
          ...premium,
          options: [{ ...premiumOption, packageId: "missing-package" }],
        },
      }).success,
    ).toBe(false);

    expect(
      stagedCatalogueAggregateSchema.safeParse({
        ...aggregate,
        premium: {
          ...premium,
          packages: [
            {
              ...premiumPackage,
              requirementGroups: [
                {
                  ...requirementGroup,
                  requirements: [
                    {
                      ...requirement,
                      metricKey: "quest.fire-cape.complete",
                    },
                  ],
                },
              ],
            },
          ],
        },
      }).success,
    ).toBe(false);
  });
});
