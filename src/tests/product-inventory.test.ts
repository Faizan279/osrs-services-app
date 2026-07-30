import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  ledgerFindUnique: vi.fn(),
  ledgerCreate: vi.fn(),
  variantFindUnique: vi.fn(),
  variantUpdateMany: vi.fn(),
  reservationAggregate: vi.fn(),
  reservationFindUnique: vi.fn(),
  reservationFindMany: vi.fn(),
  reservationCreate: vi.fn(),
  reservationUpdateMany: vi.fn(),
  reservationEventCreate: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    productInventoryReservation: {
      findMany: mocks.reservationFindMany,
    },
  },
}));

let adjustProductInventory: typeof import("@/lib/products/inventory").adjustProductInventory;
let createProductInventoryReservation: typeof import("@/lib/products/reservations").createProductInventoryReservation;
let releaseProductInventoryReservation: typeof import("@/lib/products/reservations").releaseProductInventoryReservation;
let expireProductInventoryReservations: typeof import("@/lib/products/reservations").expireProductInventoryReservations;

type Reservation = {
  id: string;
  stableKey: string;
  variantId: string;
  quantity: bigint;
  status: "ACTIVE" | "RELEASED" | "EXPIRED" | "CANCELLED";
  expiresAt: Date;
  releasedAt: Date | null;
  safeInternalPurpose: string;
  actorId: string | null;
  idempotencyKey: string | null;
  futureExternalRef: string | null;
  concurrencyVersion: number;
};

let state: {
  variant: {
    id: string;
    stockMode: "TRACKED" | "UNLIMITED" | "MANUAL_REVIEW";
    status: "AVAILABLE" | "PAUSED" | "UNAVAILABLE";
    enabled: boolean;
    availabilityState:
      | "AVAILABLE"
      | "LOW_STOCK"
      | "OUT_OF_STOCK"
      | "MANUAL_REVIEW_REQUIRED"
      | "PAUSED"
      | "UNAVAILABLE";
    onHandQuantity: bigint;
    lowStockThreshold: bigint;
    concurrencyVersion: number;
  };
  ledger: Array<{
    id: string;
    referenceKey: string | null;
    quantity: bigint;
    resultingOnHandQuantity: bigint;
  }>;
  reservations: Reservation[];
  events: unknown[];
  audits: unknown[];
};

const now = new Date("2026-07-30T15:00:00.000Z");
const variantId = "variant1";

