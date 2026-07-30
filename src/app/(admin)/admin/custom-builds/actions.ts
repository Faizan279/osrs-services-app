"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import type { PermissionKey } from "@/lib/auth/permissions";
import {
  createCustomBuildQuoteRevision,
  customBuildActionErrorMessage,
  customBuildAttachmentReviewInputSchema,
  customBuildObjectiveInputSchema,
  customBuildObjectiveRuleInputSchema,
  customBuildQuoteInputSchema,
  customBuildServiceInputSchema,
  customBuildSkillRuleInputSchema,
  customBuildStatusInputSchema,
  discardCustomBuildDraft,
  expireCustomBuildQuotes,
  publishCustomBuildConfiguration,
  restoreCustomBuildRevision,
  reviewCustomBuildAttachment,
  saveCustomBuildObjective,
  saveCustomBuildObjectiveRule,
  saveCustomBuildServiceConfig,
  saveCustomBuildSkillRule,
  sendCustomBuildQuote,
  transitionCustomBuildRequest,
  voidCustomBuildQuote,
} from "@/lib/custom-build/admin";

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9]+$/i);
const versionSchema = z.coerce.number().int().min(1);

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function optionalId(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? idSchema.parse(value) : undefined;
}

function nullableMode(formData: FormData) {
  const value = String(formData.get("gameMode") ?? "").trim();
  return value || null;
}

function destination(
  pathname: string,
  state: "saved" | "error",
  message: string,
) {
  return `${pathname}?${new URLSearchParams({ state, message }).toString()}`;
}

async function runAction({
  capability,
  path,
  successMessage,
  body,
  revalidate = [],
}: {
  capability: PermissionKey;
  path: string;
  successMessage: string;
  body: (actorId: string) => Promise<void>;
  revalidate?: string[];
}) {
  const session = await requireCapability(capability, path);
  try {
    await body(session.user.id);
  } catch (error) {
    redirect(destination(path, "error", customBuildActionErrorMessage(error)));
  }
  for (const item of revalidate) revalidatePath(item);
  redirect(destination(path, "saved", successMessage));
}

export async function saveCustomBuildConfigAction(formData: FormData) {
  const path = "/admin/custom-builds/config";
  await runAction({
    capability: "custom_builds.edit",
    path,
    successMessage: "Custom-build configuration saved.",
    revalidate: ["/admin/custom-builds", "/custom-account-build"],
    body: async (actorId) => {
      const input = customBuildServiceInputSchema.parse({
        serviceConfigId: formData.get("serviceConfigId"),
        publicName: formData.get("publicName"),
        slug: formData.get("slug"),
        publicDescription: formData.get("publicDescription"),
        publicInstructions: formData.get("publicInstructions"),
        privateInternalInstructions: formData.get(
          "privateInternalInstructions",
        ),
        availabilityState: formData.get("availabilityState"),
        minimumAutomaticEstimateCents: formData.get(
          "minimumAutomaticEstimateCents",
        ),
        maximumAutomaticEstimateCents: formData.get(
          "maximumAutomaticEstimateCents",
        ),
        quoteValidityDaysDefault: formData.get("quoteValidityDaysDefault"),
        attachmentPolicy: formData.get("attachmentPolicy"),
        maxAttachments: formData.get("maxAttachments"),
        maxAttachmentBytes: formData.get("maxAttachmentBytes"),
        maxTotalAttachmentBytes: formData.get("maxTotalAttachmentBytes"),
        customerNoteMaxLength: formData.get("customerNoteMaxLength"),
        needsClientReview: checked(formData, "needsClientReview"),
      });
      await saveCustomBuildServiceConfig({
        input,
        actorId,
        expectedVersion: versionSchema.parse(formData.get("expectedVersion")),
      });
    },
  });
}

export async function saveCustomBuildSkillRuleAction(formData: FormData) {
  const path = "/admin/custom-builds/rules";
  await runAction({
    capability: "custom_builds.edit",
    path,
    successMessage: "Skill rule saved.",
    revalidate: [path],
    body: async (actorId) => {
      const ruleId = optionalId(formData, "ruleId");
      const input = customBuildSkillRuleInputSchema.parse({
        ruleId,
        ruleSetId: formData.get("ruleSetId"),
        skillKey: formData.get("skillKey"),
        pricingMode: formData.get("pricingMode"),
        gameMode: nullableMode(formData),
        minimumLevel: formData.get("minimumLevel"),
        maximumLevel: formData.get("maximumLevel"),
        minimumXp: formData.get("minimumXp"),
        maximumXp: formData.get("maximumXp"),
        centsPerMillionXp: formData.get("centsPerMillionXp"),
        levelBandStart: formData.get("levelBandStart"),
        levelBandEnd: formData.get("levelBandEnd"),
        fixedPriceCents: formData.get("fixedPriceCents"),
        minimumPriceCents: formData.get("minimumPriceCents"),
        enabled: checked(formData, "enabled"),
        manualReviewOnly: checked(formData, "manualReviewOnly"),
        needsClientReview: checked(formData, "needsClientReview"),
      });
      await saveCustomBuildSkillRule({
        input,
        actorId,
        expectedVersion: ruleId
          ? versionSchema.parse(formData.get("expectedChildVersion"))
          : undefined,
      });
    },
  });
}

