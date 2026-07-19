import "server-only";

import { randomUUID } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import {
  CatalogueConflictError,
  CataloguePublicationError,
  CatalogueTransitionError,
  pendingChangesConflictMessage,
} from "@/lib/catalogue/errors";
import {
  createOwnedMediaReference,
  mediaOwnerWhere,
} from "@/lib/catalogue/media";
import {
  prismaRequirementBigInt,
  safeRequirementNumber,
} from "@/lib/catalogue/numeric";
import { publicationIssues } from "@/lib/catalogue/rules";
import { wouldCreateRecommendationCycle } from "@/lib/catalogue/recommendations";
import {
  editableSnapshot,
  loadServiceAggregate,
  mutatePublishedStage,
  persistServiceStage,
} from "@/lib/catalogue/staging-repository";
import {
  addStagedMedia,
  addStagedRequirement,
  applyServiceEdit,
  assertArchiveTransition,
  primaryMedia,
  publicationEventFromHistory,
  removeStagedMedia,
  removeStagedRequirement,
  removeStagedOffering,
  snapshotFromService,
  stagedCatalogueAggregateSchema,
  upsertStagedOffering,
  type StagedCatalogueAggregate,
} from "@/lib/catalogue/staging";
import {
  categoryInputSchema,
  mediaReferenceInputSchema,
  nextDuplicateSlug,
  offeringInputSchema,
  offeringRequirementInputSchema,
  requirementInputSchema,
  serviceInputSchema,
} from "@/lib/catalogue/validation";
import { prisma } from "@/lib/db/prisma";

type CategoryInput = ReturnType<typeof categoryInputSchema.parse>;
type ServiceInput = ReturnType<typeof serviceInputSchema.parse>;
type RequirementInput = ReturnType<typeof requirementInputSchema.parse>;
type MediaInput = ReturnType<typeof mediaReferenceInputSchema.parse>;
type OfferingInput = ReturnType<typeof offeringInputSchema.parse>;
type OfferingRequirementInput = ReturnType<
  typeof offeringRequirementInputSchema.parse
>;

function auditMetadata(value: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export function revisionSnapshot(value: unknown) {
  return JSON.parse(
    JSON.stringify(value, (_key, nestedValue) =>
      typeof nestedValue === "bigint"
        ? safeRequirementNumber(nestedValue)
        : nestedValue,
    ),
  ) as Prisma.InputJsonValue;
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
    const previous = await loadServiceAggregate(transaction, id);
    if (previous.publicationStatus === "PUBLISHED") {
      const snapshot = applyServiceEdit(editableSnapshot(previous), {
        ...data,
        gameModes,
      });
      const stage = await persistServiceStage({
        transaction,
        service: previous,
        snapshot,
        actorId,
        expectedVersion: version,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.service.changes_staged",
          targetType: "CatalogueService",
          targetId: id,
          metadata: auditMetadata({
            stageVersion: stage.version,
            availabilityChanged:
              previous.availabilityState !== data.availabilityState,
            seoChanged:
              previous.seoTitle !== data.seoTitle ||
              previous.seoDescription !== data.seoDescription,
            gameModesChanged: true,
          }),
        },
      });
      return { id, staged: true };
    }

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
    return { id, staged: false };
  });
}

function serviceDataFromSnapshot(snapshot: StagedCatalogueAggregate) {
  const service = snapshot.service;
  return {
    categoryId: service.categoryId,
    name: service.name,
    slug: service.slug,
    canonicalSlug: service.canonicalSlug,
    shortSummary: service.shortSummary,
    content: service.content,
    serviceType: service.serviceType,
    engineType: service.engineType,
    availabilityState: service.availabilityState,
    isFeatured: service.isFeatured,
    isQuoteOnly: service.isQuoteOnly,
    displayOrder: service.displayOrder,
    internalNotes: service.internalNotes,
    publicPreparationNotes: service.publicPreparationNotes,
    primaryMediaPath: primaryMedia(snapshot)?.assetPath ?? null,
    seoTitle: service.seoTitle,
    seoDescription: service.seoDescription,
    publishAt: service.publishAt ? new Date(service.publishAt) : null,
    unpublishAt: service.unpublishAt ? new Date(service.unpublishAt) : null,
    needsClientReview: service.needsClientReview,
  };
}

