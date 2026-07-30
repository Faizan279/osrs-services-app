"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import type { PermissionKey } from "@/lib/auth/permissions";
import {
  discardProductDraft,
  productActionErrorMessage,
  productCategoryInputSchema,
  productImageInputSchema,
  productInputSchema,
  productInventoryAdjustmentInputSchema,
  productPriceTierInputSchema,
  productReservationInputSchema,
  productVariantInputSchema,
  publishProduct,
  restoreProductRevision,
  saveProduct,
  saveProductCategory,
  saveProductImage,
  saveProductPriceTier,
  saveProductVariant,
} from "@/lib/products/admin";
import { adjustProductInventory } from "@/lib/products/inventory";
import {
  createProductInventoryReservation,
  expireProductInventoryReservations,
  releaseProductInventoryReservation,
} from "@/lib/products/reservations";

const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9]+$/i, "Invalid product marketplace identifier.");

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

function expectedVersion(formData: FormData, key = "expectedVersion") {
  return versionSchema.parse(formData.get(key));
}

function productId(formData: FormData) {
  return idSchema.parse(formData.get("productId"));
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
    redirect(destination(path, "error", productActionErrorMessage(error)));
  }
  for (const item of revalidate) revalidatePath(item);
  redirect(destination(path, "saved", successMessage));
}

export async function saveProductCategoryAction(formData: FormData) {
  const editingId = optionalId(formData, "categoryId");
  const path = "/admin/products/categories";
  await runAction({
    capability: "products.edit",
    path,
    successMessage: "Product category saved.",
    revalidate: [path, "/products"],
    body: async (actorId) => {
      const input = productCategoryInputSchema.parse({
        categoryId: editingId,
        marketplaceId: formData.get("marketplaceId"),
        stableKey: formData.get("stableKey") || undefined,
        publicName: formData.get("publicName"),
        slug: formData.get("slug"),
        publicDescription: formData.get("publicDescription"),
        productType: formData.get("productType"),
        sortOrder: formData.get("sortOrder"),
        enabled: checked(formData, "enabled"),
        needsClientReview: checked(formData, "needsClientReview"),
      });
      await saveProductCategory({
        input,
        actorId,
        expectedVersion: editingId ? expectedVersion(formData) : undefined,
      });
    },
  });
}

export async function saveProductAction(formData: FormData) {
  const editingId = optionalId(formData, "productId");
  const path = editingId
    ? `/admin/products/${editingId}`
    : "/admin/products/new";
  const session = await requireCapability("products.edit", path);
  let savedId = editingId;
  try {
    const input = productInputSchema.parse({
      productId: editingId,
      marketplaceId: formData.get("marketplaceId"),
      categoryId: formData.get("categoryId"),
      publicTitle: formData.get("publicTitle"),
      slug: formData.get("slug"),
      shortDescription: formData.get("shortDescription"),
      fullDescription: formData.get("fullDescription"),
      internalReferenceCode: formData.get("internalReferenceCode"),
      productType: formData.get("productType"),
      currencyCode: formData.get("currencyCode"),
      isFeatured: checked(formData, "isFeatured"),
      publicBadgeText: formData.get("publicBadgeText"),
      availabilityState: formData.get("availabilityState"),
      sortOrder: formData.get("sortOrder"),
      needsClientReview: checked(formData, "needsClientReview"),
    });
    const saved = await saveProduct({
      input,
      actorId: session.user.id,
      expectedVersion: editingId ? expectedVersion(formData) : undefined,
    });
    savedId = saved.id;
  } catch (error) {
    redirect(destination(path, "error", productActionErrorMessage(error)));
  }
  revalidatePath("/admin/products");
  redirect(
    destination(
      `/admin/products/${savedId}`,
      "saved",
      editingId ? "Product saved." : "Product created.",
    ),
  );
}

