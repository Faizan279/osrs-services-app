import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  createOwnedMediaReference,
  mediaOwnerWhere,
} from "@/lib/catalogue/media";
import { publicationIssues } from "@/lib/catalogue/rules";
import {
  categoryInputSchema,
  mediaReferenceInputSchema,
  nextDuplicateSlug,
  requirementInputSchema,
  serviceInputSchema,
} from "@/lib/catalogue/validation";
import { prisma } from "@/lib/db/prisma";

type CategoryInput = ReturnType<typeof categoryInputSchema.parse>;
type ServiceInput = ReturnType<typeof serviceInputSchema.parse>;
type RequirementInput = ReturnType<typeof requirementInputSchema.parse>;
type MediaInput = ReturnType<typeof mediaReferenceInputSchema.parse>;

export class CatalogueConflictError extends Error {}
export class CataloguePublicationError extends Error {
  constructor(public readonly issues: string[]) {
    super(issues.join(" "));
  }
}

function auditMetadata(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function revisionSnapshot(value: unknown) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function createCategory(input: CategoryInput, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const category = await transaction.catalogueCategory.create({
      data: input,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.category.created",
        targetType: "CatalogueCategory",
        targetId: category.id,
        metadata: auditMetadata({ slug: category.slug }),
      },
    });
    return category;
  });
}

export async function updateCategory(
  id: string,
  input: CategoryInput,
  actorId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.catalogueCategory.findUniqueOrThrow({
      where: { id },
    });
    const category = await transaction.catalogueCategory.update({
      where: { id },
      data: input,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.category.updated",
        targetType: "CatalogueCategory",
        targetId: id,
        metadata: auditMetadata({
          slug: category.slug,
          activeChanged: previous.isActive !== category.isActive,
          orderChanged: previous.displayOrder !== category.displayOrder,
          seoChanged:
            previous.seoTitle !== category.seoTitle ||
            previous.seoDescription !== category.seoDescription,
        }),
      },
    });
    return category;
  });
}

export async function createService(input: ServiceInput, actorId: string) {
  const { gameModes, version: _version, ...data } = input;
  void _version;
  return prisma.$transaction(async (transaction) => {
    await transaction.catalogueCategory.findUniqueOrThrow({
      where: { id: data.categoryId },
    });
    const service = await transaction.catalogueService.create({
      data: {
        ...data,
        publicationStatus: "DRAFT",
        createdById: actorId,
        updatedById: actorId,
        gameModes: {
          create: gameModes.map((gameMode) => ({ gameMode })),
        },
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.service.created",
        targetType: "CatalogueService",
        targetId: service.id,
        metadata: auditMetadata({
          categoryId: service.categoryId,
          slug: service.slug,
          engineType: service.engineType,
        }),
      },
    });
    return service;
  });
}

export async function updateService(
  id: string,
  input: ServiceInput,
  actorId: string,
) {
  const { gameModes, version, ...data } = input;
  return prisma.$transaction(async (transaction) => {
    const previous = await transaction.catalogueService.findUniqueOrThrow({
      where: { id },
    });
    const result = await transaction.catalogueService.updateMany({
      where: { id, version },
      data: {
        ...data,
        updatedById: actorId,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new CatalogueConflictError(
        "This service changed after the editor was opened. Reload before saving.",
      );
    }
    await transaction.catalogueServiceGameMode.deleteMany({
      where: { serviceId: id },
    });
    await transaction.catalogueServiceGameMode.createMany({
      data: gameModes.map((gameMode) => ({ serviceId: id, gameMode })),
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.service.updated",
        targetType: "CatalogueService",
        targetId: id,
        metadata: auditMetadata({
          status: previous.publicationStatus,
          availabilityChanged:
            previous.availabilityState !== data.availabilityState,
          seoChanged:
            previous.seoTitle !== data.seoTitle ||
            previous.seoDescription !== data.seoDescription,
          gameModesChanged: true,
        }),
      },
    });
    if (previous.availabilityState !== data.availabilityState) {
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.service.availability_changed",
          targetType: "CatalogueService",
          targetId: id,
          metadata: auditMetadata({
            from: previous.availabilityState,
            to: data.availabilityState,
          }),
        },
      });
    }
    if (
      previous.seoTitle !== data.seoTitle ||
      previous.seoDescription !== data.seoDescription
    ) {
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.service.seo_changed",
          targetType: "CatalogueService",
          targetId: id,
          metadata: auditMetadata({ hasTitle: Boolean(data.seoTitle) }),
        },
      });
    }
    return transaction.catalogueService.findUniqueOrThrow({ where: { id } });
  });
}