export async function publishService(
  id: string,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(
    async (transaction) => {
      const service = await loadServiceAggregate(transaction, id);
      if (service.publicationStatus === "PUBLISHED" && !service.stage) {
        throw new CatalogueTransitionError(
          "There are no pending changes to republish.",
        );
      }
      if (service.stage && service.stage.baseVersion !== service.version) {
        throw new CatalogueConflictError(
          "The published version changed after these edits were staged. Discard or review the pending changes.",
        );
      }

      let claimedStageVersion: number | null = null;
      let claimedServiceVersion: number;
      if (service.stage) {
        const claim = await transaction.catalogueServiceStage.updateMany({
          where: {
            id: service.stage.id,
            serviceId: id,
            version: expectedVersion,
          },
          data: {
            updatedById: actorId,
            version: { increment: 1 },
          },
        });
        if (claim.count !== 1) {
          throw new CatalogueConflictError(pendingChangesConflictMessage);
        }
        claimedStageVersion = expectedVersion + 1;
        claimedServiceVersion = claimedStageVersion;
      } else {
        const claim = await transaction.catalogueService.updateMany({
          where: { id, version: expectedVersion },
          data: { updatedById: actorId, version: { increment: 1 } },
        });
        if (claim.count !== 1) {
          throw new CatalogueConflictError(
            "This service changed after the editor was opened. Reload before continuing.",
          );
        }
        claimedServiceVersion = expectedVersion + 1;
      }

      const snapshot = service.stage
        ? editableSnapshot(service)
        : snapshotFromService(service);
      const category = await transaction.catalogueCategory.findUniqueOrThrow({
        where: { id: snapshot.service.categoryId },
      });
      const candidate = {
        ...snapshot.service,
        publishAt: snapshot.service.publishAt
          ? new Date(snapshot.service.publishAt)
          : null,
        unpublishAt: snapshot.service.unpublishAt
          ? new Date(snapshot.service.unpublishAt)
          : null,
        category,
        gameModes: snapshot.gameModes,
      };
      const issues = publicationIssues(candidate);
      if (issues.length) throw new CataloguePublicationError(issues);

      await lockRecommendationGraph(transaction);
      await validatePublicationRecommendationGraph(transaction, id, snapshot);

      const revisions = await transaction.catalogueRevision.findMany({
        where: { serviceId: id },
        select: { event: true, revisionNumber: true },
        orderBy: { revisionNumber: "desc" },
      });
      const event = publicationEventFromHistory(
        revisions.map(({ event: revisionEvent }) => revisionEvent),
      );
      const previousRoute = {
        categorySlug: service.category.slug,
        serviceSlug: service.slug,
      };

      const serviceUpdate = await transaction.catalogueService.updateMany({
        where: {
          id,
          version: service.stage ? service.version : claimedServiceVersion,
        },
        data: {
          ...serviceDataFromSnapshot(snapshot),
          publicationStatus: "PUBLISHED",
          updatedById: actorId,
          ...(service.stage ? { version: claimedServiceVersion } : {}),
        },
      });
      if (serviceUpdate.count !== 1) {
        throw new CatalogueConflictError(
          service.stage
            ? pendingChangesConflictMessage
            : "This service changed after the editor was opened. Reload before continuing.",
        );
      }
      await transaction.catalogueServiceGameMode.deleteMany({
        where: { serviceId: id },
      });
      await transaction.catalogueServiceGameMode.createMany({
        data: snapshot.gameModes.map((gameMode) => ({
          serviceId: id,
          gameMode,
        })),
      });
      await transaction.catalogueRequirement.deleteMany({
        where: { serviceId: id },
      });
      if (snapshot.requirements.length) {
        await transaction.catalogueRequirement.createMany({
          data: snapshot.requirements.map((requirement) => ({
            ...requirement,
            serviceId: id,
            requiredValue: prismaRequirementBigInt(requirement.requiredValue),
          })),
        });
      }
      await transaction.catalogueOffering.deleteMany({
        where: { serviceId: id },
      });
      for (const offering of snapshot.offerings) {
        await transaction.catalogueOffering.create({
          data: {
            id: offering.id,
            serviceId: id,
            seededKey: offering.seededKey,
            slug: offering.slug,
            name: offering.name,
            shortSummary: offering.shortSummary,
            description: offering.description,
            displayOrder: offering.displayOrder,
            isActive: offering.isActive,
            isFeatured: offering.isFeatured,
            needsClientReview: offering.needsClientReview,
            groupLabel: offering.groupLabel,
            tierLabel: offering.tierLabel,
            quantityEnabled: offering.quantityEnabled,
            quantityUnit: offering.quantityEnabled
              ? offering.quantityUnit
              : null,
            minimumQuantity: offering.quantityEnabled
              ? offering.minimumQuantity
              : null,
            maximumQuantity: offering.quantityEnabled
              ? offering.maximumQuantity
              : null,
            gameModes: {
              create: offering.gameModes.map((gameMode) => ({ gameMode })),
            },
            facets: {
              create: offering.facets.map(({ id: facetId, ...facet }) => ({
                id: facetId,
                ...facet,
              })),
            },
            requirements: {
              create: offering.requirements.map(
                ({ id: requirementId, ...requirement }) => ({
                  id: requirementId,
                  ...requirement,
                  requiredValue: prismaRequirementBigInt(
                    requirement.requiredValue,
                  ),
                }),
              ),
            },
          },
        });
      }
      await transaction.skillingCalculatorRule.deleteMany({
        where: { serviceId: id },
      });
      await transaction.skillingSkillConfig.deleteMany({
        where: { serviceId: id },
      });
      if (snapshot.skilling?.rule) {
        await transaction.skillingCalculatorRule.create({
          data: {
            ...snapshot.skilling.rule,
            serviceId: id,
          },
        });
      }
      for (const skill of snapshot.skilling?.skills ?? []) {
        await transaction.skillingSkillConfig.create({
          data: {
            id: skill.id,
            serviceId: id,
            seededKey: skill.seededKey,
            skillKey: skill.skillKey,
            name: skill.name,
            enabled: skill.enabled,
            displayOrder: skill.displayOrder,
            iconKey: skill.iconKey,
            methods: {
              create: skill.methods.map((method) => ({
                id: method.id,
                serviceId: id,
                seededKey: method.seededKey,
                slug: method.slug,
                name: method.name,
                shortDescription: method.shortDescription,
                enabled: method.enabled,
                displayOrder: method.displayOrder,
                minimumLevel: method.minimumLevel,
                maximumLevel: method.maximumLevel,
                xpPerHour: method.xpPerHour,
                basePriceCentsPerMillionXp: method.basePriceCentsPerMillionXp,
                minimumPriceCents: method.minimumPriceCents,
                fixedFeeCents: method.fixedFeeCents,
                suppliesEnabled: method.suppliesEnabled,
                suppliesLabel: method.suppliesLabel,
                suppliesFeeCents: method.suppliesFeeCents,
                notes: method.notes,
                needsClientReview: method.needsClientReview,
              })),
            },
          },
        });
      }
      await transaction.bossingCalculatorRule.deleteMany({
        where: { serviceId: id },
      });
      await transaction.bossingBossConfig.deleteMany({
        where: { serviceId: id },
      });
      if (snapshot.bossing?.rule) {
        await transaction.bossingCalculatorRule.create({
          data: {
            ...snapshot.bossing.rule,
            serviceId: id,
          },
        });
      }
      for (const boss of snapshot.bossing?.bosses ?? []) {
        await transaction.bossingBossConfig.create({
          data: {
            id: boss.id,
            serviceId: id,
            seededKey: boss.seededKey,
            bossKey: boss.bossKey,
            name: boss.name,
            enabled: boss.enabled,
            displayOrder: boss.displayOrder,
            groupLabel: boss.groupLabel,
            iconKey: boss.iconKey,
            description: boss.description,
            needsClientReview: boss.needsClientReview,
            methods: {
              create: boss.methods.map((method) => ({
                id: method.id,
                serviceId: id,
                seededKey: method.seededKey,
                slug: method.slug,
                name: method.name,
                shortDescription: method.shortDescription,
                enabled: method.enabled,
                displayOrder: method.displayOrder,
                priceMode: method.priceMode,
                minimumKillCount: method.minimumKillCount,
                maximumKillCount: method.maximumKillCount,
                basePriceCentsPerKill: method.basePriceCentsPerKill,
                fixedPackagePriceCents: method.fixedPackagePriceCents,
                minimumPriceCents: method.minimumPriceCents,
                setupFeeCents: method.setupFeeCents,
                difficultyTierLabel: method.difficultyTierLabel,
                expectedRequirementsSummary: method.expectedRequirementsSummary,
                gearNotes: method.gearNotes,
                supplyNotes: method.supplyNotes,
                suppliesEnabled: method.suppliesEnabled,
                suppliesLabel: method.suppliesLabel,
                suppliesFeeCents: method.suppliesFeeCents,
                customerGearRequired: method.customerGearRequired,
                customerGearLabel: method.customerGearLabel,
                gearAdjustmentCents: method.gearAdjustmentCents,
                estimatedKillsPerHour: method.estimatedKillsPerHour,
                needsClientReview: method.needsClientReview,
                statRequirements: {
                  create: method.statRequirements.map(
                    ({ id: requirementId, ...requirement }) => ({
                      id: requirementId,
                      ...requirement,
                    }),
                  ),
                },
                gearRequirements: {
                  create: method.gearRequirements.map(
                    ({ id: requirementId, ...requirement }) => ({
                      id: requirementId,
                      ...requirement,
                    }),
                  ),
                },
              })),
            },
          },
        });
      }
      await transaction.premiumServiceConfig.deleteMany({
        where: { serviceId: id },
      });
      if (snapshot.premium) {
        const rule = snapshot.premium.rule ?? {
          id: stagedId(),
          normalModeMultiplierBps: 0,
          ironmanMultiplierBps: 1000,
          hardcoreIronmanMultiplierBps: 2000,
          ultimateIronmanMultiplierBps: 3000,
          discordStreamEnabled: true,
          discordStreamPercentBps: 200,
          rsnEligibilityEnabled: true,
          standardDeliveryEnabled: true,
          standardDeliveryLabel: "Standard",
          standardDeliveryDescription:
            "Standard review queue for premium work.",
          standardDeliveryEstimate: "Estimate confirmed before checkout",
          standardDeliveryMultiplierBps: 0,
          standardDeliveryFixedFeeCents: 0,
          priorityDeliveryEnabled: false,
          priorityDeliveryLabel: "Priority",
          priorityDeliveryDescription:
            "Faster queue when staff capacity allows.",
          priorityDeliveryEstimate: "Faster estimate, client review required",
          priorityDeliveryMultiplierBps: 1500,
          priorityDeliveryFixedFeeCents: 0,
          expressDeliveryEnabled: false,
          expressDeliveryLabel: "Express",
          expressDeliveryDescription:
            "Fastest configured queue for eligible premium work.",
          expressDeliveryEstimate: "Fastest estimate, client review required",
          expressDeliveryMultiplierBps: 3000,
          expressDeliveryFixedFeeCents: 0,
          needsClientReview: true,
        };
        const config = await transaction.premiumServiceConfig.create({
          data: {
            ...rule,
            serviceId: id,
          },
        });
        for (const premiumPackage of snapshot.premium.packages) {
          await transaction.premiumPackage.create({
            data: {
              id: premiumPackage.id,
              serviceId: id,
              configId: config.id,
              seededKey: premiumPackage.seededKey,
              slug: premiumPackage.slug,
              name: premiumPackage.name,
              shortDescription: premiumPackage.shortDescription,
              enabled: premiumPackage.enabled,
              displayOrder: premiumPackage.displayOrder,
              basePriceCents: premiumPackage.basePriceCents,
              minimumPriceCents: premiumPackage.minimumPriceCents,
              setupFeeCents: premiumPackage.setupFeeCents,
              estimatedHours: premiumPackage.estimatedHours,
              difficultyTierLabel: premiumPackage.difficultyTierLabel,
              requirementsSummary: premiumPackage.requirementsSummary,
              gearNotes: premiumPackage.gearNotes,
              unlockNotes: premiumPackage.unlockNotes,
              customerGearRequired: premiumPackage.customerGearRequired,
              customerGearLabel: premiumPackage.customerGearLabel,
              gearUnconfirmedAdjustmentCents:
                premiumPackage.gearUnconfirmedAdjustmentCents,
              needsClientReview: premiumPackage.needsClientReview,
              requirementGroups: {
                create: premiumPackage.requirementGroups.map((group) => ({
                  id: group.id,
                  serviceId: id,
                  configId: config.id,
                  seededKey: group.seededKey,
                  title: group.title,
                  description: group.description,
                  displayOrder: group.displayOrder,
                  needsClientReview: group.needsClientReview,
                  requirements: {
                    create: group.requirements.map((requirement) => ({
                      id: requirement.id,
                      seededKey: requirement.seededKey,
                      label: requirement.label,
                      description: requirement.description,
                      isRequired: requirement.isRequired,
                      displayOrder: requirement.displayOrder,
                      verificationMode: requirement.verificationMode,
                      metricKey: requirement.metricKey,
                      requiredValue: requirement.requiredValue,
                      customerGuidance: requirement.customerGuidance,
                      needsClientReview: requirement.needsClientReview,
                    })),
                  },
                })),
              },
              faqs: {
                create: premiumPackage.faqs.map((faq) => ({
                  id: faq.id,
                  serviceId: id,
                  configId: config.id,
                  seededKey: faq.seededKey,
                  question: faq.question,
                  answer: faq.answer,
                  enabled: faq.enabled,
                  displayOrder: faq.displayOrder,
                  needsClientReview: faq.needsClientReview,
                })),
              },
            },
          });
        }
        if (snapshot.premium.options.length) {
          await transaction.premiumOption.createMany({
            data: snapshot.premium.options.map((option) => ({
              id: option.id,
              serviceId: id,
              configId: config.id,
              packageId: option.packageId,
              seededKey: option.seededKey,
              slug: option.slug,
              name: option.name,
              description: option.description,
              enabled: option.enabled,
              displayOrder: option.displayOrder,
              optionType: option.optionType,
              pricingMode: option.pricingMode,
              fixedPriceCents: option.fixedPriceCents,
              percentBps: option.percentBps,
              perUnitPriceCents: option.perUnitPriceCents,
              minimumQuantity: option.minimumQuantity,
              maximumQuantity: option.maximumQuantity,
              defaultQuantity: option.defaultQuantity,
              customerInputRequired: option.customerInputRequired,
              needsClientReview: option.needsClientReview,
            })),
          });
        }
      }
      await transaction.catalogueMediaReference.deleteMany({
        where: { serviceId: id },
      });
      if (snapshot.mediaReferences.length) {
        await transaction.catalogueMediaReference.createMany({
          data: snapshot.mediaReferences.map((media) => ({
            ...media,
            serviceId: id,
          })),
        });
      }

      const published = await transaction.catalogueService.findUniqueOrThrow({
        where: { id },
        include: {
          category: true,
          gameModes: { orderBy: { gameMode: "asc" } },
          requirements: { orderBy: { displayOrder: "asc" } },
          mediaReferences: {
            orderBy: [{ isPrimary: "desc" }, { displayOrder: "asc" }],
          },
          offerings: {
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
            include: { gameModes: true, facets: true, requirements: true },
          },
          skillingRule: true,
          skillingSkills: {
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
            include: {
              methods: {
                orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
              },
            },
          },
          bossingRule: true,
          bossingBosses: {
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
            include: {
              methods: {
                orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
                include: {
                  statRequirements: {
                    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
                  },
                  gearRequirements: {
                    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
                  },
                },
              },
            },
          },
          premiumConfig: true,
          premiumPackages: {
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
            include: {
              requirementGroups: {
                orderBy: [{ displayOrder: "asc" }, { title: "asc" }],
                include: {
                  requirements: {
                    orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
                  },
                },
              },
              faqs: {
                orderBy: [{ displayOrder: "asc" }, { question: "asc" }],
              },
            },
          },
          premiumOptions: {
            orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
          },
        },
      });
      await transaction.catalogueRevision.create({
        data: {
          serviceId: id,
          revisionNumber: (revisions[0]?.revisionNumber ?? 0) + 1,
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
            staged: Boolean(service.stage),
          }),
        },
      });
      if (event === "REPUBLISHED" && snapshot.offerings.length > 0) {
        await transaction.auditLog.create({
          data: {
            actorId,
            action: "catalogue.offering.aggregate_republished",
            targetType: "CatalogueService",
            targetId: id,
            metadata: auditMetadata({
              offeringCount: snapshot.offerings.length,
            }),
          },
        });
      }
      if (service.stage && snapshot.skilling) {
        await transaction.auditLog.create({
          data: {
            actorId,
            action: "catalogue.skilling.aggregate_republished",
            targetType: "CatalogueService",
            targetId: id,
            metadata: auditMetadata({
              skillCount: snapshot.skilling.skills.length,
              methodCount: snapshot.skilling.skills.reduce(
                (count, skill) => count + skill.methods.length,
                0,
              ),
            }),
          },
        });
      }
      if (service.stage && snapshot.bossing) {
        await transaction.auditLog.create({
          data: {
            actorId,
            action: "catalogue.bossing.aggregate_republished",
            targetType: "CatalogueService",
            targetId: id,
            metadata: auditMetadata({
              bossCount: snapshot.bossing.bosses.length,
              methodCount: snapshot.bossing.bosses.reduce(
                (count, boss) => count + boss.methods.length,
                0,
              ),
            }),
          },
        });
      }
      if (service.stage && snapshot.premium) {
        await transaction.auditLog.create({
          data: {
            actorId,
            action: "catalogue.premium.aggregate_republished",
            targetType: "CatalogueService",
            targetId: id,
            metadata: auditMetadata({
              packageCount: snapshot.premium.packages.length,
              optionCount: snapshot.premium.options.length,
            }),
          },
        });
      }
      if (service.stage) {
        const deleted = await transaction.catalogueServiceStage.deleteMany({
          where: {
            id: service.stage.id,
            serviceId: id,
            version: claimedStageVersion!,
          },
        });
        if (deleted.count !== 1) {
          throw new CatalogueConflictError(pendingChangesConflictMessage);
        }
      }
      return {
        published,
        event,
        previousRoute,
        currentRoute: {
          categorySlug: published.category.slug,
          serviceSlug: published.slug,
        },
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function archiveService(
  id: string,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, id);
    assertArchiveTransition(service.publicationStatus, Boolean(service.stage));
    const aggregate = await transaction.catalogueRevision.aggregate({
      where: { serviceId: id },
      _max: { revisionNumber: true },
    });
    const claim = await transaction.catalogueService.updateMany({
      where: { id, version: expectedVersion, publicationStatus: "PUBLISHED" },
      data: {
        publicationStatus: "ARCHIVED",
        updatedById: actorId,
        version: { increment: 1 },
      },
    });
    if (claim.count !== 1) {
      throw new CatalogueConflictError(
        "This service changed after the editor was opened. Reload before continuing.",
      );
    }
    const archived = await transaction.catalogueService.findUniqueOrThrow({
      where: { id },
      include: {
        category: true,
        gameModes: true,
        requirements: true,
        mediaReferences: true,
        offerings: {
          include: { gameModes: true, facets: true, requirements: true },
        },
        skillingRule: true,
        skillingSkills: { include: { methods: true } },
        bossingRule: true,
        bossingBosses: {
          include: {
            methods: {
              include: { statRequirements: true, gearRequirements: true },
            },
          },
        },
        premiumConfig: true,
        premiumPackages: {
          include: {
            requirementGroups: { include: { requirements: true } },
            faqs: true,
          },
        },
        premiumOptions: true,
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
    return {
      archived,
      previousRoute: {
        categorySlug: service.category.slug,
        serviceSlug: service.slug,
      },
    };
  });
}

export async function discardServiceStage(
  id: string,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await transaction.catalogueService.findUniqueOrThrow({
      where: { id },
      include: { stage: true },
    });
    if (!service.stage) {
      throw new CatalogueTransitionError(
        "There are no pending changes to discard.",
      );
    }
    const snapshot = stagedCatalogueAggregateSchema.parse(
      service.stage.snapshot,
    );
    const deleted = await transaction.catalogueServiceStage.deleteMany({
      where: {
        id: service.stage.id,
        serviceId: id,
        version: expectedVersion,
      },
    });
    if (deleted.count !== 1) {
      throw new CatalogueConflictError(pendingChangesConflictMessage);
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.service.changes_discarded",
        targetType: "CatalogueService",
        targetId: id,
        metadata: auditMetadata({ stageVersion: expectedVersion }),
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.offering.changes_discarded",
        targetType: "CatalogueService",
        targetId: id,
        metadata: auditMetadata({ stageVersion: expectedVersion }),
      },
    });
    if (snapshot.skilling) {
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.skilling.changes_discarded",
          targetType: "CatalogueService",
          targetId: id,
          metadata: auditMetadata({ stageVersion: expectedVersion }),
        },
      });
    }
    if (snapshot.bossing) {
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.bossing.changes_discarded",
          targetType: "CatalogueService",
          targetId: id,
          metadata: auditMetadata({ stageVersion: expectedVersion }),
        },
      });
    }
    if (snapshot.premium) {
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.premium.changes_discarded",
          targetType: "CatalogueService",
          targetId: id,
          metadata: auditMetadata({ stageVersion: expectedVersion }),
        },
      });
    }
    return service;
  });
}

