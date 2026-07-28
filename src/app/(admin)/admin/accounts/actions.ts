"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import type { PermissionKey } from "@/lib/auth/permissions";
import {
  accountActionErrorMessage,
  accountAvailabilityInputSchema,
  accountFeatureInputSchema,
  accountHandoverInputSchema,
  accountHoldInputSchema,
  accountImageInputSchema,
  accountListingInputSchema,
  accountStatInputSchema,
  accountUnlockInputSchema,
  approveAccountListing,
  assertNoCredentialFields,
  changeAccountAvailability,
  createAccountHold,
  discardAccountListingDraft,
  expireAccountHolds,
  markAccountListingSold,
  publishAccountListing,
  rejectAccountListing,
  releaseAccountHold,
  reopenAccountListing,
  restoreAccountListingRevision,
  saveAccountFeature,
  saveAccountImage,
  saveAccountListing,
  saveAccountStat,
  saveAccountUnlock,
  updateAccountHandoverChecklist,
} from "@/lib/accounts/admin";

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9]+$/i, "Invalid account marketplace identifier.");

const versionSchema = z.coerce.number().int().min(1);

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function optionalId(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();
  return value ? idSchema.parse(value) : undefined;
}

function destination(
  pathname: string,
  state: "saved" | "error",
  message: string,
) {
  const params = new URLSearchParams({ state, message });
  return `${pathname}?${params.toString()}`;
}

function listingId(formData: FormData) {
  return idSchema.parse(formData.get("listingId"));
}

function expectedVersion(formData: FormData, key = "expectedVersion") {
  return versionSchema.parse(formData.get(key));
}

function assertSafeForm(formData: FormData) {
  assertNoCredentialFields(Object.fromEntries(formData.entries()));
}

async function runAction({
  capability,
  path,
  successMessage,
  revalidate = [],
  body,
}: {
  capability: PermissionKey;
  path: string;
  successMessage: string;
  revalidate?: string[];
  body: (actorId: string) => Promise<void>;
}) {
  const session = await requireCapability(capability, path);
  try {
    await body(session.user.id);
  } catch (error) {
    redirect(destination(path, "error", accountActionErrorMessage(error)));
  }
  for (const item of revalidate) revalidatePath(item);
  redirect(destination(path, "saved", successMessage));
}

