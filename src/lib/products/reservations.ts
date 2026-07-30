import "server-only";

import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import {
  ProductInventoryConflictError,
  ProductInventoryTransitionError,
  activeReservedQuantityForVariant,
  parsePositiveQuantity,
} from "@/lib/products/inventory";
import { safeProductJson } from "@/lib/products/estimate";

function stableId() {
  return randomBytes(12).toString("hex");
}

function stableKey(prefix: string) {
  return `${prefix}-${randomBytes(8).toString("hex")}`;
}

function auditMetadata(value: Record<string, unknown>) {
  return safeProductJson(value) as Prisma.InputJsonValue;
}

async function reservationEvent({
  transaction,
  reservationId,
  eventType,
  actorId,
  metadata,
}: {
  transaction: Prisma.TransactionClient;
  reservationId: string;
  eventType: "ACTIVE" | "RELEASED" | "EXPIRED" | "CANCELLED";
  actorId: string;
  metadata?: Record<string, unknown>;
}) {
  await transaction.productReservationEvent.create({
    data: {
      id: stableId(),
      reservationId,
      eventType,
      actorId,
      safeMetadata: metadata ? auditMetadata(metadata) : undefined,
    },
  });
}

export async function createProductInventoryReservation({
  variantId,
  quantity,
  expiresAt,
  safeInternalPurpose,
  actorId,
  idempotencyKey,
  expectedVariantVersion,
  futureExternalRef,
  now = new Date(),
}: {
  variantId: string;
  quantity: string | number | bigint;
  expiresAt: Date;
  safeInternalPurpose: string;
  actorId: string;
  idempotencyKey?: string | null;
  expectedVariantVersion?: number;
  futureExternalRef?: string | null;
  now?: Date;
}) {
  const parsedQuantity = parsePositiveQuantity(quantity);
  const purpose = safeInternalPurpose.trim().slice(0, 240);
  if (!purpose) {
    throw new ProductInventoryTransitionError(
      "Provide a safe internal reservation purpose.",
    );
  }
  if (expiresAt <= now) {
    throw new ProductInventoryTransitionError(
      "Reservation expiry must be in the future.",
    );
  }

  return prisma.$transaction(async (transaction) => {
    if (idempotencyKey) {
      const existing = await transaction.productInventoryReservation.findUnique(
        {
          where: { idempotencyKey },
          select: {
            id: true,
            stableKey: true,
            variantId: true,
            quantity: true,
            status: true,
            expiresAt: true,
            concurrencyVersion: true,
          },
        },
      );
      if (existing) {
        return { reservation: existing, idempotent: true, unlimited: false };
      }
    }

    const variant = await transaction.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        stockMode: true,
        status: true,
        enabled: true,
        availabilityState: true,
        onHandQuantity: true,
        concurrencyVersion: true,
      },
    });
    if (!variant) {
      throw new ProductInventoryTransitionError("Product variant not found.");
    }
    if (!variant.enabled || variant.status !== "AVAILABLE") {
      throw new ProductInventoryTransitionError(
        "Only enabled available variants can be reserved.",
      );
    }
    if (variant.stockMode === "UNLIMITED") {
      return { reservation: null, idempotent: false, unlimited: true };
    }
    if (
      variant.stockMode === "MANUAL_REVIEW" ||
      variant.availabilityState === "MANUAL_REVIEW_REQUIRED"
    ) {
      throw new ProductInventoryTransitionError(
        "Manual-review variants cannot be reserved automatically.",
      );
    }
    if (
      variant.availabilityState === "PAUSED" ||
      variant.availabilityState === "UNAVAILABLE" ||
      variant.availabilityState === "OUT_OF_STOCK"
    ) {
      throw new ProductInventoryTransitionError(
        "This variant is not currently reservable.",
      );
    }
    const versionToClaim = expectedVariantVersion ?? variant.concurrencyVersion;
    if (variant.concurrencyVersion !== versionToClaim) {
      throw new ProductInventoryConflictError(
        "Inventory changed after this page loaded. Reload before reserving stock.",
      );
    }

    const reserved = await activeReservedQuantityForVariant(
      transaction,
      variantId,
      now,
    );
    const available = variant.onHandQuantity - reserved;
    if (available < parsedQuantity) {
      throw new ProductInventoryTransitionError(
        "The reservation exceeds currently available stock.",
      );
    }

    const updated = await transaction.productVariant.updateMany({
      where: {
        id: variantId,
        concurrencyVersion: versionToClaim,
      },
      data: { concurrencyVersion: { increment: 1 } },
    });
    if (updated.count !== 1) {
      throw new ProductInventoryConflictError(
        "Inventory changed before the reservation could be created.",
      );
    }

    const reservation = await transaction.productInventoryReservation.create({
      data: {
        id: stableId(),
        stableKey: stableKey("prod-reservation"),
        variantId,
        quantity: parsedQuantity,
        expiresAt,
        safeInternalPurpose: purpose,
        actorId,
        idempotencyKey: idempotencyKey || null,
        futureExternalRef: futureExternalRef?.trim() || null,
      },
      select: {
        id: true,
        stableKey: true,
        variantId: true,
        quantity: true,
        status: true,
        expiresAt: true,
        concurrencyVersion: true,
      },
    });

    await reservationEvent({
      transaction,
      reservationId: reservation.id,
      eventType: "ACTIVE",
      actorId,
      metadata: {
        quantity: parsedQuantity.toString(),
        expiresAt: expiresAt.toISOString(),
        hasIdempotencyKey: Boolean(idempotencyKey),
        futureExternalRefPresent: Boolean(futureExternalRef),
      },
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "products.reservation.created",
        targetType: "ProductInventoryReservation",
        targetId: reservation.id,
        metadata: auditMetadata({
          variantId,
          quantity: parsedQuantity.toString(),
          expiresAt: expiresAt.toISOString(),
        }),
      },
    });

    return { reservation, idempotent: false, unlimited: false };
  });
}

