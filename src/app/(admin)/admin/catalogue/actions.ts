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
  deleteOffering,
  deleteOfferingRequirement,
  discardServiceStage,
  duplicateService,
  duplicateOffering,
  publishService,
  updateCategory,
  updateService,
  saveOffering,
  addOfferingRequirement,
} from "@/lib/catalogue/mutations";
import {
  categoryInputSchema,
  mediaReferenceInputSchema,
  offeringFacetInputSchema,
  offeringInputSchema,
  offeringRequirementInputSchema,
  requirementInputSchema,
  serviceInputSchema,
} from "@/lib/catalogue/validation";
import {
  saveSkillingMethod,
  saveSkillingRule,
  saveSkillingSkill,
  skillingMethodInputSchema,
  skillingRuleInputSchema,
  skillingSkillInputSchema,
} from "@/lib/skilling/admin";
import {
  bossingBossInputSchema,
  bossingGearRequirementInputSchema,
  bossingMethodInputSchema,
  bossingRuleInputSchema,
  bossingStatRequirementInputSchema,
  saveBossingBoss,
  saveBossingMethod,
  saveBossingRule,
} from "@/lib/bossing/admin";
import {
  premiumFaqInputSchema,
  premiumOptionInputSchema,
  premiumPackageInputSchema,
  premiumRequirementGroupInputSchema,
  premiumRequirementInputSchema,
  premiumRuleInputSchema,
  savePremiumOption,
  savePremiumPackage,
  savePremiumRule,
} from "@/lib/premium/admin";

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

function offeringInput(formData: FormData, serviceId: string) {
  const facets = String(formData.get("facets") ?? "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row, index) => {
      const [facetKey, facetValue, label] = row
        .split("|")
        .map((value) => value?.trim());
      return offeringFacetInputSchema.parse({
        facetKey,
        facetValue,
        label,
        displayOrder: (index + 1) * 10,
      });
    });
  return offeringInputSchema.parse({
    serviceId,
    slug: formData.get("slug"),
    name: formData.get("name"),
    shortSummary: formData.get("shortSummary"),
    description: formData.get("description"),
    displayOrder: formData.get("displayOrder"),
    isActive: checked(formData, "isActive"),
    isFeatured: checked(formData, "isFeatured"),
    needsClientReview: checked(formData, "needsClientReview"),
    groupLabel: formData.get("groupLabel"),
    tierLabel: formData.get("tierLabel"),
    quantityEnabled: checked(formData, "quantityEnabled"),
    quantityUnit: formData.get("quantityUnit"),
    minimumQuantity: formData.get("minimumQuantity"),
    maximumQuantity: formData.get("maximumQuantity"),
    gameModes: values(formData, "gameModes"),
    facets,
  });
}

function eligibilityRuleFields(formData: FormData) {
  return {
    title: formData.get("title"),
    description: formData.get("description"),
    type: formData.get("type"),
    isRequired: checked(formData, "isRequired"),
    displayOrder: formData.get("displayOrder"),
    verificationMode: formData.get("verificationMode"),
    customerGuidance: formData.get("customerGuidance"),
    metricKey: formData.get("metricKey"),
    comparisonOperator: formData.get("comparisonOperator"),
    requiredValue: formData.get("requiredValue"),
    recommendedServiceId: formData.get("recommendedServiceId"),
  };
}