export async function saveCustomBuildObjectiveAction(formData: FormData) {
  const path = "/admin/custom-builds/objectives";
  await runAction({
    capability: "custom_builds.edit",
    path,
    successMessage: "Objective saved.",
    revalidate: [path, "/admin/custom-builds/rules"],
    body: async (actorId) => {
      const objectiveId = optionalId(formData, "objectiveId");
      const input = customBuildObjectiveInputSchema.parse({
        objectiveId,
        customBuildServiceId: formData.get("customBuildServiceId"),
        objectiveType: formData.get("objectiveType"),
        objectiveKey: formData.get("objectiveKey"),
        publicName: formData.get("publicName"),
        publicDescription: formData.get("publicDescription"),
        objectiveGroup: formData.get("objectiveGroup"),
        difficultyTier: formData.get("difficultyTier"),
        gameMode: nullableMode(formData),
        prerequisiteText: formData.get("prerequisiteText"),
        sortOrder: formData.get("sortOrder"),
        enabled: checked(formData, "enabled"),
        needsClientReview: checked(formData, "needsClientReview"),
      });
      await saveCustomBuildObjective({
        input,
        actorId,
        expectedVersion: objectiveId
          ? versionSchema.parse(formData.get("expectedChildVersion"))
          : undefined,
      });
    },
  });
}

export async function saveCustomBuildObjectiveRuleAction(formData: FormData) {
  const path = "/admin/custom-builds/rules";
  await runAction({
    capability: "custom_builds.edit",
    path,
    successMessage: "Objective rule saved.",
    revalidate: [path],
    body: async (actorId) => {
      const ruleId = optionalId(formData, "ruleId");
      const input = customBuildObjectiveRuleInputSchema.parse({
        ruleId,
        ruleSetId: formData.get("ruleSetId"),
        objectiveId: formData.get("objectiveId"),
        pricingMode: formData.get("pricingMode"),
        fixedPriceCents: formData.get("fixedPriceCents"),
        percentBps: formData.get("percentBps"),
        gameMode: nullableMode(formData),
        manualReviewOnly: checked(formData, "manualReviewOnly"),
        enabled: checked(formData, "enabled"),
        needsClientReview: checked(formData, "needsClientReview"),
      });
      await saveCustomBuildObjectiveRule({
        input,
        actorId,
        expectedVersion: ruleId
          ? versionSchema.parse(formData.get("expectedChildVersion"))
          : undefined,
      });
    },
  });
}

export async function publishCustomBuildAction(formData: FormData) {
  const path = "/admin/custom-builds/revisions";
  await runAction({
    capability: "custom_builds.publish",
    path,
    successMessage: "Custom-build configuration published.",
    revalidate: [path, "/custom-account-build"],
    body: async (actorId) => {
      await publishCustomBuildConfiguration({
        serviceConfigId: idSchema.parse(formData.get("serviceConfigId")),
        actorId,
        expectedVersion: versionSchema.parse(formData.get("expectedVersion")),
      });
    },
  });
}

export async function discardCustomBuildDraftAction(formData: FormData) {
  const path = "/admin/custom-builds/revisions";
  await runAction({
    capability: "custom_builds.publish",
    path,
    successMessage: "Draft restored from latest revision.",
    revalidate: [path, "/admin/custom-builds/config"],
    body: async (actorId) => {
      await discardCustomBuildDraft({
        serviceConfigId: idSchema.parse(formData.get("serviceConfigId")),
        actorId,
        expectedVersion: versionSchema.parse(formData.get("expectedVersion")),
      });
    },
  });
}

export async function restoreCustomBuildRevisionAction(formData: FormData) {
  const path = "/admin/custom-builds/revisions";
  await runAction({
    capability: "custom_builds.publish",
    path,
    successMessage: "Revision restored into draft.",
    revalidate: [path, "/admin/custom-builds/config"],
    body: async (actorId) => {
      await restoreCustomBuildRevision({
        serviceConfigId: idSchema.parse(formData.get("serviceConfigId")),
        revisionId: idSchema.parse(formData.get("revisionId")),
        actorId,
        expectedVersion: versionSchema.parse(formData.get("expectedVersion")),
      });
    },
  });
}