export async function publishService(id: string, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const service = await transaction.catalogueService.findUniqueOrThrow({
      where: { id },
      include: {
        category: true,
        gameModes: true,
        requirements: { orderBy: { displayOrder: "asc" } },
        mediaReferences: { orderBy: { displayOrder: "asc" } },
      },
    });
    const issues = publicationIssues(service);
    if (issues.length) throw new CataloguePublicationError(issues);

    const event =
      service.publicationStatus === "PUBLISHED" ? "REPUBLISHED" : "PUBLISHED";
    const aggregate = await transaction.catalogueRevision.aggregate({
      where: { serviceId: id },
      _max: { revisionNumber: true },
    });
    const published = await transaction.catalogueService.update({
      where: { id },
      data: {
        publicationStatus: "PUBLISHED",
        updatedById: actorId,
        version: { increment: 1 },
      },
      include: {
        category: true,
        gameModes: true,
        requirements: { orderBy: { displayOrder: "asc" } },
        mediaReferences: { orderBy: { displayOrder: "asc" } },
      },
    });
    await transaction.catalogueRevision.create({
      data: {
        serviceId: id,
        revisionNumber: (aggregate._max.revisionNumber ?? 0) + 1,
        event,
        publicationStatus: "PUBLISHED",
        summary:
          event === "PUBLISHED"
            ? "Service published for the first time."
            : "Published service content updated.",
        snapshot: revisionSnapshot(published),
        actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action:
          event === "PUBLISHED"
            ? "catalogue.service.published"
            : "catalogue.service.republished",
        targetType: "CatalogueService",
        targetId: id,
        metadata: auditMetadata({
          slug: published.slug,
          categoryId: published.categoryId,
        }),
      },
    });
    return published;
  });
}

export async function archiveService(id: string, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const service = await transaction.catalogueService.findUniqueOrThrow({
      where: { id },
      include: {
        category: true,
        gameModes: true,
        requirements: { orderBy: { displayOrder: "asc" } },
        mediaReferences: { orderBy: { displayOrder: "asc" } },
      },
    });
    const aggregate = await transaction.catalogueRevision.aggregate({
      where: { serviceId: id },
      _max: { revisionNumber: true },
    });
    const archived = await transaction.catalogueService.update({
      where: { id },
      data: {
        publicationStatus: "ARCHIVED",
        updatedById: actorId,
        version: { increment: 1 },
      },
      include: {
        category: true,
        gameModes: true,
        requirements: true,
        mediaReferences: true,
      },
    });
    await transaction.catalogueRevision.create({
      data: {
        serviceId: id,
        revisionNumber: (aggregate._max.revisionNumber ?? 0) + 1,
        event: "ARCHIVED",
        publicationStatus: "ARCHIVED",
        summary: "Service archived and removed from public discovery.",
        snapshot: revisionSnapshot(archived),
        actorId,
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.service.archived",
        targetType: "CatalogueService",
        targetId: id,
        metadata: auditMetadata({ previousStatus: service.publicationStatus }),
      },
    });
    return archived;
  });
}