export async function duplicateService(id: string, actorId: string) {
  return prisma.$transaction(async (transaction) => {
    const source = await transaction.catalogueService.findUniqueOrThrow({
      where: { id },
      include: {
        gameModes: true,
        requirements: true,
        mediaReferences: true,
        offerings: {
          include: { gameModes: true, facets: true, requirements: true },
        },
        skillingRule: true,
        skillingSkills: { include: { methods: true } },
        bossingRule: true,
        bossingBosses: {
          include: {
            methods: {
              include: { statRequirements: true, gearRequirements: true },
            },
          },
        },
        premiumConfig: true,
        premiumPackages: {
          include: {
            requirementGroups: { include: { requirements: true } },
            faqs: true,
          },
        },
        premiumOptions: true,
      },
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
        primaryMediaPath:
          source.mediaReferences.find((media) => media.isPrimary)?.assetPath ??
          null,
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
            customerGuidance: requirement.customerGuidance,
            metricKey: requirement.metricKey,
            comparisonOperator: requirement.comparisonOperator,
            requiredValue: prismaRequirementBigInt(requirement.requiredValue),
            recommendedServiceId: requirement.recommendedServiceId,
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
        offerings: {
          create: source.offerings.map((offering) => ({
            slug: offering.slug,
            name: offering.name,
            shortSummary: offering.shortSummary,
            description: offering.description,
            displayOrder: offering.displayOrder,
            isActive: offering.isActive,
            isFeatured: false,
            needsClientReview: true,
            groupLabel: offering.groupLabel,
            tierLabel: offering.tierLabel,
            quantityEnabled: offering.quantityEnabled,
            quantityUnit: offering.quantityUnit,
            minimumQuantity: offering.minimumQuantity,
            maximumQuantity: offering.maximumQuantity,
            gameModes: {
              create: offering.gameModes.map(({ gameMode }) => ({ gameMode })),
            },
            facets: {
              create: offering.facets.map((facet) => ({
                facetKey: facet.facetKey,
                facetValue: facet.facetValue,
                label: facet.label,
                displayOrder: facet.displayOrder,
              })),
            },
            requirements: {
              create: offering.requirements.map((requirement) => ({
                title: requirement.title,
                description: requirement.description,
                type: requirement.type,
                isRequired: requirement.isRequired,
                displayOrder: requirement.displayOrder,
                verificationMode: requirement.verificationMode,
                customerGuidance: requirement.customerGuidance,
                metricKey: requirement.metricKey,
                comparisonOperator: requirement.comparisonOperator,
                requiredValue: prismaRequirementBigInt(
                  requirement.requiredValue,
                ),
                recommendedServiceId: requirement.recommendedServiceId,
              })),
            },
          })),
        },
      },
    });
    if (source.skillingRule) {
      const {
        id: _ruleId,
        serviceId: _serviceId,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...rule
      } = source.skillingRule;
      void _ruleId;
      void _serviceId;
      void _createdAt;
      void _updatedAt;
      await transaction.skillingCalculatorRule.create({
        data: {
          ...rule,
          serviceId: duplicate.id,
          needsClientReview: true,
        },
      });
    }
    for (const skill of source.skillingSkills) {
      const copiedSkill = await transaction.skillingSkillConfig.create({
        data: {
          serviceId: duplicate.id,
          skillKey: skill.skillKey,
          name: skill.name,
          enabled: skill.enabled,
          displayOrder: skill.displayOrder,
          iconKey: skill.iconKey,
          seededKey: null,
        },
      });
      await transaction.skillingTrainingMethod.createMany({
        data: skill.methods.map((method) => ({
          serviceId: duplicate.id,
          skillConfigId: copiedSkill.id,
          slug: method.slug,
          name: method.name,
          shortDescription: method.shortDescription,
          enabled: method.enabled,
          displayOrder: method.displayOrder,
          minimumLevel: method.minimumLevel,
          maximumLevel: method.maximumLevel,
          xpPerHour: method.xpPerHour,
          basePriceCentsPerMillionXp: method.basePriceCentsPerMillionXp,
          minimumPriceCents: method.minimumPriceCents,
          fixedFeeCents: method.fixedFeeCents,
          suppliesEnabled: method.suppliesEnabled,
          suppliesLabel: method.suppliesLabel,
          suppliesFeeCents: method.suppliesFeeCents,
          notes: method.notes,
          needsClientReview: true,
          seededKey: null,
        })),
      });
    }
    if (source.bossingRule) {
      const {
        id: _ruleId,
        serviceId: _serviceId,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...rule
      } = source.bossingRule;
      void _ruleId;
      void _serviceId;
      void _createdAt;
      void _updatedAt;
      await transaction.bossingCalculatorRule.create({
        data: {
          ...rule,
          serviceId: duplicate.id,
          needsClientReview: true,
        },
      });
    }
    for (const boss of source.bossingBosses) {
      const copiedBoss = await transaction.bossingBossConfig.create({
        data: {
          serviceId: duplicate.id,
          bossKey: boss.bossKey,
          name: boss.name,
          enabled: boss.enabled,
          displayOrder: boss.displayOrder,
          groupLabel: boss.groupLabel,
          iconKey: boss.iconKey,
          description: boss.description,
          needsClientReview: true,
          seededKey: null,
        },
      });
      for (const method of boss.methods) {
        await transaction.bossingMethod.create({
          data: {
            serviceId: duplicate.id,
            bossId: copiedBoss.id,
            slug: method.slug,
            name: method.name,
            shortDescription: method.shortDescription,
            enabled: method.enabled,
            displayOrder: method.displayOrder,
            priceMode: method.priceMode,
            minimumKillCount: method.minimumKillCount,
            maximumKillCount: method.maximumKillCount,
            basePriceCentsPerKill: method.basePriceCentsPerKill,
            fixedPackagePriceCents: method.fixedPackagePriceCents,
            minimumPriceCents: method.minimumPriceCents,
            setupFeeCents: method.setupFeeCents,
            difficultyTierLabel: method.difficultyTierLabel,
            expectedRequirementsSummary: method.expectedRequirementsSummary,
            gearNotes: method.gearNotes,
            supplyNotes: method.supplyNotes,
            suppliesEnabled: method.suppliesEnabled,
            suppliesLabel: method.suppliesLabel,
            suppliesFeeCents: method.suppliesFeeCents,
            customerGearRequired: method.customerGearRequired,
            customerGearLabel: method.customerGearLabel,
            gearAdjustmentCents: method.gearAdjustmentCents,
            estimatedKillsPerHour: method.estimatedKillsPerHour,
            needsClientReview: true,
            seededKey: null,
            statRequirements: {
              create: method.statRequirements.map((requirement) => ({
                metricKey: requirement.metricKey,
                label: requirement.label,
                requiredLevel: requirement.requiredLevel,
                displayOrder: requirement.displayOrder,
                verificationMode: requirement.verificationMode,
                customerGuidance: requirement.customerGuidance,
                needsClientReview: true,
                seededKey: null,
              })),
            },
            gearRequirements: {
              create: method.gearRequirements.map((requirement) => ({
                label: requirement.label,
                description: requirement.description,
                isRequired: requirement.isRequired,
                displayOrder: requirement.displayOrder,
                verificationMode: requirement.verificationMode,
                customerGuidance: requirement.customerGuidance,
                needsClientReview: true,
                seededKey: null,
              })),
            },
          },
        });
      }
    }
    if (source.premiumConfig) {
      const {
        id: _configId,
        serviceId: _serviceId,
        createdAt: _createdAt,
        updatedAt: _updatedAt,
        ...config
      } = source.premiumConfig;
      void _configId;
      void _serviceId;
      void _createdAt;
      void _updatedAt;
      const copiedConfig = await transaction.premiumServiceConfig.create({
        data: {
          ...config,
          serviceId: duplicate.id,
          needsClientReview: true,
        },
      });
      const packageIds = new Map<string, string>();
      for (const premiumPackage of source.premiumPackages) {
        const copiedPackage = await transaction.premiumPackage.create({
          data: {
            serviceId: duplicate.id,
            configId: copiedConfig.id,
            slug: premiumPackage.slug,
            name: premiumPackage.name,
            shortDescription: premiumPackage.shortDescription,
            enabled: premiumPackage.enabled,
            displayOrder: premiumPackage.displayOrder,
            basePriceCents: premiumPackage.basePriceCents,
            minimumPriceCents: premiumPackage.minimumPriceCents,
            setupFeeCents: premiumPackage.setupFeeCents,
            estimatedHours: premiumPackage.estimatedHours,
            difficultyTierLabel: premiumPackage.difficultyTierLabel,
            requirementsSummary: premiumPackage.requirementsSummary,
            gearNotes: premiumPackage.gearNotes,
            unlockNotes: premiumPackage.unlockNotes,
            customerGearRequired: premiumPackage.customerGearRequired,
            customerGearLabel: premiumPackage.customerGearLabel,
            gearUnconfirmedAdjustmentCents:
              premiumPackage.gearUnconfirmedAdjustmentCents,
            needsClientReview: true,
            seededKey: null,
          },
        });
        packageIds.set(premiumPackage.id, copiedPackage.id);
        for (const group of premiumPackage.requirementGroups) {
          await transaction.premiumRequirementGroup.create({
            data: {
              serviceId: duplicate.id,
              configId: copiedConfig.id,
              packageId: copiedPackage.id,
              title: group.title,
              description: group.description,
              displayOrder: group.displayOrder,
              needsClientReview: true,
              seededKey: null,
              requirements: {
                create: group.requirements.map((requirement) => ({
                  label: requirement.label,
                  description: requirement.description,
                  isRequired: requirement.isRequired,
                  displayOrder: requirement.displayOrder,
                  verificationMode: requirement.verificationMode,
                  metricKey: requirement.metricKey,
                  requiredValue: requirement.requiredValue,
                  customerGuidance: requirement.customerGuidance,
                  needsClientReview: true,
                  seededKey: null,
                })),
              },
            },
          });
        }
        if (premiumPackage.faqs.length) {
          await transaction.premiumFaq.createMany({
            data: premiumPackage.faqs.map((faq) => ({
              serviceId: duplicate.id,
              configId: copiedConfig.id,
              packageId: copiedPackage.id,
              question: faq.question,
              answer: faq.answer,
              enabled: faq.enabled,
              displayOrder: faq.displayOrder,
              needsClientReview: true,
              seededKey: null,
            })),
          });
        }
      }
      if (source.premiumOptions.length) {
        await transaction.premiumOption.createMany({
          data: source.premiumOptions.map((option) => ({
            serviceId: duplicate.id,
            configId: copiedConfig.id,
            packageId: option.packageId
              ? (packageIds.get(option.packageId) ?? null)
              : null,
            slug: option.slug,
            name: option.name,
            description: option.description,
            enabled: option.enabled,
            displayOrder: option.displayOrder,
            optionType: option.optionType,
            pricingMode: option.pricingMode,
            fixedPriceCents: option.fixedPriceCents,
            percentBps: option.percentBps,
            perUnitPriceCents: option.perUnitPriceCents,
            minimumQuantity: option.minimumQuantity,
            maximumQuantity: option.maximumQuantity,
            defaultQuantity: option.defaultQuantity,
            customerInputRequired: option.customerInputRequired,
            needsClientReview: true,
            seededKey: null,
          })),
        });
      }
    }
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

function stagedId() {
  return `stg${randomUUID().replaceAll("-", "").slice(0, 27)}`;
}

async function assertRecommendationIsAcyclic(
  transaction: Prisma.TransactionClient,
  ownerServiceId: string,
  recommendedServiceId: string | null | undefined,
  staged?: StagedCatalogueAggregate,
) {
  if (!recommendedServiceId) return;
  const [serviceRequirements, offeringRequirements] = await Promise.all([
    transaction.catalogueRequirement.findMany({
      where: { recommendedServiceId: { not: null } },
      select: { serviceId: true, recommendedServiceId: true },
    }),
    transaction.catalogueOfferingRequirement.findMany({
      where: { recommendedServiceId: { not: null } },
      select: {
        recommendedServiceId: true,
        offering: { select: { serviceId: true } },
      },
    }),
  ]);
  const edges = new Map<string, string[]>();
  const add = (from: string, to: string | null) => {
    if (to) edges.set(from, [...(edges.get(from) ?? []), to]);
  };
  serviceRequirements.forEach((item) =>
    add(item.serviceId, item.recommendedServiceId),
  );
  offeringRequirements.forEach((item) =>
    add(item.offering.serviceId, item.recommendedServiceId),
  );
  staged?.requirements.forEach((item) =>
    add(ownerServiceId, item.recommendedServiceId),
  );
  staged?.offerings.forEach((offering) =>
    offering.requirements.forEach((item) =>
      add(ownerServiceId, item.recommendedServiceId),
    ),
  );
  if (
    wouldCreateRecommendationCycle(edges, ownerServiceId, recommendedServiceId)
  ) {
    throw new CatalogueTransitionError(
      "This prerequisite recommendation would create a circular chain.",
    );
  }
}

async function lockRecommendationGraph(transaction: Prisma.TransactionClient) {
  await transaction.$queryRaw<Array<{ id: string }>>`
    SELECT \`id\`
    FROM \`CatalogueService\`
    ORDER BY \`id\`
    FOR UPDATE
  `;
}

function addRecommendationEdge(
  edges: Map<string, string[]>,
  from: string,
  to: string | null | undefined,
) {
  if (!to) return;
  edges.set(from, [...(edges.get(from) ?? []), to]);
}

function candidateRecommendationTargets(snapshot: StagedCatalogueAggregate) {
  return [
    ...snapshot.requirements.map(
      (requirement) => requirement.recommendedServiceId,
    ),
    ...snapshot.offerings.flatMap((offering) =>
      offering.requirements.map(
        (requirement) => requirement.recommendedServiceId,
      ),
    ),
  ].filter((value): value is string => Boolean(value));
}

async function validatePublicationRecommendationGraph(
  transaction: Prisma.TransactionClient,
  ownerServiceId: string,
  snapshot: StagedCatalogueAggregate,
) {
  const [services, serviceRequirements, offeringRequirements] =
    await Promise.all([
      transaction.catalogueService.findMany({ select: { id: true } }),
      transaction.catalogueRequirement.findMany({
        where: { recommendedServiceId: { not: null } },
        select: { serviceId: true, recommendedServiceId: true },
      }),
      transaction.catalogueOfferingRequirement.findMany({
        where: { recommendedServiceId: { not: null } },
        select: {
          recommendedServiceId: true,
          offering: { select: { serviceId: true } },
        },
      }),
    ]);
  const serviceIds = new Set(services.map(({ id }) => id));
  const edges = new Map<string, string[]>();
  serviceRequirements.forEach((requirement) => {
    if (requirement.serviceId !== ownerServiceId) {
      addRecommendationEdge(
        edges,
        requirement.serviceId,
        requirement.recommendedServiceId,
      );
    }
  });
  offeringRequirements.forEach((requirement) => {
    const serviceId = requirement.offering.serviceId;
    if (serviceId !== ownerServiceId) {
      addRecommendationEdge(edges, serviceId, requirement.recommendedServiceId);
    }
  });

  for (const targetServiceId of candidateRecommendationTargets(snapshot)) {
    if (!serviceIds.has(targetServiceId)) {
      throw new CatalogueTransitionError(
        "A prerequisite recommendation target no longer exists.",
      );
    }
    if (
      wouldCreateRecommendationCycle(edges, ownerServiceId, targetServiceId)
    ) {
      throw new CatalogueTransitionError(
        "Publishing these prerequisite recommendations would create a circular chain.",
      );
    }
    addRecommendationEdge(edges, ownerServiceId, targetServiceId);
  }
}

export async function addRequirement(
  input: RequirementInput,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    await assertRecommendationIsAcyclic(
      transaction,
      input.serviceId,
      input.recommendedServiceId,
      editableSnapshot(service),
    );
    const stagedRequirement = {
      id: stagedId(),
      title: input.title,
      description: input.description,
      type: input.type,
      isRequired: input.isRequired,
      displayOrder: input.displayOrder,
      verificationMode: input.verificationMode,
      customerGuidance: input.customerGuidance ?? null,
      metricKey: input.metricKey ?? null,
      comparisonOperator: input.comparisonOperator ?? null,
      requiredValue: input.requiredValue ?? null,
      recommendedServiceId: input.recommendedServiceId ?? null,
      seededKey: null,
    };
    const staged = await mutatePublishedStage(
      transaction,
      input.serviceId,
      actorId,
      expectedVersion,
      (snapshot) => addStagedRequirement(snapshot, stagedRequirement),
    );
    if (staged) {
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.requirement.change_staged",
          targetType: "CatalogueService",
          targetId: input.serviceId,
          metadata: auditMetadata({ requirementId: stagedRequirement.id }),
        },
      });
      return { ...stagedRequirement, staged: true };
    }

    const requirement = await transaction.catalogueRequirement.create({
      data: {
        ...input,
        requiredValue: prismaRequirementBigInt(input.requiredValue),
      },
    });
    const serviceUpdate = await transaction.catalogueService.updateMany({
      where: { id: input.serviceId, version: expectedVersion },
      data: { updatedById: actorId, version: { increment: 1 } },
    });
    if (serviceUpdate.count !== 1) {
      throw new CatalogueConflictError(
        "This service changed after the editor was opened. Reload before continuing.",
      );
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.requirement.created",
        targetType: "CatalogueService",
        targetId: input.serviceId,
        metadata: auditMetadata({ requirementId: requirement.id }),
      },
    });
    return { ...requirement, staged: false };
  });
}