function skillingRuleInput(formData: FormData, serviceId: string) {
  return skillingRuleInputSchema.parse({
    serviceId,
    configuratorType: formData.get("configuratorType"),
    enabled: checked(formData, "enabled"),
    normalModeMultiplierBps: formData.get("normalModeMultiplierBps"),
    ironmanMultiplierBps: formData.get("ironmanMultiplierBps"),
    hardcoreIronmanMultiplierBps: formData.get("hardcoreIronmanMultiplierBps"),
    ultimateIronmanMultiplierBps: formData.get("ultimateIronmanMultiplierBps"),
    discordStreamEnabled: checked(formData, "discordStreamEnabled"),
    discordStreamPercentBps: formData.get("discordStreamPercentBps"),
    standardDeliveryEnabled: checked(formData, "standardDeliveryEnabled"),
    standardDeliveryLabel: formData.get("standardDeliveryLabel"),
    standardDeliveryDescription: formData.get("standardDeliveryDescription"),
    standardDeliveryEstimate: formData.get("standardDeliveryEstimate"),
    standardDeliveryMultiplierBps: formData.get(
      "standardDeliveryMultiplierBps",
    ),
    standardDeliveryFixedFeeCents: formData.get(
      "standardDeliveryFixedFeeCents",
    ),
    priorityDeliveryEnabled: checked(formData, "priorityDeliveryEnabled"),
    priorityDeliveryLabel: formData.get("priorityDeliveryLabel"),
    priorityDeliveryDescription: formData.get("priorityDeliveryDescription"),
    priorityDeliveryEstimate: formData.get("priorityDeliveryEstimate"),
    priorityDeliveryMultiplierBps: formData.get(
      "priorityDeliveryMultiplierBps",
    ),
    priorityDeliveryFixedFeeCents: formData.get(
      "priorityDeliveryFixedFeeCents",
    ),
    expressDeliveryEnabled: checked(formData, "expressDeliveryEnabled"),
    expressDeliveryLabel: formData.get("expressDeliveryLabel"),
    expressDeliveryDescription: formData.get("expressDeliveryDescription"),
    expressDeliveryEstimate: formData.get("expressDeliveryEstimate"),
    expressDeliveryMultiplierBps: formData.get("expressDeliveryMultiplierBps"),
    expressDeliveryFixedFeeCents: formData.get("expressDeliveryFixedFeeCents"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function skillingSkillInput(formData: FormData, serviceId: string) {
  return skillingSkillInputSchema.parse({
    serviceId,
    skillId: formData.get("skillId"),
    name: formData.get("name"),
    enabled: checked(formData, "enabled"),
    displayOrder: formData.get("displayOrder"),
    iconKey: formData.get("iconKey"),
  });
}

function skillingMethodInput(formData: FormData, serviceId: string) {
  return skillingMethodInputSchema.parse({
    serviceId,
    skillConfigId: formData.get("skillConfigId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    shortDescription: formData.get("shortDescription"),
    enabled: checked(formData, "enabled"),
    displayOrder: formData.get("displayOrder"),
    minimumLevel: formData.get("minimumLevel"),
    maximumLevel: formData.get("maximumLevel"),
    xpPerHour: formData.get("xpPerHour"),
    basePriceCentsPerMillionXp: formData.get("basePriceCentsPerMillionXp"),
    minimumPriceCents: formData.get("minimumPriceCents"),
    fixedFeeCents: formData.get("fixedFeeCents"),
    suppliesEnabled: checked(formData, "suppliesEnabled"),
    suppliesLabel: formData.get("suppliesLabel"),
    suppliesFeeCents: formData.get("suppliesFeeCents"),
    notes: formData.get("notes"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function bossingRuleInput(formData: FormData, serviceId: string) {
  return bossingRuleInputSchema.parse({
    serviceId,
    normalModeMultiplierBps: formData.get("normalModeMultiplierBps"),
    ironmanMultiplierBps: formData.get("ironmanMultiplierBps"),
    hardcoreIronmanMultiplierBps: formData.get("hardcoreIronmanMultiplierBps"),
    ultimateIronmanMultiplierBps: formData.get("ultimateIronmanMultiplierBps"),
    discordStreamEnabled: checked(formData, "discordStreamEnabled"),
    discordStreamPercentBps: formData.get("discordStreamPercentBps"),
    standardDeliveryEnabled: checked(formData, "standardDeliveryEnabled"),
    standardDeliveryLabel: formData.get("standardDeliveryLabel"),
    standardDeliveryDescription: formData.get("standardDeliveryDescription"),
    standardDeliveryEstimate: formData.get("standardDeliveryEstimate"),
    standardDeliveryMultiplierBps: formData.get(
      "standardDeliveryMultiplierBps",
    ),
    standardDeliveryFixedFeeCents: formData.get(
      "standardDeliveryFixedFeeCents",
    ),
    priorityDeliveryEnabled: checked(formData, "priorityDeliveryEnabled"),
    priorityDeliveryLabel: formData.get("priorityDeliveryLabel"),
    priorityDeliveryDescription: formData.get("priorityDeliveryDescription"),
    priorityDeliveryEstimate: formData.get("priorityDeliveryEstimate"),
    priorityDeliveryMultiplierBps: formData.get(
      "priorityDeliveryMultiplierBps",
    ),
    priorityDeliveryFixedFeeCents: formData.get(
      "priorityDeliveryFixedFeeCents",
    ),
    expressDeliveryEnabled: checked(formData, "expressDeliveryEnabled"),
    expressDeliveryLabel: formData.get("expressDeliveryLabel"),
    expressDeliveryDescription: formData.get("expressDeliveryDescription"),
    expressDeliveryEstimate: formData.get("expressDeliveryEstimate"),
    expressDeliveryMultiplierBps: formData.get("expressDeliveryMultiplierBps"),
    expressDeliveryFixedFeeCents: formData.get("expressDeliveryFixedFeeCents"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function bossingBossInput(formData: FormData, serviceId: string) {
  return bossingBossInputSchema.parse({
    serviceId,
    bossKey: formData.get("bossKey"),
    name: formData.get("name"),
    enabled: checked(formData, "enabled"),
    displayOrder: formData.get("displayOrder"),
    groupLabel: formData.get("groupLabel"),
    iconKey: formData.get("iconKey"),
    description: formData.get("description"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function bossingStatRequirements(formData: FormData) {
  return String(formData.get("statRequirements") ?? "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row, index) => {
      const [metricKey, label, requiredLevel, customerGuidance] = row
        .split("|")
        .map((value) => value?.trim());
      return bossingStatRequirementInputSchema.parse({
        metricKey,
        label,
        requiredLevel,
        displayOrder: (index + 1) * 10,
        verificationMode: "AUTOMATIC",
        customerGuidance,
        needsClientReview: true,
      });
    });
}

function bossingGearRequirements(formData: FormData) {
  return String(formData.get("gearRequirements") ?? "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row, index) => {
      const [label, description, verificationMode, customerGuidance] = row
        .split("|")
        .map((value) => value?.trim());
      return bossingGearRequirementInputSchema.parse({
        label,
        description,
        isRequired: true,
        displayOrder: (index + 1) * 10,
        verificationMode,
        customerGuidance,
        needsClientReview: true,
      });
    });
}

function bossingMethodInput(formData: FormData, serviceId: string) {
  return bossingMethodInputSchema.parse({
    serviceId,
    bossId: formData.get("bossId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    shortDescription: formData.get("shortDescription"),
    enabled: checked(formData, "enabled"),
    displayOrder: formData.get("displayOrder"),
    priceMode: formData.get("priceMode"),
    minimumKillCount: formData.get("minimumKillCount"),
    maximumKillCount: formData.get("maximumKillCount"),
    basePriceCentsPerKill: formData.get("basePriceCentsPerKill"),
    fixedPackagePriceCents: formData.get("fixedPackagePriceCents"),
    minimumPriceCents: formData.get("minimumPriceCents"),
    setupFeeCents: formData.get("setupFeeCents"),
    difficultyTierLabel: formData.get("difficultyTierLabel"),
    expectedRequirementsSummary: formData.get("expectedRequirementsSummary"),
    gearNotes: formData.get("gearNotes"),
    supplyNotes: formData.get("supplyNotes"),
    suppliesEnabled: checked(formData, "suppliesEnabled"),
    suppliesLabel: formData.get("suppliesLabel"),
    suppliesFeeCents: formData.get("suppliesFeeCents"),
    customerGearRequired: checked(formData, "customerGearRequired"),
    customerGearLabel: formData.get("customerGearLabel"),
    gearAdjustmentCents: formData.get("gearAdjustmentCents"),
    estimatedKillsPerHour: formData.get("estimatedKillsPerHour"),
    needsClientReview: checked(formData, "needsClientReview"),
    statRequirements: bossingStatRequirements(formData),
    gearRequirements: bossingGearRequirements(formData),
  });
}

function premiumRuleInput(formData: FormData, serviceId: string) {
  return premiumRuleInputSchema.parse({
    serviceId,
    normalModeMultiplierBps: formData.get("normalModeMultiplierBps"),
    ironmanMultiplierBps: formData.get("ironmanMultiplierBps"),
    hardcoreIronmanMultiplierBps: formData.get("hardcoreIronmanMultiplierBps"),
    ultimateIronmanMultiplierBps: formData.get("ultimateIronmanMultiplierBps"),
    discordStreamEnabled: checked(formData, "discordStreamEnabled"),
    discordStreamPercentBps: formData.get("discordStreamPercentBps"),
    rsnEligibilityEnabled: checked(formData, "rsnEligibilityEnabled"),
    supportsManualStatFallback: checked(formData, "supportsManualStatFallback"),
    standardDeliveryEnabled: checked(formData, "standardDeliveryEnabled"),
    standardDeliveryLabel: formData.get("standardDeliveryLabel"),
    standardDeliveryDescription: formData.get("standardDeliveryDescription"),
    standardDeliveryEstimate: formData.get("standardDeliveryEstimate"),
    standardDeliveryMultiplierBps: formData.get(
      "standardDeliveryMultiplierBps",
    ),
    standardDeliveryFixedFeeCents: formData.get(
      "standardDeliveryFixedFeeCents",
    ),
    priorityDeliveryEnabled: checked(formData, "priorityDeliveryEnabled"),
    priorityDeliveryLabel: formData.get("priorityDeliveryLabel"),
    priorityDeliveryDescription: formData.get("priorityDeliveryDescription"),
    priorityDeliveryEstimate: formData.get("priorityDeliveryEstimate"),
    priorityDeliveryMultiplierBps: formData.get(
      "priorityDeliveryMultiplierBps",
    ),
    priorityDeliveryFixedFeeCents: formData.get(
      "priorityDeliveryFixedFeeCents",
    ),
    expressDeliveryEnabled: checked(formData, "expressDeliveryEnabled"),
    expressDeliveryLabel: formData.get("expressDeliveryLabel"),
    expressDeliveryDescription: formData.get("expressDeliveryDescription"),
    expressDeliveryEstimate: formData.get("expressDeliveryEstimate"),
    expressDeliveryMultiplierBps: formData.get("expressDeliveryMultiplierBps"),
    expressDeliveryFixedFeeCents: formData.get("expressDeliveryFixedFeeCents"),
    needsClientReview: checked(formData, "needsClientReview"),
  });
}

function premiumRequirementGroups(formData: FormData) {
  const groups = new Map<
    string,
    {
      title: string;
      description: string;
      displayOrder: number;
      needsClientReview: boolean;
      requirements: unknown[];
    }
  >();
  String(formData.get("requirementGroups") ?? "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .forEach((row, index) => {
      const parts = row.split("|").map((value) => value?.trim());
      const [
        groupTitle,
        groupDescription,
        label,
        description,
        requirementType,
        verificationMode,
        metricKey,
        comparisonOperator,
        requiredValue,
        customerGuidance,
      ] =
        parts.length >= 10
          ? parts
          : [
              parts[0],
              parts[1],
              parts[2],
              parts[3],
              parts[4] === "AUTOMATIC" ? "SKILL" : "OTHER",
              parts[4],
              parts[5],
              parts[4] === "AUTOMATIC" ? "GREATER_THAN_OR_EQUAL" : "",
              parts[6],
              parts[7],
            ];
      const title = groupTitle || "Requirements";
      const group = groups.get(title) ?? {
        title,
        description: groupDescription || "",
        displayOrder: (groups.size + 1) * 10,
        needsClientReview: true,
        requirements: [],
      };
      group.requirements.push(
        premiumRequirementInputSchema.parse({
          label,
          description,
          requirementType,
          isRequired: true,
          displayOrder: (index + 1) * 10,
          verificationMode,
          metricKey,
          comparisonOperator,
          requiredValue,
          customerGuidance,
          needsClientReview: true,
        }),
      );
      groups.set(title, group);
    });
  return [...groups.values()].map((group) =>
    premiumRequirementGroupInputSchema.parse(group),
  );
}

function premiumFaqs(formData: FormData) {
  return String(formData.get("faqs") ?? "")
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean)
    .map((row, index) => {
      const [question, answer] = row.split("|").map((value) => value?.trim());
      return premiumFaqInputSchema.parse({
        question,
        answer,
        enabled: true,
        displayOrder: (index + 1) * 10,
        needsClientReview: true,
      });
    });
}

function premiumPackageInput(formData: FormData, serviceId: string) {
  return premiumPackageInputSchema.parse({
    serviceId,
    slug: formData.get("slug"),
    name: formData.get("name"),
    shortDescription: formData.get("shortDescription"),
    enabled: checked(formData, "enabled"),
    displayOrder: formData.get("displayOrder"),
    basePriceCents: formData.get("basePriceCents"),
    minimumPriceCents: formData.get("minimumPriceCents"),
    setupFeeCents: formData.get("setupFeeCents"),
    estimatedHours: formData.get("estimatedHours"),
    difficultyTierLabel: formData.get("difficultyTierLabel"),
    requirementsSummary: formData.get("requirementsSummary"),
    gearNotes: formData.get("gearNotes"),
    unlockNotes: formData.get("unlockNotes"),
    customerGearRequired: checked(formData, "customerGearRequired"),
    customerGearLabel: formData.get("customerGearLabel"),
    gearUnconfirmedAdjustmentCents: formData.get(
      "gearUnconfirmedAdjustmentCents",
    ),
    needsClientReview: checked(formData, "needsClientReview"),
    requirementGroups: premiumRequirementGroups(formData),
    faqs: premiumFaqs(formData),
  });
}

function premiumOptionInput(formData: FormData, serviceId: string) {
  return premiumOptionInputSchema.parse({
    serviceId,
    packageId: formData.get("packageId"),
    slug: formData.get("slug"),
    name: formData.get("name"),
    description: formData.get("description"),
    enabled: checked(formData, "enabled"),
    displayOrder: formData.get("displayOrder"),
    optionType: formData.get("optionType"),
    pricingMode: formData.get("pricingMode"),
    fixedPriceCents: formData.get("fixedPriceCents"),
    percentBps: formData.get("percentBps"),
    perUnitPriceCents: formData.get("perUnitPriceCents"),
    minimumQuantity: formData.get("minimumQuantity"),
    maximumQuantity: formData.get("maximumQuantity"),
    defaultQuantity: formData.get("defaultQuantity"),
    customerInputRequired: checked(formData, "customerInputRequired"),
    needsClientReview: checked(formData, "needsClientReview"),
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
      ...eligibilityRuleFields(formData),
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

export async function saveOfferingAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const rawOfferingId = String(formData.get("offeringId") ?? "");
  const offeringId = rawOfferingId
    ? catalogueIdSchema.parse(rawOfferingId)
    : undefined;
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/offerings`,
  );
  let result: Awaited<ReturnType<typeof saveOffering>>;
  try {
    result = await saveOffering(
      offeringInput(formData, serviceId),
      session.user.id,
      expectedVersionValue(formData),
      offeringId,
    );
  } catch (error) {
    redirect(
      destination(
        offeringId
          ? `/admin/catalogue/services/${serviceId}/offerings/${offeringId}`
          : `/admin/catalogue/services/${serviceId}/offerings/new`,
        "error",
        catalogueActionErrorMessage(error, "save-offering"),
      ),
    );
  }
  revalidatePath(`/admin/catalogue/services/${serviceId}`);
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/offerings/${result.id}`,
      "saved",
      result.staged
        ? "Offering changes staged for republish."
        : "Offering saved to the private draft.",
    ),
  );
}

export async function deleteOfferingAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const offeringId = idValue(formData, "offeringId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/offerings`,
  );
  try {
    await deleteOffering(
      serviceId,
      offeringId,
      session.user.id,
      expectedVersionValue(formData),
    );
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}/offerings`,
        "error",
        catalogueActionErrorMessage(error, "delete-offering"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/offerings`,
      "saved",
      "Offering removal saved.",
    ),
  );
}

export async function duplicateOfferingAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const offeringId = idValue(formData, "offeringId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/offerings`,
  );
  let result: Awaited<ReturnType<typeof duplicateOffering>>;
  try {
    result = await duplicateOffering(
      serviceId,
      offeringId,
      session.user.id,
      expectedVersionValue(formData),
    );
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}/offerings`,
        "error",
        catalogueActionErrorMessage(error, "duplicate-offering"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/offerings/${result.id}`,
      "saved",
      "Offering copy created as inactive.",
    ),
  );
}

export async function addOfferingRequirementAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const offeringId = idValue(formData, "offeringId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/offerings/${offeringId}`,
  );
  try {
    const input = offeringRequirementInputSchema.parse({
      serviceId,
      offeringId,
      ...eligibilityRuleFields(formData),
    });
    await addOfferingRequirement(
      input,
      session.user.id,
      expectedVersionValue(formData),
    );
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}/offerings/${offeringId}`,
        "error",
        catalogueActionErrorMessage(error, "add-offering-requirement"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/offerings/${offeringId}`,
      "saved",
      "Eligibility rule saved.",
    ),
  );
}

export async function deleteOfferingRequirementAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const offeringId = idValue(formData, "offeringId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/offerings/${offeringId}`,
  );
  try {
    await deleteOfferingRequirement(
      serviceId,
      offeringId,
      idValue(formData, "requirementId"),
      session.user.id,
      expectedVersionValue(formData),
    );
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}/offerings/${offeringId}`,
        "error",
        catalogueActionErrorMessage(error, "delete-offering-requirement"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/offerings/${offeringId}`,
      "saved",
      "Eligibility rule removed.",
    ),
  );
}

export async function saveSkillingRuleAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/skilling`,
  );
  let staged: boolean;
  try {
    const result = await saveSkillingRule(
      skillingRuleInput(formData, serviceId),
      session.user.id,
      expectedVersionValue(formData),
    );
    staged = result.staged;
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}/skilling`,
        "error",
        catalogueActionErrorMessage(error, "save-skilling-rule"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/skilling`,
      "saved",
      staged ? "Skilling rules staged for republish." : "Skilling rules saved.",
    ),
  );
}

export async function saveSkillingSkillAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/skilling`,
  );
  let staged: boolean;
  try {
    const result = await saveSkillingSkill(
      skillingSkillInput(formData, serviceId),
      session.user.id,
      expectedVersionValue(formData),
    );
    staged = result.staged;
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}/skilling`,
        "error",
        catalogueActionErrorMessage(error, "save-skilling-skill"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/skilling`,
      "saved",
      staged ? "Skill change staged." : "Skill saved.",
    ),
  );
}

