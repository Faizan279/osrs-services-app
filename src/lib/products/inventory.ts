import "server-only";

import { randomBytes } from "node:crypto";

import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { productInventoryEntryTypes } from "@/lib/products/constants";
import {
  ProductMarketplaceValidationError,
  safeProductJson,
} from "@/lib/products/estimate";

export class ProductInventoryConflictError extends Error {}
export class ProductInventoryTransitionError extends Error {}

type ProductInventoryEntryType = (typeof productInventoryEntryTypes)[number];

function stableId() {
  return randomBytes(12).toString("hex");
}

function auditMetadata(value: Record<string, unknown>) {
  return safeProductJson(value) as Prisma.InputJsonValue;
}

export function parsePositiveQuantity(value: string | number | bigint) {
  if (typeof value === "bigint") {
    if (value <= 0n) {
      throw new ProductMarketplaceValidationError(
        "Quantity must be greater than zero.",
      );
    }
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || value <= 0) {
      throw new ProductMarketplaceValidationError(
        "Quantity must be a positive whole number.",
      );
    }
    return BigInt(value);
  }
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) {
    throw new ProductMarketplaceValidationError(
      "Quantity must be a positive whole number.",
    );
  }
  const quantity = BigInt(normalized);
  if (quantity <= 0n) {
    throw new ProductMarketplaceValidationError(
      "Quantity must be greater than zero.",
    );
  }
  return quantity;
}

export function entrySignedQuantity(
  entryType: ProductInventoryEntryType,
  quantity: bigint,
) {
  if (
    entryType === "STOCK_IN" ||
    entryType === "CORRECTION_IN" ||
    entryType === "INITIAL_BALANCE"
  ) {
    return quantity;
  }
  return -quantity;
}

export async function activeReservedQuantityForVariant(
  transaction: Prisma.TransactionClient,
  variantId: string,
  now = new Date(),
) {
  const aggregate = await transaction.productInventoryReservation.aggregate({
    where: {
      variantId,
      status: "ACTIVE",
      expiresAt: { gt: now },
    },
    _sum: { quantity: true },
  });
  return aggregate._sum.quantity ?? 0n;
}

export async function availableQuantityForVariant(
  transaction: Prisma.TransactionClient,
  variantId: string,
  now = new Date(),
) {
  const variant = await transaction.productVariant.findUnique({
    where: { id: variantId },
    select: {
      id: true,
      stockMode: true,
      onHandQuantity: true,
      concurrencyVersion: true,
    },
  });
  if (!variant) {
    throw new ProductInventoryTransitionError("Product variant not found.");
  }
  if (variant.stockMode === "UNLIMITED") {
    return { variant, reservedQuantity: 0n, availableQuantity: null };
  }
  if (variant.stockMode === "MANUAL_REVIEW") {
    return { variant, reservedQuantity: 0n, availableQuantity: null };
  }
  const reservedQuantity = await activeReservedQuantityForVariant(
    transaction,
    variantId,
    now,
  );
  return {
    variant,
    reservedQuantity,
    availableQuantity: variant.onHandQuantity - reservedQuantity,
  };
}

export async function adjustProductInventory({
  variantId,
  entryType,
  quantity,
  reason,
  internalNote,
  actorId,
  expectedVersion,
  referenceKey,
}: {
  variantId: string;
  entryType: ProductInventoryEntryType;
  quantity: string | number | bigint;
  reason: string;
  internalNote?: string | null;
  actorId: string;
  expectedVersion: number;
  referenceKey?: string | null;
}) {
  const parsedQuantity = parsePositiveQuantity(quantity);
  const safeReason = reason.trim().slice(0, 240);
  if (!safeReason) {
    throw new ProductMarketplaceValidationError("Provide a safe reason.");
  }

  return prisma.$transaction(async (transaction) => {
    if (referenceKey) {
      const existing = await transaction.productInventoryLedgerEntry.findUnique(
        {
          where: { referenceKey },
          select: {
            id: true,
            variantId: true,
            quantity: true,
            resultingOnHandQuantity: true,
            createdAt: true,
          },
        },
      );
      if (existing) {
        return { ...existing, idempotent: true };
      }
    }

    const variant = await transaction.productVariant.findUnique({
      where: { id: variantId },
      select: {
        id: true,
        stockMode: true,
        onHandQuantity: true,
        concurrencyVersion: true,
      },
    });
    if (!variant) {
      throw new ProductInventoryTransitionError("Product variant not found.");
    }
    if (variant.stockMode !== "TRACKED") {
      throw new ProductInventoryTransitionError(
        "Only tracked product variants use finite inventory adjustments.",
      );
    }
    if (variant.concurrencyVersion !== expectedVersion) {
      throw new ProductInventoryConflictError(
        "Inventory changed after this page loaded. Reload before adjusting stock.",
      );
    }

    const signedQuantity = entrySignedQuantity(entryType, parsedQuantity);
    const nextBalance = variant.onHandQuantity + signedQuantity;
    if (nextBalance < 0n) {
      throw new ProductInventoryTransitionError(
        "Stock cannot be adjusted below zero.",
      );
    }

    const updated = await transaction.productVariant.updateMany({
      where: {
        id: variantId,
        concurrencyVersion: expectedVersion,
      },
      data: {
        onHandQuantity: nextBalance,
        concurrencyVersion: { increment: 1 },
      },
    });
    if (updated.count !== 1) {
      throw new ProductInventoryConflictError(
        "Inventory changed before the adjustment could be saved.",
      );
    }

    const ledger = await transaction.productInventoryLedgerEntry.create({
      data: {
        id: stableId(),
        variantId,
        entryType,
        quantity: signedQuantity,
        resultingOnHandQuantity: nextBalance,
        reason: safeReason,
        internalNote: internalNote?.trim() || null,
        actorId,
        referenceKey: referenceKey || null,
      },
      select: {
        id: true,
        variantId: true,
        quantity: true,
        resultingOnHandQuantity: true,
        createdAt: true,
      },
    });

    await transaction.auditLog.create({
      data: {
        actorId,
        action: "products.inventory.adjusted",
        targetType: "ProductVariant",
        targetId: variantId,
        metadata: auditMetadata({
          entryType,
          quantity: parsedQuantity.toString(),
          resultingOnHandQuantity: nextBalance.toString(),
          hasReferenceKey: Boolean(referenceKey),
        }),
      },
    });

    return { ...ledger, idempotent: false };
  });
}
