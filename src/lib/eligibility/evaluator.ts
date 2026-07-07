import type { CatalogueComparisonOperator } from "@/generated/prisma/client";
import { safeRequirementNumber } from "@/lib/catalogue/numeric";
import { metricValue } from "@/lib/eligibility/metrics";
import type { PublicStatsProfile } from "@/lib/eligibility/profile";

export const eligibilityStatuses = [
  "MET",
  "NOT_MET",
  "CUSTOMER_CONFIRMATION_REQUIRED",
  "SUPPORT_VERIFICATION_REQUIRED",
] as const;

export type EligibilityStatus = (typeof eligibilityStatuses)[number];

export type EvaluatedRequirementInput = {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  verificationMode: "AUTOMATIC" | "CUSTOMER_CONFIRMED" | "SUPPORT_VERIFIED";
  customerGuidance?: string | null;
  metricKey?: string | null;
  comparisonOperator?: CatalogueComparisonOperator | null;
  requiredValue?: number | bigint | null;
  recommendedService?: {
    name: string;
    category: { slug: string; isActive?: boolean | null };
    slug: string;
    publicationStatus: string;
    publishAt?: Date | string | null;
    unpublishAt?: Date | string | null;
  } | null;
};

function compare(
  actual: number,
  target: number,
  operator: CatalogueComparisonOperator,
) {
  switch (operator) {
    case "GREATER_THAN_OR_EQUAL":
      return actual >= target;
    case "GREATER_THAN":
      return actual > target;
    case "EQUAL":
      return actual === target;
    case "LESS_THAN_OR_EQUAL":
      return actual <= target;
    case "LESS_THAN":
      return actual < target;
  }
}

function dateValue(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function isPubliclyReachableRecommendation(
  service: NonNullable<EvaluatedRequirementInput["recommendedService"]>,
  now = new Date(),
) {
  const publishAt = dateValue(service.publishAt);
  const unpublishAt = dateValue(service.unpublishAt);
  return (
    service.publicationStatus === "PUBLISHED" &&
    service.category.isActive !== false &&
    (!publishAt || publishAt <= now) &&
    (!unpublishAt || unpublishAt > now)
  );
}

export function evaluateRequirements(
  profile: PublicStatsProfile,
  requirements: readonly EvaluatedRequirementInput[],
) {
  const results = requirements.map((requirement) => {
    let status: EligibilityStatus;
    let actualValue: number | null = null;
    if (requirement.verificationMode === "CUSTOMER_CONFIRMED") {
      status = "CUSTOMER_CONFIRMATION_REQUIRED";
    } else if (requirement.verificationMode === "SUPPORT_VERIFIED") {
      status = "SUPPORT_VERIFICATION_REQUIRED";
    } else {
      const actual = requirement.metricKey
        ? metricValue(profile, requirement.metricKey)
        : undefined;
      const requiredValue = safeRequirementNumber(requirement.requiredValue);
      if (
        actual === undefined ||
        requiredValue == null ||
        !requirement.comparisonOperator
      ) {
        status = "SUPPORT_VERIFICATION_REQUIRED";
      } else {
        actualValue = actual;
        status = compare(actual, requiredValue, requirement.comparisonOperator)
          ? "MET"
          : "NOT_MET";
      }
    }
    const recommendation =
      status === "NOT_MET" &&
      requirement.recommendedService &&
      isPubliclyReachableRecommendation(requirement.recommendedService)
        ? {
            name: requirement.recommendedService.name,
            href: `/services/${requirement.recommendedService.category.slug}/${requirement.recommendedService.slug}`,
          }
        : null;
    return {
      id: requirement.id,
      title: requirement.title,
      description: requirement.description,
      isRequired: requirement.isRequired,
      status,
      actualValue,
      requiredValue: safeRequirementNumber(requirement.requiredValue),
      metricKey: requirement.metricKey ?? null,
      customerGuidance: requirement.customerGuidance ?? null,
      recommendation,
    };
  });
  return {
    results,
    summary: eligibilityStatuses.reduce(
      (summary, status) => ({
        ...summary,
        [status]: results.filter((result) => result.status === status).length,
      }),
      {} as Record<EligibilityStatus, number>,
    ),
  };
}