export async function saveSkillingMethodAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const rawMethodId = String(formData.get("methodId") ?? "");
  const methodId = rawMethodId
    ? catalogueIdSchema.parse(rawMethodId)
    : undefined;
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/skilling`,
  );
  let result: Awaited<ReturnType<typeof saveSkillingMethod>>;
  try {
    result = await saveSkillingMethod(
      skillingMethodInput(formData, serviceId),
      session.user.id,
      expectedVersionValue(formData),
      methodId,
    );
  } catch (error) {
    redirect(
      destination(
        methodId
          ? `/admin/catalogue/services/${serviceId}/skilling/methods/${methodId}`
          : `/admin/catalogue/services/${serviceId}/skilling/methods/new`,
        "error",
        catalogueActionErrorMessage(error, "save-skilling-method"),
      ),
    );
  }
  revalidatePath(`/admin/catalogue/services/${serviceId}`);
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/skilling/methods/${result.id}`,
      "saved",
      result.staged ? "Method changes staged for republish." : "Method saved.",
    ),
  );
}

export async function saveBossingRuleAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/bossing`,
  );
  let staged: boolean;
  try {
    const result = await saveBossingRule(
      bossingRuleInput(formData, serviceId),
      session.user.id,
      expectedVersionValue(formData),
    );
    staged = result.staged;
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}/bossing`,
        "error",
        catalogueActionErrorMessage(error, "save-bossing-rule"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/bossing`,
      "saved",
      staged ? "Bossing rules staged for republish." : "Bossing rules saved.",
    ),
  );
}

export async function saveBossingBossAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const rawBossId = String(formData.get("bossId") ?? "");
  const bossId = rawBossId ? catalogueIdSchema.parse(rawBossId) : undefined;
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/bossing`,
  );
  let result: Awaited<ReturnType<typeof saveBossingBoss>>;
  try {
    result = await saveBossingBoss(
      bossingBossInput(formData, serviceId),
      session.user.id,
      expectedVersionValue(formData),
      bossId,
    );
  } catch (error) {
    redirect(
      destination(
        bossId
          ? `/admin/catalogue/services/${serviceId}/bossing/bosses/${bossId}`
          : `/admin/catalogue/services/${serviceId}/bossing/bosses/new`,
        "error",
        catalogueActionErrorMessage(error, "save-bossing-boss"),
      ),
    );
  }
  revalidatePath(`/admin/catalogue/services/${serviceId}`);
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/bossing`,
      "saved",
      result.staged ? "Boss changes staged for republish." : "Boss saved.",
    ),
  );
}

export async function saveBossingMethodAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const rawMethodId = String(formData.get("methodId") ?? "");
  const methodId = rawMethodId
    ? catalogueIdSchema.parse(rawMethodId)
    : undefined;
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/bossing`,
  );
  let result: Awaited<ReturnType<typeof saveBossingMethod>>;
  try {
    result = await saveBossingMethod(
      bossingMethodInput(formData, serviceId),
      session.user.id,
      expectedVersionValue(formData),
      methodId,
    );
  } catch (error) {
    redirect(
      destination(
        methodId
          ? `/admin/catalogue/services/${serviceId}/bossing/methods/${methodId}`
          : `/admin/catalogue/services/${serviceId}/bossing/methods/new`,
        "error",
        catalogueActionErrorMessage(error, "save-bossing-method"),
      ),
    );
  }
  revalidatePath(`/admin/catalogue/services/${serviceId}`);
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/bossing/methods/${result.id}`,
      "saved",
      result.staged ? "Method changes staged for republish." : "Method saved.",
    ),
  );
}

export async function savePremiumRuleAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/premium`,
  );
  let staged: boolean;
  try {
    const result = await savePremiumRule(
      premiumRuleInput(formData, serviceId),
      session.user.id,
      expectedVersionValue(formData),
    );
    staged = result.staged;
  } catch (error) {
    redirect(
      destination(
        `/admin/catalogue/services/${serviceId}/premium`,
        "error",
        catalogueActionErrorMessage(error, "save-premium-rule"),
      ),
    );
  }
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/premium`,
      "saved",
      staged ? "Premium rules staged for republish." : "Premium rules saved.",
    ),
  );
}

export async function savePremiumPackageAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const rawPackageId = String(formData.get("packageId") ?? "");
  const packageId = rawPackageId
    ? catalogueIdSchema.parse(rawPackageId)
    : undefined;
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/premium`,
  );
  let result: Awaited<ReturnType<typeof savePremiumPackage>>;
  try {
    result = await savePremiumPackage(
      premiumPackageInput(formData, serviceId),
      session.user.id,
      expectedVersionValue(formData),
      packageId,
    );
  } catch (error) {
    redirect(
      destination(
        packageId
          ? `/admin/catalogue/services/${serviceId}/premium/packages/${packageId}`
          : `/admin/catalogue/services/${serviceId}/premium/packages/new`,
        "error",
        catalogueActionErrorMessage(error, "save-premium-package"),
      ),
    );
  }
  revalidatePath(`/admin/catalogue/services/${serviceId}`);
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/premium/packages/${result.id}`,
      "saved",
      result.staged
        ? "Premium package changes staged for republish."
        : "Premium package saved.",
    ),
  );
}

export async function savePremiumOptionAction(formData: FormData) {
  const serviceId = idValue(formData, "serviceId");
  const rawOptionId = String(formData.get("optionId") ?? "");
  const optionId = rawOptionId
    ? catalogueIdSchema.parse(rawOptionId)
    : undefined;
  const session = await requireCapability(
    "products.edit",
    `/admin/catalogue/services/${serviceId}/premium`,
  );
  let result: Awaited<ReturnType<typeof savePremiumOption>>;
  try {
    result = await savePremiumOption(
      premiumOptionInput(formData, serviceId),
      session.user.id,
      expectedVersionValue(formData),
      optionId,
    );
  } catch (error) {
    redirect(
      destination(
        optionId
          ? `/admin/catalogue/services/${serviceId}/premium/options/${optionId}`
          : `/admin/catalogue/services/${serviceId}/premium/options/new`,
        "error",
        catalogueActionErrorMessage(error, "save-premium-option"),
      ),
    );
  }
  revalidatePath(`/admin/catalogue/services/${serviceId}`);
  redirect(
    destination(
      `/admin/catalogue/services/${serviceId}/premium/options/${result.id}`,
      "saved",
      result.staged
        ? "Premium option changes staged for republish."
        : "Premium option saved.",
    ),
  );
}
