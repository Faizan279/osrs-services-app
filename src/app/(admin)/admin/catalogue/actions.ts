"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z, ZodError } from "zod";

import { requireCapability } from "@/lib/auth/guards";
import {
  addMediaReference,
  addRequirement,
  archiveService,
  createCategory,
  createService,
  deleteMediaReference,
  deleteRequirement,
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

function idValue(formData: FormData, key = "id") {
  return catalogueIdSchema.parse(formData.get(key));
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
    primaryMediaPath: formData.get("primaryMediaPath"),
    seoTitle: formData.get("seoTitle"),
    seoDescription: formData.get("seoDescription"),
    publishAt: formData.get("publishAt"),
    unpublishAt: formData.get("unpublishAt"),
    needsClientReview: checked(formData, "needsClientReview"),
    version: formData.get("version"),
  });
}

function errorMessage(error: unknown) {
  if (error instanceof ZodError)
    return error.issues[0]?.message ?? "Check the form.";
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  ) {
    return "That slug or canonical URL is already in use.";
  }
  if (error instanceof Error) return error.message;
  return "The catalogue action could not be completed.";
}

function destination(path: string, state: "saved" | "error", message?: string) {
  const query = new URLSearchParams({ state });
  if (message) query.set("message", message.slice(0, 300));
  return `${path}?${query}`;
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
        errorMessage(error),
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
  let serviceId: string;
  try {
    const service = id
      ? await updateService(id, serviceInput(formData), session.user.id)
      : await createService(serviceInput(formData), session.user.id);
    serviceId = service.id;
  } catch (error) {
    redirect(
      destination(
        id
          ? `/admin/catalogue/services/${id}`
          : "/admin/catalogue/services/new",
        "error",
        errorMessage(error),
      ),
    );
  }
  revalidatePath("/admin/catalogue");
  revalidatePath("/services");
  redirect(destination(`/admin/catalogue/services/${serviceId}`, "saved"));
}

export async function publishServiceAction(formData: FormData) {
  const id = idValue(formData);
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${id}`,
  );
  try {
    await publishService(id, session.user.id);
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${id}`,
        "error",
        errorMessage(error),
      ),
    );
  }
  revalidatePath("/services");
  redirect(
    destination(
      `/admin/catalogue/services/${id}`,
      "saved",
      "Service published.",
    ),
  );
}

export async function archiveServiceAction(formData: FormData) {
  const id = idValue(formData);
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${id}`,
  );
  await archiveService(id, session.user.id);
  revalidatePath("/services");
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
  const duplicate = await duplicateService(id, session.user.id);
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
    await addRequirement(input, session.user.id);
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}`,
        "error",
        errorMessage(error),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}`,
      "saved",
      "Requirement added.",
    ),
  );
}

export async function deleteRequirementAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}`,
  );
  await deleteRequirement(
    serviceId,
    idValue(formData, "requirementId"),
    session.user.id,
  );
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}`,
      "saved",
      "Requirement removed.",
    ),
  );
}

export async function addMediaAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}`,
  );
  try {
    const input = mediaReferenceInputSchema.parse({
      serviceId,
      assetPath: formData.get("assetPath"),
      altText: formData.get("altText"),
      caption: formData.get("caption"),
      displayOrder: formData.get("displayOrder"),
      isPrimary: checked(formData, "isPrimary"),
    });
    await addMediaReference(input, session.user.id);
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}`,
        "error",
        errorMessage(error),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}`,
      "saved",
      "Media reference added.",
    ),
  );
}

export async function deleteMediaAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}`,
  );
  await deleteMediaReference(
    serviceId,
    idValue(formData, "mediaId"),
    session.user.id,
  );
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}`,
      "saved",
      "Media reference removed.",
    ),
  );
}