export async function deleteRequirement(
  serviceId: string,
  requirementId: string,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const staged = await mutatePublishedStage(
      transaction,
      serviceId,
      actorId,
      expectedVersion,
      (snapshot) => {
        if (
          !snapshot.requirements.some(
            (requirement) => requirement.id === requirementId,
          )
        ) {
          throw new CatalogueConflictError("Requirement not found.");
        }
        return removeStagedRequirement(snapshot, requirementId);
      },
    );
    if (staged) {
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.requirement.change_staged",
          targetType: "CatalogueService",
          targetId: serviceId,
          metadata: auditMetadata({ requirementId, removed: true }),
        },
      });
      return { staged: true };
    }

    const result = await transaction.catalogueRequirement.deleteMany({
      where: { id: requirementId, serviceId },
    });
    if (result.count !== 1)
      throw new CatalogueConflictError("Requirement not found.");
    const serviceUpdate = await transaction.catalogueService.updateMany({
      where: { id: serviceId, version: expectedVersion },
      data: { updatedById: actorId, version: { increment: 1 } },
    });
    if (serviceUpdate.count !== 1) {
      throw new CatalogueConflictError(
        "This service changed after the editor was opened. Reload before continuing.",
      );
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.requirement.deleted",
        targetType: "CatalogueService",
        targetId: serviceId,
        metadata: auditMetadata({ requirementId }),
      },
    });
    return { staged: false };
  });
}

