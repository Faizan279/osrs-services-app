import { z } from "zod";

import {
  catalogueAvailabilityStates,
  catalogueEngineTypes,
  catalogueGameModes,
  catalogueRequirementTypes,
  requirementVerificationModes,
} from "@/lib/catalogue/constants";

export function normalizeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 180);
}

export function isSafeMediaReference(value: string) {
  if (value.startsWith("/") && !value.startsWith("//")) return true;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

const optionalTrimmedString = (maximum: number) =>
  z
    .string()
    .trim()
    .max(maximum)
    .optional()
    .transform((value) => value || undefined);

const optionalDate = z
  .string()
  .trim()
  .optional()
  .transform((value, context) => {
    if (!value) return undefined;
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) {
      context.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  });

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(140),
  slug: z
    .string()
    .trim()
    .min(1)
    .transform(normalizeSlug)
    .pipe(z.string().min(2)),
  shortDescription: z.string().trim().min(10).max(500),
  description: optionalTrimmedString(10_000),
  iconKey: optionalTrimmedString(80),
  imagePath: optionalTrimmedString(500).refine(
    (value) => !value || isSafeMediaReference(value),
    "Use an internal path or an approved HTTP(S) URL.",
  ),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  isActive: z.boolean(),
  seoTitle: optionalTrimmedString(191),
  seoDescription: optionalTrimmedString(500),
});

export const serviceInputSchema = z
  .object({
    categoryId: z.string().trim().min(1).max(30),
    name: z.string().trim().min(2).max(160),
    slug: z
      .string()
      .trim()
      .min(1)
      .transform(normalizeSlug)
      .pipe(z.string().min(2)),
    canonicalSlug: z
      .string()
      .trim()
      .min(1)
      .transform(normalizeSlug)
      .pipe(z.string().min(2)),
    shortSummary: z.string().trim().min(20).max(500),
    content: z.string().trim().min(40).max(50_000),
    serviceType: z.enum(["SERVICE", "PRODUCT", "MARKETPLACE"]),
    engineType: z.enum(catalogueEngineTypes),
    availabilityState: z.enum(catalogueAvailabilityStates),
    isFeatured: z.boolean(),
    isQuoteOnly: z.boolean(),
    displayOrder: z.coerce.number().int().min(0).max(100_000),
    gameModes: z.array(z.enum(catalogueGameModes)).min(1),
    internalNotes: optionalTrimmedString(20_000),
    publicPreparationNotes: optionalTrimmedString(20_000),
    primaryMediaPath: optionalTrimmedString(500).refine(
      (value) => !value || isSafeMediaReference(value),
      "Use an internal path or an approved HTTP(S) URL.",
    ),
    seoTitle: optionalTrimmedString(191),
    seoDescription: optionalTrimmedString(500),
    publishAt: optionalDate,
    unpublishAt: optionalDate,
    needsClientReview: z.boolean(),
    version: z.coerce.number().int().positive(),
  })
  .superRefine((value, context) => {
    if (
      value.publishAt &&
      value.unpublishAt &&
      value.publishAt >= value.unpublishAt
    ) {
      context.addIssue({
        code: "custom",
        path: ["unpublishAt"],
        message: "Unpublish time must be after publish time.",
      });
    }
  });

export const requirementInputSchema = z.object({
  serviceId: z.string().trim().min(1).max(30),
  title: z.string().trim().min(2).max(191),
  description: z.string().trim().min(10).max(10_000),
  type: z.enum(catalogueRequirementTypes),
  isRequired: z.boolean(),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  verificationMode: z.enum(requirementVerificationModes),
});

export const mediaReferenceInputSchema = z.object({
  serviceId: z.string().trim().min(1).max(30),
  assetPath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine(
      isSafeMediaReference,
      "Use an internal path or an approved HTTP(S) URL.",
    ),
  altText: z.string().trim().min(3).max(300),
  caption: optionalTrimmedString(500),
  displayOrder: z.coerce.number().int().min(0).max(100_000),
  isPrimary: z.boolean(),
});

export function nextDuplicateSlug(
  baseSlug: string,
  existingSlugs: readonly string[],
) {
  const base = `${normalizeSlug(baseSlug)}-copy`;
  const used = new Set(existingSlugs);
  if (!used.has(base)) return base;

  let index = 2;
  while (used.has(`${base}-${index}`)) index += 1;
  return `${base}-${index}`;
}