export async function releaseProductInventoryReservation({
  reservationId,
  actorId,
  expectedVersion,
  now = new Date(),
}: {
  reservationId: string;
  actorId: string;
  expectedVersion: number;
  now?: Date;
}) {
  return prisma.$transaction(async (transaction) => {
    const reservation =
      await transaction.productInventoryReservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          variantId: true,
          status: true,
          concurrencyVersion: true,
        },
      });
    if (!reservation) {
      throw new ProductInventoryTransitionError("Reservation not found.");
    }
    if (reservation.status === "RELEASED") {
      return { id: reservation.id, idempotent: true };
    }
    if (reservation.status !== "ACTIVE") {
      throw new ProductInventoryTransitionError(
        "Only active reservations can be released.",
      );
    }
    if (reservation.concurrencyVersion !== expectedVersion) {
      throw new ProductInventoryConflictError(
        "The reservation changed after this page loaded. Reload before releasing.",
      );
    }
    const updated = await transaction.productInventoryReservation.updateMany({
      where: {
        id: reservationId,
        status: "ACTIVE",
        concurrencyVersion: expectedVersion,
      },
      data: {
        status: "RELEASED",
        releasedAt: now,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ProductInventoryConflictError(
        "The reservation changed before it could be released.",
      );
    }
    await reservationEvent({
      transaction,
      reservationId,
      eventType: "RELEASED",
      actorId,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "products.reservation.released",
        targetType: "ProductInventoryReservation",
        targetId: reservationId,
        metadata: auditMetadata({ variantId: reservation.variantId }),
      },
    });
    return { id: reservationId, idempotent: false };
  });
}

export async function cancelProductInventoryReservation({
  reservationId,
  actorId,
  expectedVersion,
  now = new Date(),
}: {
  reservationId: string;
  actorId: string;
  expectedVersion: number;
  now?: Date;
}) {
  return prisma.$transaction(async (transaction) => {
    const reservation =
      await transaction.productInventoryReservation.findUnique({
        where: { id: reservationId },
        select: {
          id: true,
          variantId: true,
          status: true,
          concurrencyVersion: true,
        },
      });
    if (!reservation || reservation.status !== "ACTIVE") {
      throw new ProductInventoryTransitionError(
        "Only active reservations can be cancelled.",
      );
    }
    if (reservation.concurrencyVersion !== expectedVersion) {
      throw new ProductInventoryConflictError(
        "The reservation changed after this page loaded. Reload before cancelling.",
      );
    }
    await transaction.productInventoryReservation.update({
      where: { id: reservationId },
      data: {
        status: "CANCELLED",
        releasedAt: now,
        concurrencyVersion: { increment: 1 },
      },
    });
    await reservationEvent({
      transaction,
      reservationId,
      eventType: "CANCELLED",
      actorId,
    });
    await transaction.auditLog.create({
      data: {
        actorId,
        action: "products.reservation.cancelled",
        targetType: "ProductInventoryReservation",
        targetId: reservationId,
        metadata: auditMetadata({ variantId: reservation.variantId }),
      },
    });
    return { id: reservationId };
  });
}

export async function expireProductInventoryReservations({
  actorId,
  now = new Date(),
}: {
  actorId: string;
  now?: Date;
}) {
  const reservations = await prisma.productInventoryReservation.findMany({
    where: { status: "ACTIVE", expiresAt: { lte: now } },
    select: {
      id: true,
      variantId: true,
      concurrencyVersion: true,
    },
  });
  let expired = 0;
  for (const reservation of reservations) {
    await prisma.$transaction(async (transaction) => {
      const updated = await transaction.productInventoryReservation.updateMany({
        where: {
          id: reservation.id,
          status: "ACTIVE",
          concurrencyVersion: reservation.concurrencyVersion,
        },
        data: {
          status: "EXPIRED",
          releasedAt: now,
          concurrencyVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) return;
      expired += 1;
      await reservationEvent({
        transaction,
        reservationId: reservation.id,
        eventType: "EXPIRED",
        actorId,
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: "products.reservation.expired",
          targetType: "ProductInventoryReservation",
          targetId: reservation.id,
          metadata: auditMetadata({ variantId: reservation.variantId }),
        },
      });
    });
  }
  return expired;
}