export async function addMediaReference(
  input: MediaInput,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const owner = mediaOwnerWhere(input);
    if (input.serviceId) {
      const stagedMedia = {
        id: stagedId(),
        assetPath: input.assetPath,
        altText: input.altText,
        caption: input.caption ?? null,
        displayOrder: input.displayOrder,
        isPrimary: input.isPrimary,
      };
      const staged = await mutatePublishedStage(
        transaction,
        input.serviceId,
        actorId,
        expectedVersion,
        (snapshot) => addStagedMedia(snapshot, stagedMedia),
      );
      if (staged) {
        await transaction.auditLog.create({
          data: {
            actorId,
            action: "catalogue.media.change_staged",
            targetType: "CatalogueService",
            targetId: input.serviceId,
            metadata: auditMetadata({
              mediaId: stagedMedia.id,
              isPrimary: stagedMedia.isPrimary,
            }),
          },
        });
        return { ...stagedMedia, staged: true };
      }
    }

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
      const serviceUpdate = await transaction.catalogueService.updateMany({
        where: { id: input.serviceId, version: expectedVersion },
        data: {
          ...(input.isPrimary ? { primaryMediaPath: input.assetPath } : {}),
          updatedById: actorId,
          version: { increment: 1 },
        },
      });
      if (serviceUpdate.count !== 1) {
        throw new CatalogueConflictError(
          "This service changed after the editor was opened. Reload before continuing.",
        );
      }
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
    return { ...media, staged: false };
  });
}

