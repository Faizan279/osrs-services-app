import fs from "node:fs";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { catalogueActionErrorMessage } from "@/lib/catalogue/action-errors";
import { CatalogueConflictError } from "@/lib/catalogue/errors";
import { publicServiceSelect } from "@/lib/catalogue/public-select";
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
});
