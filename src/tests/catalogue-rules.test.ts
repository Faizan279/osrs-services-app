import { describe, expect, it } from "vitest";

import { isPubliclyVisible, publicationIssues } from "@/lib/catalogue/rules";
import {
  matchesCatalogueSearch,
  publicServiceSelect,
} from "@/lib/catalogue/public-select";
import {
  isSafeMediaReference,
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
});
