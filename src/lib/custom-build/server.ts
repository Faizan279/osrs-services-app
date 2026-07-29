import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  CustomBuildEstimateError,
  calculateCustomBuildEstimate,
  safeCustomBuildJson,
  unavailableCustomBuildEstimate,
  withCustomBuildGlobalPricing,
  type CustomBuildEstimateResult,
  type CustomBuildObjectiveSelectionInput,
  type CustomBuildSkillSelectionInput,
  type PublishedCustomBuildRevisionSnapshotV1,
} from "@/lib/custom-build/estimate";
import {
  CUSTOM_BUILD_FEATURE_FLAG,
  customBuildPublicStatusLabels,
} from "@/lib/custom-build/constants";
import {
  CustomBuildSecurityError,
  assertNoCredentialLikeKeys,
  checkCustomBuildRateLimit,
  createTrackingToken,
  hashSecret,
  normalizeContact,
  normalizePlainText,
  timingSafeHashEquals,
} from "@/lib/custom-build/security";
import { quoteCanReceiveCustomerDecision } from "@/lib/custom-build/quote";
import { publicCatalogueWhere } from "@/lib/catalogue/queries";
import { prisma } from "@/lib/db/prisma";
import { applyPublishedPricingIfEnabled } from "@/lib/pricing/server";

export type CustomBuildEstimateInput = {
  serviceSlug?: string;
  gameMode: "NORMAL" | "IRONMAN" | "HARDCORE_IRONMAN" | "ULTIMATE_IRONMAN";
  skills: CustomBuildSkillSelectionInput[];
  objectives: CustomBuildObjectiveSelectionInput[];
};

export type CustomBuildRequestInput = CustomBuildEstimateInput & {
  displayName: unknown;
  email: unknown;
  discordUsername?: unknown;
  rsn?: unknown;
  customerNotes?: string;
  consentAccepted: boolean;
  consentPolicyVersion?: string;
  idempotencyKey?: string;
  rateLimitKey?: string;
};

type RevisionRecord = Prisma.CustomBuildRevisionGetPayload<{
  select: {
    id: true;
    revisionNumber: true;
    snapshot: true;
    publishedAt: true;
  };
}>;

function json(value: unknown) {
  return safeCustomBuildJson(value) as Prisma.InputJsonValue;
}

