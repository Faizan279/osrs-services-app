"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import {
  adjustGoldInventory,
  discardGoldDraft,
  goldActionErrorMessage,
  goldInventoryAdjustmentInputSchema,
  goldMarketInputSchema,
  goldPresetInputSchema,
  goldRateInputSchema,
  publishGoldDraft,
  restoreGoldRevision,
  saveGoldMarket,
  saveGoldPreset,
  saveGoldRate,
} from "@/lib/gold/admin";

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9]+$/i, "Invalid gold identifier.");

const versionSchema = z.coerce.number().int().min(1);

function destination(
  pathname: string,
  state: "saved" | "error",
  message: string,
) {
  const params = new URLSearchParams({ state, message });
  return `${pathname}?${params.toString()}`;
}

function marketId(formData: FormData) {
  return idSchema.parse(formData.get("marketId"));
}

function expectedVersion(formData: FormData) {
  return versionSchema.parse(formData.get("expectedVersion"));
}

function marketInput(formData: FormData) {
  return goldMarketInputSchema.parse({
    marketId: formData.get("marketId"),
    publicName: formData.get("publicName"),
    description: formData.get("description"),
    availabilityState: formData.get("availabilityState"),
    publicTradeInstructions: formData.get("publicTradeInstructions"),
    internalInstructions: formData.get("internalInstructions"),
    rsnRequired: checked(formData, "rsnRequired"),
    secureServiceEnabled: checked(formData, "secureServiceEnabled"),
    secureServicePricingMode: formData.get("secureServicePricingMode"),
    secureServiceFixedMinorUnits: formData.get("secureServiceFixedMinorUnits"),
    secureServiceBps: formData.get("secureServiceBps"),
    secureServiceCustomerBuys: checked(formData, "secureServiceCustomerBuys"),
    secureServiceCustomerSells: checked(formData, "secureServiceCustomerSells"),
    quoteValidityMinutes: formData.get("quoteValidityMinutes"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function rateInput(formData: FormData) {
  return goldRateInputSchema.parse({
    marketId: formData.get("marketId"),
    direction: formData.get("direction"),
    rateMinorUnitsPerMillion: formData.get("rateMinorUnitsPerMillion"),
    minimumQuantity: formData.get("minimumQuantity"),
    maximumQuantity: formData.get("maximumQuantity"),
    automaticReviewMaximum: formData.get("automaticReviewMaximum"),
    effectiveStart: formData.get("effectiveStart"),
    effectiveEnd: formData.get("effectiveEnd"),
    enabled: checked(formData, "enabled"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function presetInput(formData: FormData) {
  return goldPresetInputSchema.parse({
    marketId: formData.get("marketId"),
    direction: formData.get("direction"),
    publicLabel: formData.get("publicLabel"),
    quantity: formData.get("quantity"),
    sortOrder: formData.get("sortOrder"),
    enabled: checked(formData, "enabled"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function inventoryInput(formData: FormData) {
  return goldInventoryAdjustmentInputSchema.parse({
    marketId: formData.get("marketId"),
    entryType: formData.get("entryType"),
    quantity: formData.get("quantity"),
    reason: formData.get("reason"),
    internalNote: formData.get("internalNote"),
    referenceKey: formData.get("referenceKey"),
  });
}

export async function saveGoldMarketAction(formData: FormData) {
  const id = marketId(formData);
  const session = await requireCapability(
    "gold.edit",
    `/admin/gold/markets/${id}`,
  );
  try {
    await saveGoldMarket({
      input: marketInput(formData),
      actorId: session.user.id,
      expectedVersion: expectedVersion(formData),
    });
  } catch (error) {
    redirect(
      destination(
        `/admin/gold/markets/${id}`,
        "error",
        goldActionErrorMessage(error),
      ),
    );
  }
  revalidatePath("/admin/gold");
  redirect(
    destination(`/admin/gold/markets/${id}`, "saved", "Gold market saved."),
  );
}

export async function saveGoldRateAction(formData: FormData) {
  const id = marketId(formData);
  const session = await requireCapability(
    "gold.edit",
    `/admin/gold/markets/${id}/rates`,
  );
  try {
    await saveGoldRate({
      input: rateInput(formData),
      actorId: session.user.id,
      expectedDraftVersion: expectedVersion(formData),
    });
  } catch (error) {
    redirect(
      destination(
        `/admin/gold/markets/${id}/rates`,
        "error",
        goldActionErrorMessage(error),
      ),
    );
  }
  revalidatePath(`/admin/gold/markets/${id}`);
  redirect(
    destination(`/admin/gold/markets/${id}/rates`, "saved", "Gold rate saved."),
  );
}

export async function saveGoldPresetAction(formData: FormData) {
  const id = marketId(formData);
  const rawPresetId = String(formData.get("presetId") ?? "");
  const presetId = rawPresetId ? idSchema.parse(rawPresetId) : undefined;
  const session = await requireCapability(
    "gold.edit",
    `/admin/gold/markets/${id}/presets`,
  );
  try {
    await saveGoldPreset({
      input: presetInput(formData),
      actorId: session.user.id,
      presetId,
      expectedPresetVersion: presetId
        ? versionSchema.parse(formData.get("expectedPresetVersion"))
        : undefined,
    });
  } catch (error) {
    redirect(
      destination(
        `/admin/gold/markets/${id}/presets`,
        "error",
        goldActionErrorMessage(error),
      ),
    );
  }
  revalidatePath(`/admin/gold/markets/${id}`);
  redirect(
    destination(
      `/admin/gold/markets/${id}/presets`,
      "saved",
      "Gold preset saved.",
    ),
  );
}

export async function publishGoldDraftAction(formData: FormData) {
  const id = marketId(formData);
  const session = await requireCapability(
    "gold.publish",
    `/admin/gold/markets/${id}/rates`,
  );
  try {
    await publishGoldDraft({
      marketId: id,
      actorId: session.user.id,
      expectedDraftVersion: expectedVersion(formData),
    });
  } catch (error) {
    redirect(
      destination(
        `/admin/gold/markets/${id}/rates`,
        "error",
        goldActionErrorMessage(error),
      ),
    );
  }
  revalidatePath(`/admin/gold/markets/${id}`);
  redirect(
    destination(
      `/admin/gold/markets/${id}/rates`,
      "saved",
      "Gold draft published.",
    ),
  );
}

export async function discardGoldDraftAction(formData: FormData) {
  const id = marketId(formData);
  const session = await requireCapability(
    "gold.publish",
    `/admin/gold/markets/${id}/rates`,
  );
  try {
    await discardGoldDraft({
      marketId: id,
      actorId: session.user.id,
      expectedDraftVersion: expectedVersion(formData),
    });
  } catch (error) {
    redirect(
      destination(
        `/admin/gold/markets/${id}/rates`,
        "error",
        goldActionErrorMessage(error),
      ),
    );
  }
  revalidatePath(`/admin/gold/markets/${id}`);
  redirect(
    destination(
      `/admin/gold/markets/${id}/rates`,
      "saved",
      "Gold draft discarded.",
    ),
  );
}

export async function restoreGoldRevisionAction(formData: FormData) {
  const id = marketId(formData);
  const revisionId = idSchema.parse(formData.get("revisionId"));
  const session = await requireCapability(
    "gold.publish",
    `/admin/gold/markets/${id}/history`,
  );
  try {
    await restoreGoldRevision({
      marketId: id,
      revisionId,
      actorId: session.user.id,
      expectedDraftVersion: expectedVersion(formData),
    });
  } catch (error) {
    redirect(
      destination(
        `/admin/gold/markets/${id}/history`,
        "error",
        goldActionErrorMessage(error),
      ),
    );
  }
  revalidatePath(`/admin/gold/markets/${id}`);
  redirect(
    destination(
      `/admin/gold/markets/${id}/history`,
      "saved",
      "Gold revision restored into the draft.",
    ),
  );
}

export async function adjustGoldInventoryAction(formData: FormData) {
  const id = marketId(formData);
  const session = await requireCapability(
    "gold.inventory.adjust",
    `/admin/gold/markets/${id}/inventory`,
  );
  try {
    await adjustGoldInventory({
      input: inventoryInput(formData),
      actorId: session.user.id,
      expectedStockVersion: expectedVersion(formData),
    });
  } catch (error) {
    redirect(
      destination(
        `/admin/gold/markets/${id}/inventory`,
        "error",
        goldActionErrorMessage(error),
      ),
    );
  }
  revalidatePath(`/admin/gold/markets/${id}`);
  redirect(
    destination(
      `/admin/gold/markets/${id}/inventory`,
      "saved",
      "Inventory adjustment recorded.",
    ),
  );
}