export async function duplicateService(id: string, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const source = await transaction.catalogueService.findUniqueOrThrow({
      where: { id },
      include: { gameModes: true, requirements: true, mediaReferences: true },
    });
    const existing = await transaction.catalogueService.findMany({
      select: { slug: true, canonicalSlug: true },
    });
    const slug = nextDuplicateSlug(
      source.slug,
      existing.map((item) => item.slug),
    );
    const canonicalSlug = nextDuplicateSlug(
      source.canonicalSlug,
      existing.map((item) => item.canonicalSlug),
    );
    const duplicate = await transaction.catalogueService.create({
      data: {
        categoryId: source.categoryId,
        name: `${source.name} copy`,
        slug,
        canonicalSlug,
        shortSummary: source.shortSummary,
        content: source.content,
        serviceType: source.serviceType,
        engineType: source.engineType,
        publicationStatus: "DRAFT",
        availabilityState: source.availabilityState,
        isFeatured: false,
        isQuoteOnly: source.isQuoteOnly,
        displayOrder: source.displayOrder,
        internalNotes: source.internalNotes,
        publicPreparationNotes: source.publicPreparationNotes,
        primaryMediaPath: source.primaryMediaPath,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        createdById: actorId,
        updatedById: actorId,
        needsClientReview: true,
        gameModes: {
          create: source.gameModes.map(({ gameMode }) => ({ gameMode })),
        },
        requirements: {
          create: source.requirements.map((requirement) => ({
            title: requirement.title,
            description: requirement.description,
            type: requirement.type,
            isRequired: requirement.isRequired,
            displayOrder: requirement.displayOrder,
            verificationMode: requirement.verificationMode,
          })),
        },
        mediaReferences: {
          create: source.mediaReferences.map((media) => ({
            assetPath: media.assetPath,
            altText: media.altText,
            caption: media.caption,
            displayOrder: media.displayOrder,
            isPrimary: media.isPrimary,
          })),
        },
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.service.duplicated",
        targetType: "CatalogueService",
        targetId: duplicate.id,
        metadata: auditMetadata({ sourceId: id, slug }),
      },
    });
    return duplicate;
  });
}

export async function addRequirement(input: RequirementInput, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const requirement = await transaction.catalogueRequirement.create({
      data: input,
    });
    await transaction.catalogueService.update({
      where: { id: input.serviceId },
      data: { updatedById: actorId, version: { increment: 1 } },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.requirement.created",
        targetType: "CatalogueService",
        targetId: input.serviceId,
        metadata: auditMetadata({ requirementId: requirement.id }),
      },
    });
    return requirement;
  });
}

export async function deleteRequirement(
  serviceId: string,
  requirementId: string,
  actorId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const result = await transaction.catalogueRequirement.deleteMany({
      where: { id: requirementId, serviceId },
    });
    if (result.count !== 1)
      throw new CatalogueConflictError("Requirement not found.");
    await transaction.catalogueService.update({
      where: { id: serviceId },
      data: { updatedById: actorId, version: { increment: 1 } },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.requirement.deleted",
        targetType: "CatalogueService",
        targetId: serviceId,
        metadata: auditMetadata({ requirementId }),
      },
    });
  });
}

export async function addMediaReference(input: MediaInput, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const owner = mediaOwnerWhere(input);
    const media = await createOwnedMediaReference(input, {
      clearPrimary: async (where) => {
        await transaction.catalogueMediaReference.updateMany({
          where,
          data: { isPrimary: false },
        });
      },
      create: (data) => transaction.catalogueMediaReference.create({ data }),
    });
    if (input.serviceId) {
      await transaction.catalogueService.update({
        where: { id: input.serviceId },
        data: {
          ...(input.isPrimary ? { primaryMediaPath: input.assetPath } : {}),
          updatedById: actorId,
          version: { increment: 1 },
        },
      });
    } else if (input.categoryId && input.isPrimary) {
      await transaction.catalogueCategory.update({
        where: { id: input.categoryId },
        data: { imagePath: input.assetPath },
      });
    }
    const targetType = input.serviceId
      ? "CatalogueService"
      : "CatalogueCategory";
    const targetId = input.serviceId ?? input.categoryId!;
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.media.created",
        targetType,
        targetId,
        metadata: auditMetadata({
          mediaId: media.id,
          isPrimary: input.isPrimary,
          owner,
        }),
      },
    });
    return media;
  });
}

export async function deleteMediaReference(
  serviceId: string,
  mediaId: string,
  actorId: string,
) {
  return prisma.$transaction(async (transaction) => {
    const media = await transaction.catalogueMediaReference.findFirst({
      where: { id: mediaId, serviceId },
    });
    if (!media) throw new CatalogueConflictError("Media reference not found.");
    await transaction.catalogueMediaReference.delete({
      where: { id: mediaId },
    });
    await transaction.catalogueService.update({
      where: { id: serviceId },
      data: {
        ...(media.isPrimary ? { primaryMediaPath: null } : {}),
        updatedById: actorId,
        version: { increment: 1 },
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.media.deleted",
        targetType: "CatalogueService",
        targetId: serviceId,
        metadata: auditMetadata({ mediaId }),
      },
    });
  });
}