function listingInput(formData: FormData) {
  assertSafeForm(formData);
  return accountListingInputSchema.parse({
    listingId: optionalId(formData, "listingId"),
    marketplaceId: formData.get("marketplaceId"),
    publicTitle: formData.get("publicTitle"),
    slug: formData.get("slug"),
    shortDescription: formData.get("shortDescription"),
    fullDescription: formData.get("fullDescription"),
    internalReferenceCode: formData.get("internalReferenceCode"),
    currencyCode: formData.get("currencyCode"),
    basePriceCents: formData.get("basePriceCents"),
    gameMode: formData.get("gameMode"),
    combatLevel: formData.get("combatLevel"),
    totalLevel: formData.get("totalLevel"),
    questPoints: formData.get("questPoints"),
    accountAgeLabel: formData.get("accountAgeLabel"),
    membershipStateLabel: formData.get("membershipStateLabel"),
    availability: formData.get("availability"),
    isFeatured: checked(formData, "isFeatured"),
    sortOrder: formData.get("sortOrder"),
    publicBadgeText: formData.get("publicBadgeText"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function statInput(formData: FormData) {
  assertSafeForm(formData);
  return accountStatInputSchema.parse({
    listingId: formData.get("listingId"),
    statId: optionalId(formData, "statId"),
    statKey: formData.get("statKey"),
    publicLabel: formData.get("publicLabel"),
    value: formData.get("value"),
    maximumValue: formData.get("maximumValue"),
    statType: formData.get("statType"),
    statGroup: formData.get("statGroup"),
    sortOrder: formData.get("sortOrder"),
    isPublic: checked(formData, "isPublic"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function unlockInput(formData: FormData) {
  assertSafeForm(formData);
  return accountUnlockInputSchema.parse({
    listingId: formData.get("listingId"),
    unlockId: optionalId(formData, "unlockId"),
    unlockKey: formData.get("unlockKey"),
    publicLabel: formData.get("publicLabel"),
    description: formData.get("description"),
    unlockType: formData.get("unlockType"),
    sortOrder: formData.get("sortOrder"),
    isPublic: checked(formData, "isPublic"),
    filterable: checked(formData, "filterable"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function featureInput(formData: FormData) {
  assertSafeForm(formData);
  return accountFeatureInputSchema.parse({
    listingId: formData.get("listingId"),
    featureId: optionalId(formData, "featureId"),
    featureKey: formData.get("featureKey"),
    publicLabel: formData.get("publicLabel"),
    description: formData.get("description"),
    sortOrder: formData.get("sortOrder"),
    isPublic: checked(formData, "isPublic"),
    filterable: checked(formData, "filterable"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function imageInput(formData: FormData) {
  assertSafeForm(formData);
  return accountImageInputSchema.parse({
    listingId: formData.get("listingId"),
    imageId: optionalId(formData, "imageId"),
    imageType: formData.get("imageType"),
    assetPath: formData.get("assetPath"),
    altText: formData.get("altText"),
    caption: formData.get("caption"),
    sortOrder: formData.get("sortOrder"),
    isPublic: checked(formData, "isPublic"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function handoverInput(formData: FormData) {
  assertSafeForm(formData);
  return accountHandoverInputSchema.parse({
    listingId: formData.get("listingId"),
    listingSecurityReviewed: checked(formData, "listingSecurityReviewed"),
    emailTransferRequired: checked(formData, "emailTransferRequired"),
    recoveryReviewRequired: checked(formData, "recoveryReviewRequired"),
    authenticatorResetRequired: checked(formData, "authenticatorResetRequired"),
    bankPinResetRequired: checked(formData, "bankPinResetRequired"),
    previousSessionsReviewRequired: checked(
      formData,
      "previousSessionsReviewRequired",
    ),
    handoverInstructionsPrepared: checked(
      formData,
      "handoverInstructionsPrepared",
    ),
    ownershipEvidenceReviewed: checked(formData, "ownershipEvidenceReviewed"),
    readyForFutureHandover: checked(formData, "readyForFutureHandover"),
    finalAdminApprovalRequired: checked(formData, "finalAdminApprovalRequired"),
    readiness: formData.get("readiness"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

export async function saveAccountListingAction(formData: FormData) {
  const editingId = optionalId(formData, "listingId");
  const path = editingId
    ? `/admin/accounts/listings/${editingId}`
    : "/admin/accounts/listings/new";
  const session = await requireCapability("accounts.edit", path);
  let savedId = editingId;
  try {
    const input = listingInput(formData);
    const result = await saveAccountListing({
      input,
      actorId: session.user.id,
      expectedVersion: input.listingId ? expectedVersion(formData) : undefined,
    });
    savedId = result.id;
  } catch (error) {
    redirect(destination(path, "error", accountActionErrorMessage(error)));
  }
  revalidatePath("/admin/accounts");
  redirect(
    destination(
      `/admin/accounts/listings/${savedId}`,
      "saved",
      editingId ? "Account listing saved." : "Account listing created.",
    ),
  );
}

export async function saveAccountStatAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/stats`;
  await runAction({
    capability: "accounts.edit",
    path,
    successMessage: "Account stat saved.",
    revalidate: [`/admin/accounts/listings/${id}`],
    body: async (actorId) => {
      const input = statInput(formData);
      await saveAccountStat({
        input,
        actorId,
        expectedVersion: input.statId
          ? expectedVersion(formData, "expectedChildVersion")
          : undefined,
      });
    },
  });
}

export async function saveAccountUnlockAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/unlocks`;
  await runAction({
    capability: "accounts.edit",
    path,
    successMessage: "Account unlock saved.",
    revalidate: [`/admin/accounts/listings/${id}`],
    body: async (actorId) => {
      const input = unlockInput(formData);
      await saveAccountUnlock({
        input,
        actorId,
        expectedVersion: input.unlockId
          ? expectedVersion(formData, "expectedChildVersion")
          : undefined,
      });
    },
  });
}

export async function saveAccountFeatureAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/features`;
  await runAction({
    capability: "accounts.edit",
    path,
    successMessage: "Account feature saved.",
    revalidate: [`/admin/accounts/listings/${id}`],
    body: async (actorId) => {
      const input = featureInput(formData);
      await saveAccountFeature({
        input,
        actorId,
        expectedVersion: input.featureId
          ? expectedVersion(formData, "expectedChildVersion")
          : undefined,
      });
    },
  });
}

export async function saveAccountImageAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/media`;
  await runAction({
    capability: "accounts.edit",
    path,
    successMessage: "Account image saved.",
    revalidate: [`/admin/accounts/listings/${id}`],
    body: async (actorId) => {
      const input = imageInput(formData);
      await saveAccountImage({
        input,
        actorId,
        expectedVersion: input.imageId
          ? expectedVersion(formData, "expectedChildVersion")
          : undefined,
      });
    },
  });
}

export async function approveAccountListingAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}`;
  await runAction({
    capability: "accounts.approve",
    path,
    successMessage: "Account listing approved.",
    revalidate: [path],
    body: async (actorId) => {
      await approveAccountListing({
        listingId: id,
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function rejectAccountListingAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}`;
  await runAction({
    capability: "accounts.approve",
    path,
    successMessage: "Account listing rejected.",
    revalidate: [path],
    body: async (actorId) => {
      await rejectAccountListing({
        listingId: id,
        actorId,
        expectedVersion: expectedVersion(formData),
        reason: String(formData.get("reason") ?? ""),
      });
    },
  });
}

export async function publishAccountListingAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}`;
  await runAction({
    capability: "accounts.publish",
    path,
    successMessage: "Account listing published.",
    revalidate: [path, "/accounts"],
    body: async (actorId) => {
      await publishAccountListing({
        listingId: id,
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function discardAccountListingDraftAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/history`;
  await runAction({
    capability: "accounts.publish",
    path,
    successMessage: "Draft restored from live revision.",
    revalidate: [`/admin/accounts/listings/${id}`],
    body: async (actorId) => {
      await discardAccountListingDraft({
        listingId: id,
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function restoreAccountListingRevisionAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/history`;
  await runAction({
    capability: "accounts.publish",
    path,
    successMessage: "Revision restored into the draft.",
    revalidate: [`/admin/accounts/listings/${id}`],
    body: async (actorId) => {
      await restoreAccountListingRevision({
        listingId: id,
        revisionId: idSchema.parse(formData.get("revisionId")),
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function changeAccountAvailabilityAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/availability`;
  await runAction({
    capability: "accounts.availability.manage",
    path,
    successMessage: "Availability updated.",
    revalidate: [`/admin/accounts/listings/${id}`, "/accounts"],
    body: async (actorId) => {
      const input = accountAvailabilityInputSchema.parse({
        listingId: formData.get("listingId"),
        availability: formData.get("availability"),
        reason: formData.get("reason"),
      });
      await changeAccountAvailability({
        input,
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function createAccountHoldAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/availability`;
  await runAction({
    capability: "accounts.availability.manage",
    path,
    successMessage: "Admin hold created.",
    revalidate: [`/admin/accounts/listings/${id}`, "/accounts"],
    body: async (actorId) => {
      const input = accountHoldInputSchema.parse({
        listingId: formData.get("listingId"),
        expiresAt: formData.get("expiresAt"),
        reason: formData.get("reason"),
      });
      await createAccountHold({
        input,
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function releaseAccountHoldAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/availability`;
  await runAction({
    capability: "accounts.availability.manage",
    path,
    successMessage: "Admin hold released.",
    revalidate: [`/admin/accounts/listings/${id}`, "/accounts"],
    body: async (actorId) => {
      await releaseAccountHold({
        holdId: idSchema.parse(formData.get("holdId")),
        listingId: id,
        actorId,
        expectedHoldVersion: expectedVersion(formData, "expectedHoldVersion"),
      });
    },
  });
}

export async function expireAccountHoldsAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/availability`;
  await runAction({
    capability: "accounts.availability.manage",
    path,
    successMessage: "Expired holds resolved.",
    revalidate: [`/admin/accounts/listings/${id}`, "/accounts"],
    body: async (actorId) => {
      await expireAccountHolds({ actorId });
    },
  });
}

export async function markAccountListingSoldAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/availability`;
  await runAction({
    capability: "accounts.availability.manage",
    path,
    successMessage: "Listing marked sold.",
    revalidate: [`/admin/accounts/listings/${id}`, "/accounts"],
    body: async (actorId) => {
      await markAccountListingSold({
        listingId: id,
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function reopenAccountListingAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/availability`;
  await runAction({
    capability: "accounts.availability.manage",
    path,
    successMessage: "Listing reopened as available.",
    revalidate: [`/admin/accounts/listings/${id}`, "/accounts"],
    body: async (actorId) => {
      await reopenAccountListing({
        listingId: id,
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function updateAccountHandoverChecklistAction(formData: FormData) {
  const id = listingId(formData);
  const path = `/admin/accounts/listings/${id}/handover`;
  await runAction({
    capability: "accounts.handover.review",
    path,
    successMessage: "Handover readiness saved.",
    revalidate: [`/admin/accounts/listings/${id}`],
    body: async (actorId) => {
      await updateAccountHandoverChecklist({
        input: handoverInput(formData),
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}