export async function deleteMediaReference(
  serviceId: string,
  mediaId: string,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const staged = await mutatePublishedStage(
      transaction,
      serviceId,
      actorId,
      expectedVersion,
      (snapshot) => {
        if (!snapshot.mediaReferences.some((media) => media.id === mediaId)) {
          throw new CatalogueConflictError("Media reference not found.");
        }
        return removeStagedMedia(snapshot, mediaId);
      },
    );
    if (staged) {
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.media.change_staged",
          targetType: "CatalogueService",
          targetId: serviceId,
          metadata: auditMetadata({ mediaId, removed: true }),
        },
      });
      return { staged: true };
    }

    const media = await transaction.catalogueMediaReference.findFirst({
      where: { id: mediaId, serviceId },
    });
    if (!media) throw new CatalogueConflictError("Media reference not found.");
    await transaction.catalogueMediaReference.delete({
      where: { id: mediaId },
    });
    const serviceUpdate = await transaction.catalogueService.updateMany({
      where: { id: serviceId, version: expectedVersion },
      data: {
        ...(media.isPrimary ? { primaryMediaPath: null } : {}),
        updatedById: actorId,
        version: { increment: 1 },
      },
    });
    if (serviceUpdate.count !== 1) {
      throw new CatalogueConflictError(
        "This service changed after the editor was opened. Reload before continuing.",
      );
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.media.deleted",
        targetType: "CatalogueService",
        targetId: serviceId,
        metadata: auditMetadata({ mediaId }),
      },
    });
    return { staged: false };
  });
}