export async function transitionCustomBuildRequestAction(formData: FormData) {
  const requestId = idSchema.parse(formData.get("requestId"));
  const path = `/admin/custom-builds/requests/${requestId}`;
  await runAction({
    capability: "custom_builds.requests.review",
    path,
    successMessage: "Request status updated.",
    revalidate: [path, "/admin/custom-builds/requests"],
    body: async (actorId) => {
      const input = customBuildStatusInputSchema.parse({
        requestId,
        nextStatus: formData.get("nextStatus"),
        publicMessage: formData.get("publicMessage"),
        internalReason: formData.get("internalReason"),
      });
      await transitionCustomBuildRequest({
        input,
        actorId,
        expectedVersion: versionSchema.parse(formData.get("expectedVersion")),
      });
    },
  });
}

export async function reviewCustomBuildAttachmentAction(formData: FormData) {
  const requestId = idSchema.parse(formData.get("requestId"));
  const path = `/admin/custom-builds/requests/${requestId}/attachments`;
  await runAction({
    capability: "custom_builds.attachments.review",
    path,
    successMessage: "Attachment review saved.",
    revalidate: [path, `/admin/custom-builds/requests/${requestId}`],
    body: async (actorId) => {
      const input = customBuildAttachmentReviewInputSchema.parse({
        requestId,
        attachmentId: formData.get("attachmentId"),
        status: formData.get("status"),
        reviewNote: formData.get("reviewNote"),
      });
      await reviewCustomBuildAttachment({
        input,
        actorId,
        expectedVersion: versionSchema.parse(
          formData.get("expectedChildVersion"),
        ),
      });
    },
  });
}

export async function createCustomBuildQuoteRevisionAction(formData: FormData) {
  const requestId = idSchema.parse(formData.get("requestId"));
  const path = `/admin/custom-builds/requests/${requestId}/quote`;
  await runAction({
    capability: "custom_builds.quotes.manage",
    path,
    successMessage: "Quote revision created.",
    revalidate: [path, `/admin/custom-builds/requests/${requestId}`],
    body: async (actorId) => {
      const input = customBuildQuoteInputSchema.parse({
        requestId,
        quoteId: optionalId(formData, "quoteId"),
        customerMessage: formData.get("customerMessage"),
        privateInternalNote: formData.get("privateInternalNote"),
        expiresAt: formData.get("expiresAt"),
        estimatedDeliveryText: formData.get("estimatedDeliveryText"),
        includedWorkSummary: formData.get("includedWorkSummary"),
        exclusions: formData.get("exclusions"),
        customerSafeTerms: formData.get("customerSafeTerms"),
        lineDescription: formData.get("lineDescription"),
        quantity: formData.get("quantity"),
        unitAmountCents: formData.get("unitAmountCents"),
        adjustmentsCents: formData.get("adjustmentsCents"),
      });
      await createCustomBuildQuoteRevision({
        input,
        actorId,
        expectedRequestVersion: versionSchema.parse(
          formData.get("expectedVersion"),
        ),
      });
    },
  });
}

export async function sendCustomBuildQuoteAction(formData: FormData) {
  const requestId = idSchema.parse(formData.get("requestId"));
  const path = `/admin/custom-builds/requests/${requestId}/quote`;
  await runAction({
    capability: "custom_builds.quotes.manage",
    path,
    successMessage: "Quote sent.",
    revalidate: [path, `/admin/custom-builds/requests/${requestId}`],
    body: async (actorId) => {
      await sendCustomBuildQuote({
        quoteId: idSchema.parse(formData.get("quoteId")),
        actorId,
        expectedVersion: versionSchema.parse(
          formData.get("expectedQuoteVersion"),
        ),
      });
    },
  });
}

export async function voidCustomBuildQuoteAction(formData: FormData) {
  const requestId = idSchema.parse(formData.get("requestId"));
  const path = `/admin/custom-builds/requests/${requestId}/quote`;
  await runAction({
    capability: "custom_builds.quotes.manage",
    path,
    successMessage: "Quote voided.",
    revalidate: [path, `/admin/custom-builds/requests/${requestId}`],
    body: async (actorId) => {
      await voidCustomBuildQuote({
        quoteId: idSchema.parse(formData.get("quoteId")),
        actorId,
        expectedVersion: versionSchema.parse(
          formData.get("expectedQuoteVersion"),
        ),
      });
    },
  });
}

export async function expireCustomBuildQuotesAction() {
  const path = "/admin/custom-builds/requests";
  await runAction({
    capability: "custom_builds.quotes.manage",
    path,
    successMessage: "Expired quotes resolved.",
    revalidate: [path],
    body: async (actorId) => {
      await expireCustomBuildQuotes({ actorId });
    },
  });
}