function publicRequestNumber(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `CB-${date}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function publicQuoteNumber(now = new Date()) {
  const date = now.toISOString().slice(0, 10).replaceAll("-", "");
  return `CQ-${date}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function customBuildFeatureEnabled() {
  const flag = await prisma.featureFlag.findUnique({
    where: { key: CUSTOM_BUILD_FEATURE_FLAG },
    select: { enabled: true },
  });
  return Boolean(flag?.enabled);
}

async function loadCustomBuildService(serviceSlug?: string) {
  return prisma.customBuildService.findFirst({
    where: {
      ...(serviceSlug ? { slug: serviceSlug } : {}),
      service: {
        ...publicCatalogueWhere(),
        engineType: "CUSTOM_ACCOUNT_BUILD",
      },
    },
    include: {
      service: { include: { category: true, requirements: true } },
      revisions: {
        orderBy: [{ revisionNumber: "desc" }, { publishedAt: "desc" }],
        take: 1,
      },
    },
  });
}

function latestPublishedRevision(record: { revisions: RevisionRecord[] }) {
  const revision = record.revisions[0];
  if (!revision) return null;
  return revision.snapshot as PublishedCustomBuildRevisionSnapshotV1;
}

export async function getPublicCustomBuildService(serviceSlug?: string) {
  const [service, featureEnabled] = await Promise.all([
    loadCustomBuildService(serviceSlug),
    customBuildFeatureEnabled(),
  ]);
  if (!service) return null;
  const revision = latestPublishedRevision(service);
  return {
    service,
    featureEnabled,
    latestRevision: revision,
    readyForIntake:
      featureEnabled &&
      service.availabilityState === "AVAILABLE" &&
      Boolean(revision),
  };
}

export async function calculateServerCustomBuildEstimate(
  input: CustomBuildEstimateInput,
) {
  const [data, featureEnabled] = await Promise.all([
    loadCustomBuildService(input.serviceSlug),
    customBuildFeatureEnabled(),
  ]);
  if (!data) {
    throw new CustomBuildEstimateError(
      "Custom account build service not found.",
    );
  }
  const revision = latestPublishedRevision(data);
  if (!revision) {
    throw new CustomBuildEstimateError(
      "Custom account build rules are not published yet.",
    );
  }
  if (!featureEnabled) {
    return unavailableCustomBuildEstimate({
      revision,
      gameMode: input.gameMode,
      skills: input.skills,
      objectives: input.objectives,
      reason: "Custom account build requests are temporarily unavailable.",
    });
  }
  if (data.availabilityState !== "AVAILABLE") {
    return unavailableCustomBuildEstimate({
      revision,
      gameMode: input.gameMode,
      skills: input.skills,
      objectives: input.objectives,
      reason: "Custom account build requests are paused for review.",
    });
  }
  let estimate: CustomBuildEstimateResult = calculateCustomBuildEstimate({
    revision,
    gameMode: input.gameMode,
    skills: input.skills,
    objectives: input.objectives,
  });
  if (
    estimate.estimatedTotalCents != null &&
    (estimate.state === "AUTOMATIC" || estimate.state === "PARTIAL")
  ) {
    const priced = await applyPublishedPricingIfEnabled({
      source: {
        serviceId: data.serviceId,
        serviceSlug: data.service.slug,
        categoryId: data.service.categoryId,
        categorySlug: data.service.category.slug,
        engineType: "CUSTOM_ACCOUNT_BUILD",
        currency: estimate.currency,
        baseSubtotalCents: estimate.estimatedTotalCents,
        basePricingLines: estimate.estimateLines,
        selectedReferences: {
          customBuildService: data.stableKey,
          gameMode: input.gameMode,
          skillCount: input.skills.length,
          objectiveCount: input.objectives.length,
        },
        engineConfigurationRevision: {
          id: estimate.snapshot.publishedCustomBuildRevision.id,
          version:
            estimate.snapshot.publishedCustomBuildRevision.revisionNumber,
        },
      },
    });
    estimate = withCustomBuildGlobalPricing(estimate, priced);
  }
  return estimate;
}

function publicEstimatePayload(estimate: CustomBuildEstimateResult) {
  return {
    state: estimate.state,
    currency: estimate.currency,
    estimateLines: estimate.estimateLines,
    globalPricingAdjustmentLines: estimate.globalPricingAdjustmentLines,
    automaticSubtotalCents: estimate.automaticSubtotalCents,
    estimatedTotalCents: estimate.estimatedTotalCents,
    estimatedTotal: estimate.estimatedTotal,
    manualReviewReasons: estimate.manualReviewReasons,
    validUntil: estimate.validUntil.toISOString(),
    finalPriceNote: estimate.finalPriceNote,
    snapshot: safeCustomBuildJson(estimate.snapshot),
  };
}

export function publicCustomBuildEstimatePayload(
  estimate: CustomBuildEstimateResult,
) {
  return publicEstimatePayload(estimate);
}

export async function submitCustomBuildRequest(input: CustomBuildRequestInput) {
  assertNoCredentialLikeKeys(input);
  const rateKey = input.rateLimitKey ?? "custom-build:anonymous";
  const limited = checkCustomBuildRateLimit({ key: rateKey });
  if (!limited.allowed) {
    throw new CustomBuildSecurityError(
      `Too many request attempts. Try again in ${limited.retryAfterSeconds} seconds.`,
    );
  }
  if (!input.consentAccepted) {
    throw new CustomBuildSecurityError(
      "Consent is required before submitting a custom-build request.",
    );
  }
  const service = await loadCustomBuildService(input.serviceSlug);
  if (!service) {
    throw new CustomBuildEstimateError(
      "Custom account build service not found.",
    );
  }
  const revision = latestPublishedRevision(service);
  if (!revision) {
    throw new CustomBuildEstimateError(
      "Custom account build rules are not published yet.",
    );
  }
  const featureEnabled = await customBuildFeatureEnabled();
  if (!featureEnabled || service.availabilityState !== "AVAILABLE") {
    throw new CustomBuildSecurityError(
      "Custom account build request intake is temporarily unavailable.",
    );
  }
  const estimate = await calculateServerCustomBuildEstimate(input);
  if (estimate.state === "UNAVAILABLE") {
    throw new CustomBuildEstimateError(
      "This custom build is unavailable for the selected configuration.",
    );
  }
  const contact = normalizeContact(input);
  const customerNotes = normalizePlainText(
    input.customerNotes ?? "",
    service.customerNoteMaxLength,
  );
  const token = createTrackingToken();
  const idempotencyKeyHash = input.idempotencyKey
    ? hashSecret(input.idempotencyKey)
    : null;
  if (idempotencyKeyHash) {
    const existing = await prisma.customBuildRequest.findUnique({
      where: { idempotencyKeyHash },
      select: { publicRequestNumber: true, id: true },
    });
    if (existing) {
      return {
        created: false,
        requestId: existing.id,
        publicRequestNumber: existing.publicRequestNumber,
        trackingToken: null,
        trackingUrl: null,
        estimate: publicEstimatePayload(estimate),
      };
    }
  }
  const consentVersion =
    input.consentPolicyVersion || service.consentPolicyVersion;
  const created = await prisma.$transaction(async (transaction) => {
    const request = await transaction.customBuildRequest.create({
      data: {
        publicRequestNumber: publicRequestNumber(),
        customBuildServiceId: service.id,
        publishedRevisionId: estimate.snapshot.publishedCustomBuildRevision.id,
        status: "SUBMITTED",
        estimateState: estimate.state,
        estimateSnapshot: json(estimate.snapshot),
        gameMode: input.gameMode,
        displayName: contact.displayName,
        email: contact.email,
        discordUsername: contact.discordUsername,
        rsn: contact.rsn,
        customerNotes,
        contactConsentAt: new Date(),
        contactConsentPolicyVersion: consentVersion,
        trackingTokenHash: token.hash,
        idempotencyKeyHash,
        skills: {
          create: estimate.snapshot.skillSelections.map((skill, index) => ({
            skillKey: skill.skillKey,
            valueMode: skill.valueMode,
            currentLevel: skill.currentLevel,
            targetLevel: skill.targetLevel,
            currentXp: skill.currentXp ? BigInt(skill.currentXp) : null,
            targetXp: skill.targetXp ? BigInt(skill.targetXp) : null,
            freshStart: skill.freshStart,
            sortOrder: (index + 1) * 10,
          })),
        },
        objectives: {
          create: estimate.snapshot.objectiveSelections.map(
            (objective, index) => ({
              objectiveStableKey: objective.stableKey,
              objectiveType: objective.objectiveType,
              publicName: objective.publicName,
              customerAlreadyCompleted: objective.customerAlreadyCompleted,
              sortOrder: (index + 1) * 10,
            }),
          ),
        },
        statusEvents: {
          create: {
            newStatus: "SUBMITTED",
            publicMessage: "Request received for support review.",
            safeMetadata: json({
              estimateState: estimate.state,
              skillCount: estimate.snapshot.skillSelections.length,
              objectiveCount: estimate.snapshot.objectiveSelections.length,
              noOrderCreated: true,
              noPaymentCreated: true,
            }),
          },
        },
      },
      select: { id: true, publicRequestNumber: true },
    });
    await transaction.auditLog.create({
      data: {
        action: "custom_build.request.submitted",
        targetType: "CustomBuildRequest",
        targetId: request.id,
        metadata: json({
          requestNumber: request.publicRequestNumber,
          estimateState: estimate.state,
          noOrderCreated: true,
          noPaymentCreated: true,
        }),
      },
    });
    return request;
  });
  return {
    created: true,
    requestId: created.id,
    publicRequestNumber: created.publicRequestNumber,
    trackingToken: token.token,
    trackingUrl: `/custom-account-build/track/${token.token}`,
    estimate: publicEstimatePayload(estimate),
  };
}

export async function getTrackedCustomBuildRequest(token: string) {
  if (!token || token.length < 32 || token.length > 120) return null;
  const tokenHash = hashSecret(token);
  const request = await prisma.customBuildRequest.findUnique({
    where: { trackingTokenHash: tokenHash },
    include: {
      service: true,
      skills: { orderBy: { sortOrder: "asc" } },
      objectives: { orderBy: { sortOrder: "asc" } },
      statusEvents: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          newStatus: true,
          publicMessage: true,
          createdAt: true,
        },
      },
      attachments: {
        select: {
          id: true,
          originalFilename: true,
          sizeBytes: true,
          detectedMime: true,
          status: true,
          scanStatus: true,
          uploadedAt: true,
        },
        orderBy: { uploadedAt: "asc" },
      },
      quote: {
        include: {
          revisions: {
            orderBy: [{ revisionNumber: "desc" }],
            take: 1,
            include: { lines: { orderBy: { sortOrder: "asc" } } },
          },
          decisions: { orderBy: { decidedAt: "desc" }, take: 1 },
        },
      },
    },
  });
  if (!request) return null;
  if (!timingSafeHashEquals(request.trackingTokenHash, tokenHash)) return null;
  const latestRevision = request.quote?.revisions[0] ?? null;
  return {
    publicRequestNumber: request.publicRequestNumber,
    status: request.status,
    publicStatusLabel: customBuildPublicStatusLabels[request.status],
    submittedAt: request.submittedAt,
    updatedAt: request.updatedAt,
    gameMode: request.gameMode,
    estimateState: request.estimateState,
    estimateSnapshot: request.estimateSnapshot,
    skills: request.skills.map((skill) => ({
      skillKey: skill.skillKey,
      valueMode: skill.valueMode,
      currentLevel: skill.currentLevel,
      targetLevel: skill.targetLevel,
      currentXp: skill.currentXp?.toString() ?? null,
      targetXp: skill.targetXp?.toString() ?? null,
    })),
    objectives: request.objectives.map((objective) => ({
      stableKey: objective.objectiveStableKey,
      objectiveType: objective.objectiveType,
      publicName: objective.publicName,
      customerAlreadyCompleted: objective.customerAlreadyCompleted,
    })),
    statusEvents: request.statusEvents,
    attachments: request.attachments.map((attachment) => ({
      id: attachment.id,
      originalFilename: attachment.originalFilename,
      sizeBytes: attachment.sizeBytes,
      detectedMime: attachment.detectedMime,
      status: attachment.status,
      scanStatus: attachment.scanStatus,
      uploadedAt: attachment.uploadedAt,
    })),
    quote: request.quote
      ? {
          id: request.quote.id,
          publicQuoteNumber: request.quote.publicQuoteNumber,
          status: request.quote.status,
          currencyCode: request.quote.currencyCode,
          currentRevisionNumber: request.quote.currentRevisionNumber,
          issuedAt: request.quote.issuedAt,
          expiresAt: request.quote.expiresAt,
          customerMessage: request.quote.customerMessage,
          latestRevision: latestRevision
            ? {
                id: latestRevision.id,
                revisionNumber: latestRevision.revisionNumber,
                snapshot: latestRevision.snapshot,
                subtotalCents: latestRevision.subtotalCents,
                adjustmentsCents: latestRevision.adjustmentsCents,
                finalTotalCents: latestRevision.finalTotalCents,
                estimatedDeliveryText: latestRevision.estimatedDeliveryText,
                includedWorkSummary: latestRevision.includedWorkSummary,
                exclusions: latestRevision.exclusions,
                customerSafeTerms: latestRevision.customerSafeTerms,
                sentAt: latestRevision.sentAt,
                lines: latestRevision.lines,
              }
            : null,
          latestDecision: request.quote.decisions[0] ?? null,
        }
      : null,
  };
}

