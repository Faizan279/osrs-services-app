"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import { catalogueActionErrorMessage } from "@/lib/catalogue/action-errors";
import {
  addMediaReference,
  addRequirement,
  archiveService,
  createCategory,
  createService,
  deleteMediaReference,
  deleteRequirement,
  discardServiceStage,
  duplicateService,
  publishService,
  updateCategory,
  updateService,
} from "@/lib/catalogue/mutations";
import {
  categoryInputSchema,
  mediaReferenceInputSchema,
  requirementInputSchema,
  serviceInputSchema,
} from "@/lib/catalogue/validation";

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function values(formData: FormData, key: string) {
  return formData.getAll(key).map(String);
}

const catalogueIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(30)
  .regex(/^[a-z0-9]+$/i, "Invalid catalogue identifier.");

const catalogueVersionSchema = z.coerce.number().int().min(1);

function idValue(formData: FormData, key = "id") {
  return catalogueIdSchema.parse(formData.get(key));
}

function expectedVersionValue(formData: FormData) {
  return catalogueVersionSchema.parse(formData.get("expectedVersion"));
}

function categoryInput(formData: FormData) {
  return categoryInputSchema.parse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    shortDescription: formData.get("shortDescription"),
    description: formData.get("description"),
    iconKey: formData.get("iconKey"),
    imagePath: formData.get("imagePath"),
    displayOrder: formData.get("displayOrder"),
    isActive: checked(formData, "isActive"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
  });
}

function serviceInput(formData: FormData) {
  return serviceInputSchema.parse({
    categoryId: formData.get("categoryId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    canonicalSlug: formData.get("canonicalSlug"),
    shortSummary: formData.get("shortSummary"),
    content: formData.get("content"),
    serviceType: formData.get("serviceType"),
    engineType: formData.get("engineType"),
    availabilityState: formData.get("availabilityState"),
    isFeatured: checked(formData, "isFeatured"),
    isQuoteOnly: checked(formData, "isQuoteOnly"),
    displayOrder: formData.get("displayOrder"),
    gameModes: values(formData, "gameModes"),
    internalNotes: formData.get("internalNotes"),
    publicPreparationNotes: formData.get("publicPreparationNotes"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    publishAt: formData.get("publishAt"),
    unpublishAt: formData.get("unpublishAt"),
    needsClientReview: checked(formData, "needsClientReview"),
    version: formData.get("expectedVersion"),
  });
}

function destination(path: string, state: "saved" | "error", message?: string) {
  const query = new URLSearchParams({ state });
  if (message) query.set("message", message.slice(0, 300));
  return `${path}?${query}`;
}

function revalidateServiceRoute(route: {
  categorySlug: string;
  serviceSlug: string;
}) {
  revalidatePath(`/services/${route.categorySlug}`);
  revalidatePath(`/services/${route.categorySlug}/${route.serviceSlug}`);
}

export async function saveCategoryAction(formData: FormData) {
  const session = await requireCapability(
    "products.edit",
    "/admin/catalogue/categories",
  );
  const rawId = String(formData.get("id") ?? "");
  const id = rawId ? catalogueIdSchema.parse(rawId) : "";
  let categoryId: string;
  try {
    const category = id
      ? await updateCategory(id, categoryInput(formData), session.user.id)
      : await createCategory(categoryInput(formData), session.user.id);
    categoryId = category.id;
  } catch (error) {
    redirect(
      destination(
        id
          ? `/admin/catalogue/categories/${id}`
          : "/admin/catalogue/categories/new",
        "error",
        catalogueActionErrorMessage(error, "save-category"),
      ),
    );
  }
  revalidatePath("/admin/catalogue");
  revalidatePath("/services");
  redirect(destination(`/admin/catalogue/categories/${categoryId}`, "saved"));
}

export async function saveServiceAction(formData: FormData) {
  const session = await requireCapability(
    "products.edit",
    "/admin/catalogue/services",
  );
  const rawId = String(formData.get("id") ?? "");
  const id = rawId ? catalogueIdSchema.parse(rawId) : "";
  let serviceResult: { id: string; staged: boolean };
  try {
    const service = id
      ? await updateService(id, serviceInput(formData), session.user.id)
      : {
          ...(await createService(serviceInput(formData), session.user.id)),
          staged: false,
        };
    serviceResult = { id: service.id, staged: service.staged };
  } catch (error) {
    redirect(
      destination(
        id
          ? `/admin/catalogue/services/${id}`
          : "/admin/catalogue/services/new",
        "error",
        catalogueActionErrorMessage(error, "save-service"),
      ),
    );
  }
  revalidatePath("/admin/catalogue");
  redirect(
    destination(
      `/admin/catalogue/services/${serviceResult.id}`,
      "saved",
      serviceResult.staged
        ? "Unpublished changes saved for review."
        : "Private draft saved.",
    ),
  );
}

export async function publishServiceAction(formData: FormData) {
  const id = idValue(formData);
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${id}`,
  );
  let result: Awaited<ReturnType<typeof publishService>>;
  try {
    result = await publishService(
      id,
      session.user.id,
      expectedVersionValue(formData),
    );
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${id}`,
        "error",
        catalogueActionErrorMessage(error, "publish-service"),
      ),
    );
  }
  revalidatePath("/services");
  revalidateServiceRoute(result.previousRoute);
  revalidateServiceRoute(result.currentRoute);
  redirect(
    destination(
      `/admin/catalogue/services/${id}`,
      "saved",
      result.event === "PUBLISHED"
        ? "Service published."
        : "Service republished.",
    ),
  );
}