function offeringFromInput(
  input: OfferingInput,
  id: string,
  existing?: StagedCatalogueAggregate["offerings"][number],
): StagedCatalogueAggregate["offerings"][number] {
  return {
    id,
    seededKey: existing?.seededKey ?? null,
    slug: input.slug,
    name: input.name,
    shortSummary: input.shortSummary,
    description: input.description ?? null,
    displayOrder: input.displayOrder,
    isActive: input.isActive,
    isFeatured: input.isFeatured,
    needsClientReview: input.needsClientReview,
    groupLabel: input.groupLabel ?? null,
    tierLabel: input.tierLabel ?? null,
    quantityEnabled: input.quantityEnabled,
    quantityUnit: input.quantityEnabled ? (input.quantityUnit ?? null) : null,
    minimumQuantity: input.quantityEnabled
      ? (input.minimumQuantity ?? null)
      : null,
    maximumQuantity: input.quantityEnabled
      ? (input.maximumQuantity ?? null)
      : null,
    gameModes: input.gameModes,
    facets: input.facets.map((facet) => ({
      id:
        existing?.facets.find(
          (item) =>
            item.facetKey === facet.facetKey &&
            item.facetValue === facet.facetValue,
        )?.id ?? stagedId(),
      ...facet,
    })),
    requirements: existing?.requirements ?? [],
  };
}

function offeringUpdateAction(
  previous: StagedCatalogueAggregate["offerings"][number] | undefined,
  current: StagedCatalogueAggregate["offerings"][number],
  staged: boolean,
) {
  if (!previous) {
    return staged
      ? "catalogue.offering.created_staged"
      : "catalogue.offering.created";
  }
  if (previous.isActive !== current.isActive) {
    return current.isActive
      ? "catalogue.offering.activated"
      : "catalogue.offering.deactivated";
  }
  if (previous.displayOrder !== current.displayOrder) {
    return "catalogue.offering.reordered";
  }
  if (JSON.stringify(previous.facets) !== JSON.stringify(current.facets)) {
    return "catalogue.offering.facets_changed";
  }
  if (
    JSON.stringify(previous.gameModes) !== JSON.stringify(current.gameModes)
  ) {
    return "catalogue.offering.game_modes_changed";
  }
  return staged
    ? "catalogue.offering.updated_staged"
    : "catalogue.offering.updated";
}

async function claimDraftService(
  transaction: Prisma.TransactionClient,
  serviceId: string,
  actorId: string,
  expectedVersion: number,
) {
  const claimed = await transaction.catalogueService.updateMany({
    where: {
      id: serviceId,
      version: expectedVersion,
      publicationStatus: { not: "PUBLISHED" },
    },
    data: { updatedById: actorId, version: { increment: 1 } },
  });
  if (claimed.count !== 1) {
    throw new CatalogueConflictError(
      "This service changed after the editor was opened. Reload before continuing.",
    );
  }
}

export async function assertOfferingBelongsToService(
  transaction: Prisma.TransactionClient,
  serviceId: string,
  offeringId: string,
) {
  const offering = await transaction.catalogueOffering.findUnique({
    where: { id: offeringId },
    select: { serviceId: true },
  });
  if (!offering || offering.serviceId !== serviceId) {
    throw new CatalogueConflictError("Offering not found.");
  }
}

function stagedOfferingForService(
  snapshot: StagedCatalogueAggregate,
  offeringId: string,
) {
  const offering = snapshot.offerings.find(({ id }) => id === offeringId);
  if (!offering) throw new CatalogueConflictError("Offering not found.");
  return offering;
}

export async function saveOffering(
  input: OfferingInput,
  actorId: string,
  expectedVersion: number,
  offeringId?: string,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    const editable =
      service.publicationStatus === "PUBLISHED"
        ? editableSnapshot(service)
        : null;
    const parentGameModes =
      editable?.gameModes ?? service.gameModes.map((item) => item.gameMode);
    if (input.gameModes.some((mode) => !parentGameModes.includes(mode))) {
      throw new CatalogueTransitionError(
        "Offering game modes must be supported by the parent service.",
      );
    }
    const id = offeringId ?? stagedId();
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = editable ?? editableSnapshot(service);
      const existing = snapshot.offerings.find(
        (offering) => offering.id === id,
      );
      if (offeringId && !existing)
        throw new CatalogueConflictError("Offering not found.");
      const offering = offeringFromInput(input, id, existing);
      const result = await persistServiceStage({
        transaction,
        service,
        snapshot: upsertStagedOffering(snapshot, offering),
        actorId,
        expectedVersion,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: offeringUpdateAction(existing, offering, true),
          targetType: "CatalogueOffering",
          targetId: id,
          metadata: auditMetadata({
            serviceId: input.serviceId,
            stageVersion: result.version,
          }),
        },
      });
      return { id, staged: true };
    }

    await claimDraftService(
      transaction,
      input.serviceId,
      actorId,
      expectedVersion,
    );
    const data = {
      slug: input.slug,
      name: input.name,
      shortSummary: input.shortSummary,
      description: input.description,
      displayOrder: input.displayOrder,
      isActive: input.isActive,
      isFeatured: input.isFeatured,
      needsClientReview: input.needsClientReview,
      groupLabel: input.groupLabel,
      tierLabel: input.tierLabel,
      quantityEnabled: input.quantityEnabled,
      quantityUnit: input.quantityEnabled ? input.quantityUnit : null,
      minimumQuantity: input.quantityEnabled ? input.minimumQuantity : null,
      maximumQuantity: input.quantityEnabled ? input.maximumQuantity : null,
    };
    const previousOffering = snapshotFromService(service).offerings.find(
      (item) => item.id === offeringId,
    );
    const offering = offeringId
      ? await transaction.catalogueOffering.update({
          where: { id: offeringId, serviceId: input.serviceId },
          data: {
            ...data,
            facets: { deleteMany: {}, create: input.facets },
            gameModes: {
              deleteMany: {},
              create: input.gameModes.map((gameMode) => ({ gameMode })),
            },
          },
        })
      : await transaction.catalogueOffering.create({
          data: {
            id,
            serviceId: input.serviceId,
            ...data,
            facets: { create: input.facets },
            gameModes: {
              create: input.gameModes.map((gameMode) => ({ gameMode })),
            },
          },
        });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: offeringUpdateAction(
          previousOffering,
          offeringFromInput(input, offering.id, previousOffering),
          false,
        ),
        targetType: "CatalogueOffering",
        targetId: offering.id,
        metadata: auditMetadata({ serviceId: input.serviceId }),
      },
    });
    return { id: offering.id, staged: false };
  });
}

