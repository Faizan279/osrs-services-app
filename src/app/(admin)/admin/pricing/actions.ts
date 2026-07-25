"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import {
  discardPricingDraft,
  pricingActionErrorMessage,
  pricingRuleInputSchema,
  publishPricingDraft,
  restorePricingRevision,
  savePricingRule,
} from "@/lib/pricing/admin";

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9]+$/i, "Invalid pricing identifier.");

const versionSchema = z.coerce.number().int().min(1);

function destination(
  pathname: string,
  state: "saved" | "error",
  message: string,
) {
  const params = new URLSearchParams({ state, message });
  return `${pathname}?${params.toString()}`;
}

function ruleInput(formData: FormData) {
  return pricingRuleInputSchema.parse({
    ruleSetId: formData.get("ruleSetId"),
    publicLabel: formData.get("publicLabel"),
    internalDescription: formData.get("internalDescription"),
    enabled: checked(formData, "enabled"),
    ruleType: formData.get("ruleType"),
    amountCents: formData.get("amountCents"),
    valueBps: formData.get("valueBps"),
    priority: formData.get("priority"),
    exclusiveGroupKey: formData.get("exclusiveGroupKey"),
    effectiveStart: formData.get("effectiveStart"),
    effectiveEnd: formData.get("effectiveEnd"),
    needsClientReview: checked(formData, "needsClientReview"),
    scope: formData.get("scope"),
    engineType: formData.get("engineType"),
    categoryId: formData.get("categoryId"),
    serviceId: formData.get("serviceId"),
  });
}

export async function savePricingRuleAction(formData: FormData) {
  const rawRuleId = String(formData.get("ruleId") ?? "");
  const ruleId = rawRuleId ? idSchema.parse(rawRuleId) : undefined;
  const returnPath = ruleId
    ? `/admin/pricing/rules/${ruleId}`
    : "/admin/pricing/rules/new";
  const session = await requireCapability("pricing.edit", returnPath);
  let savedRuleId: string;
  try {
    const result = await savePricingRule({
      input: ruleInput(formData),
      actorId: session.user.id,
      expectedDraftVersion: versionSchema.parse(
        formData.get("expectedDraftVersion"),
      ),
      ruleId,
      expectedRuleVersion: ruleId
        ? versionSchema.parse(formData.get("expectedRuleVersion"))
        : undefined,
    });
    savedRuleId = result.id;
  } catch (error) {
    redirect(
      destination(returnPath, "error", pricingActionErrorMessage(error)),
    );
  }
  revalidatePath("/admin/pricing");
  redirect(
    destination(
      `/admin/pricing/rules/${savedRuleId}`,
      "saved",
      ruleId ? "Pricing rule saved." : "Pricing rule created.",
    ),
  );
}

export async function publishPricingDraftAction(formData: FormData) {
  const session = await requireCapability("pricing.publish", "/admin/pricing");
  try {
    await publishPricingDraft({
      actorId: session.user.id,
      expectedDraftVersion: versionSchema.parse(
        formData.get("expectedDraftVersion"),
      ),
    });
  } catch (error) {
    redirect(
      destination("/admin/pricing", "error", pricingActionErrorMessage(error)),
    );
  }
  revalidatePath("/admin/pricing");
  redirect(destination("/admin/pricing", "saved", "Pricing draft published."));
}

export async function discardPricingDraftAction(formData: FormData) {
  const session = await requireCapability("pricing.publish", "/admin/pricing");
  try {
    await discardPricingDraft({
      actorId: session.user.id,
      expectedDraftVersion: versionSchema.parse(
        formData.get("expectedDraftVersion"),
      ),
    });
  } catch (error) {
    redirect(
      destination("/admin/pricing", "error", pricingActionErrorMessage(error)),
    );
  }
  revalidatePath("/admin/pricing");
  redirect(destination("/admin/pricing", "saved", "Pricing draft discarded."));
}

export async function restorePricingRevisionAction(formData: FormData) {
  const revisionId = idSchema.parse(formData.get("revisionId"));
  const session = await requireCapability(
    "pricing.publish",
    "/admin/pricing/history",
  );
  try {
    await restorePricingRevision({
      revisionId,
      actorId: session.user.id,
      expectedDraftVersion: versionSchema.parse(
        formData.get("expectedDraftVersion"),
      ),
    });
  } catch (error) {
    redirect(
      destination(
        "/admin/pricing/history",
        "error",
        pricingActionErrorMessage(error),
      ),
    );
  }
  revalidatePath("/admin/pricing");
  redirect(
    destination(
      "/admin/pricing/history",
      "saved",
      "Revision restored into the draft.",
    ),
  );
}