export async function saveProductVariantAction(formData: FormData) {
  const id = productId(formData);
  const path = `/admin/products/${id}/variants`;
  await runAction({
    capability: "products.edit",
    path,
    successMessage: "Product variant saved.",
    revalidate: [`/admin/products/${id}`, "/products"],
    body: async (actorId) => {
      const input = productVariantInputSchema.parse({
        productId: formData.get("productId"),
        variantId: optionalId(formData, "variantId"),
        stableKey: formData.get("stableKey") || undefined,
        publicName: formData.get("publicName"),
        publicSku: formData.get("publicSku"),
        internalSku: formData.get("internalSku"),
        unitLabel: formData.get("unitLabel"),
        priceMode: formData.get("priceMode"),
        baseUnitPriceCents: formData.get("baseUnitPriceCents"),
        minimumQuantity: formData.get("minimumQuantity"),
        maximumQuantity: formData.get("maximumQuantity"),
        quantityIncrement: formData.get("quantityIncrement"),
        stockMode: formData.get("stockMode"),
        availabilityState: formData.get("availabilityState"),
        status: formData.get("status"),
        lowStockThreshold: formData.get("lowStockThreshold"),
        sortOrder: formData.get("sortOrder"),
        enabled: checked(formData, "enabled"),
        needsClientReview: checked(formData, "needsClientReview"),
      });
      await saveProductVariant({
        input,
        actorId,
        expectedVersion: input.variantId
          ? expectedVersion(formData)
          : undefined,
      });
    },
  });
}

export async function saveProductPriceTierAction(formData: FormData) {
  const id = idSchema.parse(formData.get("productId"));
  const path = `/admin/products/${id}/pricing`;
  await runAction({
    capability: "products.edit",
    path,
    successMessage: "Price tier saved.",
    revalidate: [`/admin/products/${id}`, "/products"],
    body: async (actorId) => {
      const input = productPriceTierInputSchema.parse({
        variantId: formData.get("variantId"),
        tierId: optionalId(formData, "tierId"),
        stableKey: formData.get("stableKey") || undefined,
        minimumQuantity: formData.get("minimumQuantity"),
        maximumQuantity: formData.get("maximumQuantity"),
        unitPriceCents: formData.get("unitPriceCents"),
        sortOrder: formData.get("sortOrder"),
        enabled: checked(formData, "enabled"),
        needsClientReview: checked(formData, "needsClientReview"),
      });
      await saveProductPriceTier({
        input,
        actorId,
        expectedVersion: input.tierId ? expectedVersion(formData) : undefined,
      });
    },
  });
}

export async function saveProductImageAction(formData: FormData) {
  const id = productId(formData);
  const path = `/admin/products/${id}/media`;
  await runAction({
    capability: "products.media.manage",
    path,
    successMessage: "Product image saved.",
    revalidate: [`/admin/products/${id}`, "/products"],
    body: async (actorId) => {
      const input = productImageInputSchema.parse({
        productId: formData.get("productId"),
        imageId: optionalId(formData, "imageId"),
        stableKey: formData.get("stableKey") || undefined,
        imageType: formData.get("imageType"),
        assetPath: formData.get("assetPath"),
        altText: formData.get("altText"),
        caption: formData.get("caption"),
        sortOrder: formData.get("sortOrder"),
        isPublic: checked(formData, "isPublic"),
        needsClientReview: checked(formData, "needsClientReview"),
      });
      await saveProductImage({
        input,
        actorId,
        expectedVersion: input.imageId ? expectedVersion(formData) : undefined,
      });
    },
  });
}