function transactionClient() {
  return {
    productInventoryLedgerEntry: {
      findUnique: mocks.ledgerFindUnique,
      create: mocks.ledgerCreate,
    },
    productVariant: {
      findUnique: mocks.variantFindUnique,
      updateMany: mocks.variantUpdateMany,
    },
    productInventoryReservation: {
      aggregate: mocks.reservationAggregate,
      findUnique: mocks.reservationFindUnique,
      findMany: mocks.reservationFindMany,
      create: mocks.reservationCreate,
      updateMany: mocks.reservationUpdateMany,
    },
    productReservationEvent: { create: mocks.reservationEventCreate },
    auditLog: { create: mocks.auditLogCreate },
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  state = {
    variant: {
      id: variantId,
      stockMode: "TRACKED",
      status: "AVAILABLE",
      enabled: true,
      availabilityState: "AVAILABLE",
      onHandQuantity: 10n,
      lowStockThreshold: 2n,
      concurrencyVersion: 1,
    },
    ledger: [],
    reservations: [],
    events: [],
    audits: [],
  };
  mocks.transaction.mockImplementation((callback) =>
    callback(transactionClient()),
  );
  mocks.ledgerFindUnique.mockImplementation(({ where }) =>
    Promise.resolve(
      state.ledger.find((entry) => entry.referenceKey === where.referenceKey) ??
        null,
    ),
  );
  mocks.ledgerCreate.mockImplementation(({ data }) => {
    const ledger = { id: `ledger${state.ledger.length + 1}`, ...data };
    state.ledger.push(ledger);
    return Promise.resolve(ledger);
  });
  mocks.variantFindUnique.mockResolvedValue(state.variant);
  mocks.variantUpdateMany.mockImplementation(({ where, data }) => {
    if (
      where.id !== variantId ||
      where.concurrencyVersion !== state.variant.concurrencyVersion
    ) {
      return Promise.resolve({ count: 0 });
    }
    if (data.onHandQuantity !== undefined) {
      state.variant.onHandQuantity = data.onHandQuantity;
    }
    state.variant.concurrencyVersion += data.concurrencyVersion?.increment ?? 0;
    return Promise.resolve({ count: 1 });
  });
  mocks.reservationAggregate.mockImplementation(({ where }) => {
    const total = state.reservations
      .filter(
        (reservation) =>
          reservation.variantId === where.variantId &&
          reservation.status === where.status &&
          reservation.expiresAt > where.expiresAt.gt,
      )
      .reduce((sum, reservation) => sum + reservation.quantity, 0n);
    return Promise.resolve({ _sum: { quantity: total } });
  });
  mocks.reservationFindUnique.mockImplementation(({ where }) => {
    if (where.idempotencyKey) {
      return Promise.resolve(
        state.reservations.find(
          (reservation) => reservation.idempotencyKey === where.idempotencyKey,
        ) ?? null,
      );
    }
    if (where.id) {
      return Promise.resolve(
        state.reservations.find((reservation) => reservation.id === where.id) ??
          null,
      );
    }
    return Promise.resolve(null);
  });
  mocks.reservationCreate.mockImplementation(({ data }) => {
    const reservation: Reservation = {
      releasedAt: null,
      concurrencyVersion: 1,
      status: "ACTIVE",
      futureExternalRef: null,
      actorId: null,
      idempotencyKey: null,
      ...data,
    };
    state.reservations.push(reservation);
    return Promise.resolve(reservation);
  });
  mocks.reservationUpdateMany.mockImplementation(({ where, data }) => {
    const reservation = state.reservations.find(
      (item) =>
        item.id === where.id &&
        (!where.status || item.status === where.status) &&
        (!where.concurrencyVersion ||
          item.concurrencyVersion === where.concurrencyVersion),
    );
    if (!reservation) return Promise.resolve({ count: 0 });
    reservation.status = data.status;
    reservation.releasedAt = data.releasedAt ?? reservation.releasedAt;
    reservation.concurrencyVersion += data.concurrencyVersion?.increment ?? 0;
    return Promise.resolve({ count: 1 });
  });
  mocks.reservationFindMany.mockImplementation(({ where }) =>
    Promise.resolve(
      state.reservations.filter(
        (reservation) =>
          reservation.status === where.status &&
          reservation.expiresAt <= where.expiresAt.lte,
      ),
    ),
  );
  mocks.reservationEventCreate.mockImplementation(({ data }) => {
    state.events.push(data);
    return Promise.resolve(data);
  });
  mocks.auditLogCreate.mockImplementation(({ data }) => {
    state.audits.push(data);
    return Promise.resolve(data);
  });
});

beforeAll(async () => {
  ({ adjustProductInventory } = await import("@/lib/products/inventory"));
  ({
    createProductInventoryReservation,
    releaseProductInventoryReservation,
    expireProductInventoryReservations,
  } = await import("@/lib/products/reservations"));
});