export async function archiveServiceAction(formData: FormData) {
  const id = idValue(formData);
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${id}`,
  );
  let result: Awaited<ReturnType<typeof archiveService>>;
  try {
    result = await archiveService(
      id,
      session.user.id,
      expectedVersionValue(formData),
    );
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${id}`,
        "error",
        catalogueActionErrorMessage(error, "archive-service"),
      ),
    );
  }
  revalidatePath("/services");
  revalidateServiceRoute(result.previousRoute);
  redirect(
    destination(
      `/admin/catalogue/services/${id}`,
      "saved",
      "Service archived.",
    ),
  );
}

export async function duplicateServiceAction(formData: FormData) {
  const id = idValue(formData);
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${id}`,
  );
  let duplicate: Awaited<ReturnType<typeof duplicateService>>;
  try {
    duplicate = await duplicateService(id, session.user.id);
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${id}`,
        "error",
        catalogueActionErrorMessage(error, "duplicate-service"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${duplicate.id}`,
      "saved",
      "Draft copy created.",
    ),
  );
}

export async function addRequirementAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}`,
  );
  let staged: boolean;
  try {
    const input = requirementInputSchema.parse({
      serviceId,
      title: formData.get("title"),
      description: formData.get("description"),
      type: formData.get("type"),
      isRequired: checked(formData, "isRequired"),
      displayOrder: formData.get("displayOrder"),
      verificationMode: formData.get("verificationMode"),
    });
    const result = await addRequirement(
      input,
      session.user.id,
      expectedVersionValue(formData),
    );
    staged = result.staged;
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}`,
        "error",
        catalogueActionErrorMessage(error, "add-requirement"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}`,
      "saved",
      staged
        ? "Requirement change staged."
        : "Requirement added to the private draft.",
    ),
  );
}

export async function deleteRequirementAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}`,
  );
  let result: Awaited<ReturnType<typeof deleteRequirement>>;
  try {
    result = await deleteRequirement(
      serviceId,
      idValue(formData, "requirementId"),
      session.user.id,
      expectedVersionValue(formData),
    );
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}`,
        "error",
        catalogueActionErrorMessage(error, "delete-requirement"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}`,
      "saved",
      result.staged
        ? "Requirement removal staged."
        : "Requirement removed from the private draft.",
    ),
  );
}

export async function addMediaAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}`,
  );
  let staged: boolean;
  try {
    const input = mediaReferenceInputSchema.parse({
      categoryId: formData.get("categoryId"),
      serviceId,
      assetPath: formData.get("assetPath"),
      altText: formData.get("altText"),
      caption: formData.get("caption"),
      displayOrder: formData.get("displayOrder"),
      isPrimary: checked(formData, "isPrimary"),
    });
    const result = await addMediaReference(
      input,
      session.user.id,
      expectedVersionValue(formData),
    );
    staged = result.staged;
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}`,
        "error",
        catalogueActionErrorMessage(error, "add-media"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}`,
      "saved",
      staged ? "Media change staged." : "Media added to the private draft.",
    ),
  );
}

export async function deleteMediaAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}`,
  );
  let result: Awaited<ReturnType<typeof deleteMediaReference>>;
  try {
    result = await deleteMediaReference(
      serviceId,
      idValue(formData, "mediaId"),
      session.user.id,
      expectedVersionValue(formData),
    );
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}`,
        "error",
        catalogueActionErrorMessage(error, "delete-media"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}`,
      "saved",
      result.staged
        ? "Media removal staged."
        : "Media removed from the private draft.",
    ),
  );
}

export async function discardServiceStageAction(formData: FormData) {
  const id = idValue(formData);
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${id}`,
  );
  try {
    await discardServiceStage(
      id,
      session.user.id,
      expectedVersionValue(formData),
    );
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${id}`,
        "error",
        catalogueActionErrorMessage(error, "discard-service-stage"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${id}`,
      "saved",
      "Pending changes discarded.",
    ),
  );
}
