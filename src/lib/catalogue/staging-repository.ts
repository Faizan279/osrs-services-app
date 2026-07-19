import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  CatalogueConflictError,
  pendingChangesConflictMessage,
} from "@/lib/catalogue/errors";
import {
  snapshotFromService,
  stagedCatalogueAggregateSchema,
  type StagedCatalogueAggregate,
} from "@/lib/catalogue/staging";

export const stagedAggregateInclude = {
  stage: true,
  category: true,
  gameModes: { orderBy: { gameMode: "asc" as const } },
  requirements: {
    orderBy: [{ displayOrder: "asc" as const }, { title: "asc" as const }],
  },
  mediaReferences: {
    orderBy: [{ isPrimary: "desc" as const }, { displayOrder: "asc" as const }],
  },
  offerings: {
    orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
    include: {
      gameModes: { orderBy: { gameMode: "asc" as const } },
      facets: {
        orderBy: [{ displayOrder: "asc" as const }, { label: "asc" as const }],
      },
      requirements: {
        orderBy: [{ displayOrder: "asc" as const }, { title: "asc" as const }],
      },
    },
  },
  skillingRule: true,
  skillingSkills: {
    orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
    include: {
      methods: {
        orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
      },
    },
  },
  bossingRule: true,
  bossingBosses: {
    orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
    include: {
      methods: {
        orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
        include: {
          statRequirements: {
            orderBy: [
              { displayOrder: "asc" as const },
              { label: "asc" as const },
            ],
          },
          gearRequirements: {
            orderBy: [
              { displayOrder: "asc" as const },
              { label: "asc" as const },
            ],
          },
        },
      },
    },
  },
  premiumConfig: true,
  premiumPackages: {
    orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
    include: {
      requirementGroups: {
        orderBy: [{ displayOrder: "asc" as const }, { title: "asc" as const }],
        include: {
          requirements: {
            orderBy: [
              { displayOrder: "asc" as const },
              { label: "asc" as const },
            ],
          },
        },
      },
      faqs: {
        orderBy: [
          { displayOrder: "asc" as const },
          { question: "asc" as const },
        ],
      },
    },
  },
  premiumOptions: {
    orderBy: [{ displayOrder: "asc" as const }, { name: "asc" as const }],
  },
} satisfies Prisma.CatalogueServiceInclude;

export async function loadServiceAggregate(
  transaction: Prisma.TransactionClient,
  serviceId: string,
) {
  return transaction.catalogueService.findUniqueOrThrow({
    where: { id: serviceId },
    include: stagedAggregateInclude,
  });
}

export function editableSnapshot(
  service: Awaited<ReturnType<typeof loadServiceAggregate>>,
) {
  return service.stage
    ? stagedCatalogueAggregateSchema.parse(service.stage.snapshot)
    : snapshotFromService(service);
}

function jsonSnapshot(snapshot: StagedCatalogueAggregate) {
  return JSON.parse(JSON.stringify(snapshot)) as Prisma.InputJsonValue;
}

export async function persistServiceStage({
  transaction,
  service,
  snapshot,
  actorId,
  expectedVersion,
}: {
  transaction: Prisma.TransactionClient;
  service: Awaited<ReturnType<typeof loadServiceAggregate>>;
  snapshot: StagedCatalogueAggregate;
  actorId: string;
  expectedVersion: number;
}) {
  if (service.stage) {
    const result = await transaction.catalogueServiceStage.updateMany({
      where: {
        id: service.stage.id,
        serviceId: service.id,
        version: expectedVersion,
      },
      data: {
        snapshot: jsonSnapshot(snapshot),
        updatedById: actorId,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new CatalogueConflictError(pendingChangesConflictMessage);
    }
    return { version: expectedVersion + 1, created: false };
  }

  const claimed = await transaction.catalogueService.updateMany({
    where: {
      id: service.id,
      publicationStatus: "PUBLISHED",
      version: expectedVersion,
    },
    data: {
      updatedById: actorId,
      version: { increment: 1 },
    },
  });
  if (claimed.count !== 1) {
    throw new CatalogueConflictError(pendingChangesConflictMessage);
  }

  const version = expectedVersion + 1;
  const created = await transaction.catalogueServiceStage.createMany({
    data: [
      {
        serviceId: service.id,
        snapshot: jsonSnapshot(snapshot),
        baseVersion: version,
        version,
        updatedById: actorId,
      },
    ],
    skipDuplicates: true,
  });
  if (created.count !== 1) {
    throw new CatalogueConflictError(pendingChangesConflictMessage);
  }
  return { version, created: true };
}

export async function mutatePublishedStage(
  transaction: Prisma.TransactionClient,
  serviceId: string,
  actorId: string,
  expectedVersion: number,
  mutate: (snapshot: StagedCatalogueAggregate) => StagedCatalogueAggregate,
) {
  const service = await loadServiceAggregate(transaction, serviceId);
  if (service.publicationStatus !== "PUBLISHED") return null;
  const snapshot = mutate(editableSnapshot(service));
  const persisted = await persistServiceStage({
    transaction,
    service,
    snapshot,
    actorId,
    expectedVersion,
  });
  return { service, snapshot, ...persisted };
}
