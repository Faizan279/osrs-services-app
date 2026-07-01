import { permissions } from "@/lib/auth/permissions";

export type PublicationCandidate = {
  name: string;
  slug: string;
  canonicalSlug: string;
  shortSummary: string;
  content: string;
  gameModes: readonly unknown[];
  category: { isActive: boolean };
  publishAt: Date | null;
  unpublishAt: Date | null;
};

export function canViewCatalogue(
  capabilities: ReadonlySet<string> | readonly string[],
) {
  return new Set(capabilities).has(permissions.productsView);
}

export function canEditCatalogue(
  capabilities: ReadonlySet<string> | readonly string[],
) {
  return new Set(capabilities).has(permissions.productsEdit);
}

export function publicationIssues(candidate: PublicationCandidate) {
  const issues: string[] = [];
  if (!candidate.name.trim()) issues.push("Service name is required.");
  if (!candidate.slug.trim()) issues.push("Service slug is required.");
  if (!candidate.canonicalSlug.trim())
    issues.push("Canonical slug is required.");
  if (candidate.shortSummary.trim().length < 20) {
    issues.push("A useful public summary is required.");
  }
  if (candidate.content.trim().length < 40) {
    issues.push("Complete public content is required.");
  }
  if (!candidate.gameModes.length) {
    issues.push("At least one supported game mode is required.");
  }
  if (!candidate.category.isActive) {
    issues.push("The category must be active before publication.");
  }
  if (
    candidate.publishAt &&
    candidate.unpublishAt &&
    candidate.publishAt >= candidate.unpublishAt
  ) {
    issues.push("The publication schedule is invalid.");
  }
  return issues;
}

export function isPubliclyVisible(
  service: PublicationCandidate & { publicationStatus: string },
  now = new Date(),
) {
  return (
    service.publicationStatus === "PUBLISHED" &&
    publicationIssues(service).length === 0 &&
    (!service.publishAt || service.publishAt <= now) &&
    (!service.unpublishAt || service.unpublishAt > now)
  );
}