export async function publishProductAction(formData: FormData) {
  const id = productId(formData);
  const path = `/admin/products/${id}`;
  await runAction({
    capability: "products.publish",
    path,
    successMessage: "Product published.",
    revalidate: [path, "/products"],
    body: async (actorId) => {
      await publishProduct({
        productId: id,
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function discardProductDraftAction(formData: FormData) {
  const id = productId(formData);
  const path = `/admin/products/${id}/history`;
  await runAction({
    capability: "products.publish",
    path,
    successMessage: "Draft restored from live product revision.",
    revalidate: [`/admin/products/${id}`, "/products"],
    body: async (actorId) => {
      await discardProductDraft({
        productId: id,
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function restoreProductRevisionAction(formData: FormData) {
  const id = productId(formData);
  const path = `/admin/products/${id}/history`;
  await runAction({
    capability: "products.publish",
    path,
    successMessage: "Revision restored into the draft.",
    revalidate: [`/admin/products/${id}`, "/products"],
    body: async (actorId) => {
      await restoreProductRevision({
        productId: id,
        revisionId: idSchema.parse(formData.get("revisionId")),
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function adjustProductInventoryAction(formData: FormData) {
  const id = idSchema.parse(formData.get("productId"));
  const path = `/admin/products/${id}/inventory`;
  await runAction({
    capability: "products.inventory.adjust",
    path,
    successMessage: "Inventory adjustment appended.",
    revalidate: [`/admin/products/${id}`, "/products"],
    body: async (actorId) => {
      const input = productInventoryAdjustmentInputSchema.parse({
        variantId: formData.get("variantId"),
        entryType: formData.get("entryType"),
        quantity: formData.get("quantity"),
        reason: formData.get("reason"),
        internalNote: formData.get("internalNote"),
        referenceKey: formData.get("referenceKey"),
      });
      await adjustProductInventory({
        variantId: input.variantId,
        entryType: input.entryType,
        quantity: input.quantity,
        reason: input.reason,
        internalNote: input.internalNote,
        actorId,
        expectedVersion: expectedVersion(formData),
        referenceKey: input.referenceKey,
      });
    },
  });
}

export async function createProductReservationAction(formData: FormData) {
  const id = idSchema.parse(formData.get("productId"));
  const path = `/admin/products/${id}/reservations`;
  await runAction({
    capability: "products.reservations.manage",
    path,
    successMessage: "Internal reservation created.",
    revalidate: [`/admin/products/${id}`, "/products"],
    body: async (actorId) => {
      const input = productReservationInputSchema.parse({
        variantId: formData.get("variantId"),
        quantity: formData.get("quantity"),
        expiresAt: formData.get("expiresAt"),
        safeInternalPurpose: formData.get("safeInternalPurpose"),
        idempotencyKey: formData.get("idempotencyKey"),
        futureExternalRef: formData.get("futureExternalRef"),
      });
      await createProductInventoryReservation({
        variantId: input.variantId,
        quantity: input.quantity,
        expiresAt: input.expiresAt,
        safeInternalPurpose: input.safeInternalPurpose,
        actorId,
        idempotencyKey: input.idempotencyKey,
        futureExternalRef: input.futureExternalRef,
        expectedVariantVersion: expectedVersion(formData),
      });
    },
  });
}

export async function releaseProductReservationAction(formData: FormData) {
  const id = idSchema.parse(formData.get("productId"));
  const path = `/admin/products/${id}/reservations`;
  await runAction({
    capability: "products.reservations.manage",
    path,
    successMessage: "Reservation released.",
    revalidate: [`/admin/products/${id}`, "/products"],
    body: async (actorId) => {
      await releaseProductInventoryReservation({
        reservationId: idSchema.parse(formData.get("reservationId")),
        actorId,
        expectedVersion: expectedVersion(formData),
      });
    },
  });
}

export async function expireProductReservationsAction(formData: FormData) {
  const id = idSchema.parse(formData.get("productId"));
  const path = `/admin/products/${id}/reservations`;
  await runAction({
    capability: "products.reservations.manage",
    path,
    successMessage: "Expired reservations resolved.",
    revalidate: [`/admin/products/${id}`, "/products"],
    body: async (actorId) => {
      await expireProductInventoryReservations({ actorId });
    },
  });
}
