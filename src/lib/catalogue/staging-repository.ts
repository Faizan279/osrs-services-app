import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { CatalogueConflictError } from "@/lib/catalogue/errors";
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
  expectedVersion?: number;
}) {
  if (service.stage) {
    const result = await transaction.catalogueServiceStage.updateMany({
      where: {
        id: service.stage.id,
        ...(expectedVersion === undefined ? {} : { version: expectedVersion }),
      },
      data: {
        snapshot: jsonSnapshot(snapshot),
        updatedById: actorId,
        version: { increment: 1 },
      },
    });
    if (result.count !== 1) {
      throw new CatalogueConflictError(
        "Pending changes were updated elsewhere. Reload before saving.",
      );
    }
    return { version: service.stage.version + 1, created: false };
  }

  if (expectedVersion !== undefined && expectedVersion !== service.version) {
    throw new CatalogueConflictError(
      "This service changed after the editor was opened. Reload before saving.",
    );
  }
  const stage = await transaction.catalogueServiceStage.create({
    data: {
      serviceId: service.id,
      snapshot: jsonSnapshot(snapshot),
      baseVersion: service.version,
      version: service.version + 1,
      updatedById: actorId,
    },
  });
  return { version: stage.version, created: true };
}

export async function mutatePublishedStage(
  transaction: Prisma.TransactionClient,
  serviceId: string,
  actorId: string,
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
  });
  return { service, snapshot, ...persisted };
}