describe("product inventory ledger and reservations", () => {
  it("appends stock adjustments atomically and prevents negative stock", async () => {
    await adjustProductInventory({
      variantId,
      entryType: "STOCK_IN",
      quantity: "5",
      reason: "Reviewed stock increase",
      actorId: "user1",
      expectedVersion: 1,
    });
    expect(state.variant.onHandQuantity).toBe(15n);
    expect(state.ledger).toHaveLength(1);
    expect(state.ledger[0]?.resultingOnHandQuantity).toBe(15n);

    await expect(
      adjustProductInventory({
        variantId,
        entryType: "STOCK_OUT",
        quantity: "50",
        reason: "Reviewed stock decrease",
        actorId: "user1",
        expectedVersion: 2,
      }),
    ).rejects.toThrow(/below zero/);
    expect(state.ledger).toHaveLength(1);
  });

  it("uses idempotency keys without duplicating ledger entries", async () => {
    state.ledger.push({
      id: "existingledger",
      referenceKey: "safe-ref",
      quantity: 5n,
      resultingOnHandQuantity: 15n,
    });
    const result = await adjustProductInventory({
      variantId,
      entryType: "STOCK_IN",
      quantity: "5",
      reason: "Reviewed stock increase",
      actorId: "user1",
      expectedVersion: 1,
      referenceKey: "safe-ref",
    });
    expect(result).toEqual(
      expect.objectContaining({ id: "existingledger", idempotent: true }),
    );
    expect(state.variant.onHandQuantity).toBe(10n);
    expect(state.ledger).toHaveLength(1);
  });

  it("creates and releases reservations without changing physical stock", async () => {
    const created = await createProductInventoryReservation({
      variantId,
      quantity: "4",
      expiresAt: new Date("2026-07-30T16:00:00.000Z"),
      safeInternalPurpose: "Internal checkout foundation test",
      actorId: "user1",
      idempotencyKey: "reserve-safe-key",
      expectedVariantVersion: 1,
      now,
    });
    expect(created.reservation?.quantity).toBe(4n);
    expect(state.variant.onHandQuantity).toBe(10n);
    expect(state.variant.concurrencyVersion).toBe(2);
    expect(state.events).toHaveLength(1);

    await expect(
      createProductInventoryReservation({
        variantId,
        quantity: "7",
        expiresAt: new Date("2026-07-30T16:00:00.000Z"),
        safeInternalPurpose: "Over reserve",
        actorId: "user1",
        expectedVariantVersion: 2,
        now,
      }),
    ).rejects.toThrow(/exceeds/);

    const duplicate = await createProductInventoryReservation({
      variantId,
      quantity: "4",
      expiresAt: new Date("2026-07-30T16:00:00.000Z"),
      safeInternalPurpose: "Internal checkout foundation test",
      actorId: "user1",
      idempotencyKey: "reserve-safe-key",
      expectedVariantVersion: 2,
      now,
    });
    expect(duplicate.idempotent).toBe(true);
    expect(state.reservations).toHaveLength(1);

    await releaseProductInventoryReservation({
      reservationId: state.reservations[0]!.id,
      actorId: "user1",
      expectedVersion: 1,
      now,
    });
    expect(state.reservations[0]?.status).toBe("RELEASED");

    const repeat = await releaseProductInventoryReservation({
      reservationId: state.reservations[0]!.id,
      actorId: "user1",
      expectedVersion: 1,
      now,
    });
    expect(repeat.idempotent).toBe(true);
  });

  it("expires stale reservations and handles unlimited/manual review variants safely", async () => {
    state.reservations.push({
      id: "expired1",
      stableKey: "expired",
      variantId,
      quantity: 2n,
      status: "ACTIVE",
      expiresAt: new Date("2026-07-30T14:00:00.000Z"),
      releasedAt: null,
      safeInternalPurpose: "Stale hold",
      actorId: "user1",
      idempotencyKey: null,
      futureExternalRef: null,
      concurrencyVersion: 1,
    });
    expect(
      await expireProductInventoryReservations({ actorId: "user1", now }),
    ).toBe(1);
    expect(state.reservations[0]?.status).toBe("EXPIRED");

    state.variant.stockMode = "UNLIMITED";
    const unlimited = await createProductInventoryReservation({
      variantId,
      quantity: "1000",
      expiresAt: new Date("2026-07-30T16:00:00.000Z"),
      safeInternalPurpose: "Unlimited handling",
      actorId: "user1",
      expectedVariantVersion: state.variant.concurrencyVersion,
      now,
    });
    expect(unlimited.unlimited).toBe(true);
    expect(unlimited.reservation).toBeNull();

    state.variant.stockMode = "MANUAL_REVIEW";
    state.variant.availabilityState = "MANUAL_REVIEW_REQUIRED";
    await expect(
      createProductInventoryReservation({
        variantId,
        quantity: "1",
        expiresAt: new Date("2026-07-30T16:00:00.000Z"),
        safeInternalPurpose: "Manual review handling",
        actorId: "user1",
        expectedVariantVersion: state.variant.concurrencyVersion,
        now,
      }),
    ).rejects.toThrow(/Manual-review/);
  });
});