export async function deleteOffering(
  serviceId: string,
  offeringId: string,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, serviceId);
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = editableSnapshot(service);
      if (!snapshot.offerings.some(({ id }) => id === offeringId)) {
        throw new CatalogueConflictError("Offering not found.");
      }
      const persisted = await persistServiceStage({
        transaction,
        service,
        snapshot: removeStagedOffering(snapshot, offeringId),
        actorId,
        expectedVersion,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "catalogue.offering.deleted_staged",
          targetType: "CatalogueOffering",
          targetId: offeringId,
          metadata: auditMetadata({
            serviceId,
            stageVersion: persisted.version,
          }),
        },
      });
      return { staged: true };
    }
    await claimDraftService(transaction, serviceId, actorId, expectedVersion);
    const deleted = await transaction.catalogueOffering.deleteMany({
      where: { id: offeringId, serviceId },
    });
    if (deleted.count !== 1)
      throw new CatalogueConflictError("Offering not found.");
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.offering.deleted",
        targetType: "CatalogueOffering",
        targetId: offeringId,
        metadata: auditMetadata({ serviceId }),
      },
    });
    return { staged: false };
  });
}

export async function duplicateOffering(
  serviceId: string,
  offeringId: string,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, serviceId);
    const snapshot = editableSnapshot(service);
    const source = snapshot.offerings.find(({ id }) => id === offeringId);
    if (!source) throw new CatalogueConflictError("Offering not found.");
    const id = stagedId();
    const slug = nextDuplicateSlug(
      source.slug,
      snapshot.offerings.map((item) => item.slug),
    );
    const duplicate = {
      ...source,
      id,
      seededKey: null,
      slug,
      name: `${source.name} copy`,
      isActive: false,
      isFeatured: false,
      needsClientReview: true,
      facets: source.facets.map((facet) => ({ ...facet, id: stagedId() })),
      requirements: source.requirements.map((requirement) => ({
        ...requirement,
        id: stagedId(),
        seededKey: null,
      })),
    };
    if (service.publicationStatus === "PUBLISHED") {
      await persistServiceStage({
        transaction,
        service,
        snapshot: upsertStagedOffering(snapshot, duplicate),
        actorId,
        expectedVersion,
      });
    } else {
      await claimDraftService(transaction, serviceId, actorId, expectedVersion);
      await transaction.catalogueOffering.create({
        data: {
          ...duplicate,
          serviceId,
          gameModes: {
            create: duplicate.gameModes.map((gameMode) => ({ gameMode })),
          },
          facets: { create: duplicate.facets },
          requirements: {
            create: duplicate.requirements.map((requirement) => ({
              ...requirement,
              requiredValue: prismaRequirementBigInt(requirement.requiredValue),
            })),
          },
        },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.offering.duplicated",
        targetType: "CatalogueOffering",
        targetId: id,
        metadata: auditMetadata({ serviceId, sourceId: offeringId }),
      },
    });
    return { id, staged: service.publicationStatus === "PUBLISHED" };
  });
}

export async function addOfferingRequirement(
  input: OfferingRequirementInput,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, input.serviceId);
    const snapshot = editableSnapshot(service);
    const targetOffering =
      service.publicationStatus === "PUBLISHED"
        ? stagedOfferingForService(snapshot, input.offeringId)
        : null;
    if (service.publicationStatus !== "PUBLISHED") {
      await assertOfferingBelongsToService(
        transaction,
        input.serviceId,
        input.offeringId,
      );
    }
    await assertRecommendationIsAcyclic(
      transaction,
      input.serviceId,
      input.recommendedServiceId,
      snapshot,
    );
    const requirement = {
      id: stagedId(),
      title: input.title,
      description: input.description,
      type: input.type,
      isRequired: input.isRequired,
      displayOrder: input.displayOrder,
      verificationMode: input.verificationMode,
      customerGuidance: input.customerGuidance ?? null,
      metricKey: input.metricKey ?? null,
      comparisonOperator: input.comparisonOperator ?? null,
      requiredValue: input.requiredValue ?? null,
      recommendedServiceId: input.recommendedServiceId ?? null,
      seededKey: null,
    };
    if (service.publicationStatus === "PUBLISHED") {
      await persistServiceStage({
        transaction,
        service,
        snapshot: upsertStagedOffering(snapshot, {
          ...targetOffering!,
          requirements: [...targetOffering!.requirements, requirement],
        }),
        actorId,
        expectedVersion,
      });
    } else {
      await claimDraftService(
        transaction,
        input.serviceId,
        actorId,
        expectedVersion,
      );
      await transaction.catalogueOfferingRequirement.create({
        data: {
          ...requirement,
          offeringId: input.offeringId,
          requiredValue: prismaRequirementBigInt(requirement.requiredValue),
        },
      });
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action:
          input.verificationMode === "AUTOMATIC"
            ? "catalogue.eligibility.automatic_rule_changed"
            : input.recommendedServiceId
              ? "catalogue.eligibility.prerequisite_changed"
              : "catalogue.offering.requirement_changed",
        targetType: "CatalogueOffering",
        targetId: input.offeringId,
        metadata: auditMetadata({
          serviceId: input.serviceId,
          requirementId: requirement.id,
          recommendedServiceId: input.recommendedServiceId ?? null,
        }),
      },
    });
    return {
      id: requirement.id,
      staged: service.publicationStatus === "PUBLISHED",
    };
  });
}

export async function deleteOfferingRequirement(
  serviceId: string,
  offeringId: string,
  requirementId: string,
  actorId: string,
  expectedVersion: number,
) {
  return prisma.$transaction(async (transaction) => {
    const service = await loadServiceAggregate(transaction, serviceId);
    if (service.publicationStatus === "PUBLISHED") {
      const snapshot = editableSnapshot(service);
      const offering = stagedOfferingForService(snapshot, offeringId);
      if (!offering?.requirements.some(({ id }) => id === requirementId)) {
        throw new CatalogueConflictError("Offering requirement not found.");
      }
      await persistServiceStage({
        transaction,
        service,
        snapshot: upsertStagedOffering(snapshot, {
          ...offering,
          requirements: offering.requirements.filter(
            ({ id }) => id !== requirementId,
          ),
        }),
        actorId,
        expectedVersion,
      });
    } else {
      await assertOfferingBelongsToService(transaction, serviceId, offeringId);
      await claimDraftService(transaction, serviceId, actorId, expectedVersion);
      const deleted = await transaction.catalogueOfferingRequirement.deleteMany(
        {
          where: { id: requirementId, offeringId },
        },
      );
      if (deleted.count !== 1)
        throw new CatalogueConflictError("Offering requirement not found.");
    }
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "catalogue.offering.requirement_changed",
        targetType: "CatalogueOffering",
        targetId: offeringId,
        metadata: auditMetadata({ serviceId, requirementId, removed: true }),
      },
    });
    return { staged: service.publicationStatus === "PUBLISHED" };
  });
}
