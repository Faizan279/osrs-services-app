import fs from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { catalogueAvailabilityStates } from "@/lib/catalogue/constants";
import {
  createOwnedMediaReference,
  mediaOwnerWhere,
} from "@/lib/catalogue/media";
import {
  canPermanentlyDeleteService,
  isPubliclyVisible,
  publicationIssues,
} from "@/lib/catalogue/rules";
import {
  matchesCatalogueSearch,
  publicServiceSelect,
} from "@/lib/catalogue/public-select";
import {
  isSafeMediaReference,
  mediaReferenceInputSchema,
  nextDuplicateSlug,
  normalizeSlug,
} from "@/lib/catalogue/validation";

const candidate = {
  name: "Quest progression",
  slug: "quest-progression",
  canonicalSlug: "quest-progression",
  shortSummary: "A sufficiently useful public service summary.",
  content:
    "Complete public content with enough detail to pass publication checks.",
  gameModes: ["NORMAL"],
  category: { isActive: true },
  publishAt: null,
  unpublishAt: null,
  publicationStatus: "PUBLISHED",
};

describe("catalogue publication rules", () => {
  it("normalizes and safely increments duplicate slugs", () => {
    expect(normalizeSlug("  Quest & Diary Support! ")).toBe(
      "quest-diary-support",
    );
    expect(
      nextDuplicateSlug("quest-progression", [
        "quest-progression-copy",
        "quest-progression-copy-2",
      ]),
    ).toBe("quest-progression-copy-3");
  });

  it("blocks incomplete or inactive records from publication", () => {
    expect(
      publicationIssues({
        ...candidate,
        content: "short",
        gameModes: [],
        category: { isActive: false },
      }),
    ).toEqual(
      expect.arrayContaining([
        "Complete public content is required.",
        "At least one supported game mode is required.",
        "The category must be active before publication.",
      ]),
    );
  });

  it("enforces draft, archive and schedule visibility", () => {
    const now = new Date("2026-07-01T12:00:00Z");
    expect(isPubliclyVisible(candidate, now)).toBe(true);
    expect(
      isPubliclyVisible({ ...candidate, publicationStatus: "DRAFT" }, now),
    ).toBe(false);
    expect(
      isPubliclyVisible({ ...candidate, publicationStatus: "ARCHIVED" }, now),
    ).toBe(false);
    expect(
      isPubliclyVisible(
        { ...candidate, publishAt: new Date("2026-07-02T00:00:00Z") },
        now,
      ),
    ).toBe(false);
    expect(
      isPubliclyVisible(
        { ...candidate, unpublishAt: new Date("2026-07-01T11:59:00Z") },
        now,
      ),
    ).toBe(false);
  });

  it("accepts only internal paths and HTTP(S) media references", () => {
    expect(isSafeMediaReference("/artwork/portal-hero.webp")).toBe(true);
    expect(isSafeMediaReference("https://cdn.example.test/service.webp")).toBe(
      true,
    );
    expect(isSafeMediaReference("javascript:alert(1)")).toBe(false);
    expect(isSafeMediaReference("//evil.example.test/image.webp")).toBe(false);
  });

  it("keeps private fields outside the public query projection", () => {
    expect("internalNotes" in publicServiceSelect).toBe(false);
    expect("legacySource" in publicServiceSelect).toBe(false);
    expect("createdBy" in publicServiceSelect).toBe(false);
  });

  it("matches search words without treating request as quest", () => {
    const service = {
      name: "PvM support",
      shortSummary: "Prepare a request for an encounter.",
      content: "Requirements are reviewed before a quote.",
    };
    expect(matchesCatalogueSearch(service, "quest")).toBe(false);
    expect(matchesCatalogueSearch(service, "pvm")).toBe(true);
  });

  it("keeps quote pricing separate from operational availability", () => {
    expect(catalogueAvailabilityStates).toEqual([
      "AVAILABLE",
      "PAUSED",
      "UNAVAILABLE",
    ]);
    expect(catalogueAvailabilityStates).not.toContain("QUOTE_ONLY");
  });

  it("accepts exactly one media owner and rejects orphan or dual ownership", () => {
    const base = {
      assetPath: "/artwork/service.webp",
      altText: "Service artwork",
      displayOrder: 10,
      isPrimary: false,
    };
    expect(
      mediaReferenceInputSchema.safeParse({ ...base, serviceId: "service-1" })
        .success,
    ).toBe(true);
    expect(
      mediaReferenceInputSchema.safeParse({ ...base, categoryId: "category-1" })
        .success,
    ).toBe(true);
    expect(mediaReferenceInputSchema.safeParse(base).success).toBe(false);
    expect(
      mediaReferenceInputSchema.safeParse({
        ...base,
        categoryId: "category-1",
        serviceId: "service-1",
      }).success,
    ).toBe(false);
  });

  it("replaces the primary media only within the same parent", async () => {
    const media = [
      { id: "old-service", serviceId: "service-1", isPrimary: true },
      { id: "other-service", serviceId: "service-2", isPrimary: true },
    ];
    await createOwnedMediaReference(
      { id: "new-service", serviceId: "service-1", isPrimary: true },
      {
        clearPrimary: async (where) => {
          for (const item of media) {
            if (
              item.serviceId === where.serviceId &&
              where.isPrimary &&
              item.isPrimary
            ) {
              item.isPrimary = false;
            }
          }
        },
        create: async (data) => {
          media.push(data);
          return data;
        },
      },
    );
    expect(
      media.filter((item) => item.serviceId === "service-1" && item.isPrimary),
    ).toHaveLength(1);
    expect(media.find((item) => item.id === "other-service")?.isPrimary).toBe(
      true,
    );
    expect(() => mediaOwnerWhere({})).toThrow(/exactly one parent/);
  });

  it("allows permanent deletion only for pristine drafts", () => {
    expect(
      canPermanentlyDeleteService({
        publicationStatus: "DRAFT",
        revisionCount: 0,
      }),
    ).toBe(true);
    expect(
      canPermanentlyDeleteService({
        publicationStatus: "DRAFT",
        revisionCount: 1,
      }),
    ).toBe(false);
    expect(
      canPermanentlyDeleteService({
        publicationStatus: "PUBLISHED",
        revisionCount: 0,
      }),
    ).toBe(false);
    expect(
      canPermanentlyDeleteService({
        publicationStatus: "ARCHIVED",
        revisionCount: 1,
      }),
    ).toBe(false);
  });

  it("ships an additive integrity migration for media and revisions", () => {
    const migration = fs.readFileSync(
      path.join(
        process.cwd(),
        "prisma/migrations/20260703120000_task003_catalogue_integrity_corrections/migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain("ENUM('AVAILABLE', 'PAUSED', 'UNAVAILABLE')");
    expect(migration).toContain(
      "CatalogueMediaReference_exactly_one_owner_chk",
    );
    expect(migration).toContain("ON DELETE RESTRICT ON UPDATE CASCADE");
    expect(migration).not.toMatch(/DROP TABLE|TRUNCATE TABLE/);
  });
});