export async function recordCustomerQuoteDecisionByToken({
  token,
  quoteId,
  revisionNumber,
  decision,
  customerMessage,
}: {
  token: string;
  quoteId: string;
  revisionNumber: number;
  decision: "ACCEPTED" | "DECLINED";
  customerMessage?: string;
}) {
  const tokenHash = hashSecret(token);
  const request = await prisma.customBuildRequest.findUnique({
    where: { trackingTokenHash: tokenHash },
    include: {
      quote: {
        include: {
          revisions: {
            where: { revisionNumber },
            include: { lines: true },
            take: 1,
          },
        },
      },
    },
  });
  if (!request || !timingSafeHashEquals(request.trackingTokenHash, tokenHash)) {
    throw new CustomBuildSecurityError("Quote link is invalid or expired.");
  }
  const quote = request.quote;
  const revision = quote?.revisions[0];
  if (!quote || quote.id !== quoteId || !revision) {
    throw new CustomBuildSecurityError("Quote link is invalid or expired.");
  }
  quoteCanReceiveCustomerDecision({
    status: quote.status,
    expiresAt: quote.expiresAt,
    revisionNumber,
    currentRevisionNumber: quote.currentRevisionNumber,
  });
  return prisma.$transaction(async (transaction) => {
    const concurrencyKey = `${quote.id}:${revision.id}:${decision}`;
    await transaction.customBuildQuoteDecision.upsert({
      where: { concurrencyKey },
      create: {
        quoteId: quote.id,
        revisionId: revision.id,
        decision,
        customerMessage: customerMessage?.slice(0, 500) || null,
        concurrencyKey,
      },
      update: {},
    });
    const quoteStatus = decision === "ACCEPTED" ? "ACCEPTED" : "DECLINED";
    const requestStatus =
      decision === "ACCEPTED" ? "QUOTE_ACCEPTED" : "QUOTE_DECLINED";
    await transaction.customBuildQuote.update({
      where: { id: quote.id },
      data: {
        status: quoteStatus,
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.customBuildRequest.update({
      where: { id: request.id },
      data: {
        status: requestStatus,
        concurrencyVersion: { increment: 1 },
      },
    });
    await transaction.customBuildRequestStatusEvent.create({
      data: {
        requestId: request.id,
        previousStatus: request.status,
        newStatus: requestStatus,
        publicMessage:
          decision === "ACCEPTED"
            ? "Quote accepted. No order or payment has been created."
            : "Quote declined.",
        safeMetadata: json({
          quoteId: quote.id,
          revisionNumber,
          noOrderCreated: true,
          noPaymentCreated: true,
        }),
      },
    });
    await transaction.auditLog.create({
      data: {
        action:
          decision === "ACCEPTED"
            ? "custom_build.quote.accepted"
            : "custom_build.quote.declined",
        targetType: "CustomBuildQuote",
        targetId: quote.id,
        metadata: json({
          requestId: request.id,
          revisionNumber,
          noOrderCreated: true,
          noPaymentCreated: true,
        }),
      },
    });
    return { status: quoteStatus };
  });
}

export { publicQuoteNumber };
