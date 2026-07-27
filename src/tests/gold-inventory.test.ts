import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  goldInventoryLedgerEntryFindUnique: vi.fn(),
  goldInventoryLedgerEntryCreate: vi.fn(),
  goldMarketUpdateMany: vi.fn(),
  goldMarketFindUniqueOrThrow: vi.fn(),
  auditLogCreate: vi.fn(),
}));

vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
  },
}));

let adjustGoldInventory: typeof import("@/lib/gold/admin").adjustGoldInventory;
let state: {
  stockQuantityGp: bigint;
  buyingCapacityGp: bigint;
  stockVersion: number;
  ledger: Array<{ id: string; referenceKey: string | null }>;
  audits: unknown[];
};

const marketId = "goldmarket1";

function transactionClient() {
  return {
    goldInventoryLedgerEntry: {
      findUnique: mocks.goldInventoryLedgerEntryFindUnique,
      create: mocks.goldInventoryLedgerEntryCreate,
    },
    goldMarket: {
      updateMany: mocks.goldMarketUpdateMany,
      findUniqueOrThrow: mocks.goldMarketFindUniqueOrThrow,
    },
    auditLog: { create: mocks.auditLogCreate },
  };
}

function input(
  entryType:
    | "STOCK_INCREASE"
    | "STOCK_DECREASE"
    | "BUY_CAPACITY_INCREASE"
    | "BUY_CAPACITY_DECREASE"
    | "CORRECTION",
  quantity: bigint,
  referenceKey: string | null = null,
) {
  return {
    marketId,
    entryType,
    quantity,
    reason: "Reviewed manual adjustment",
    internalNote: null,
    referenceKey,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  state = {
    stockQuantityGp: 100_000_000n,
    buyingCapacityGp: 80_000_000n,
    stockVersion: 1,
    ledger: [],
    audits: [],
  };
  mocks.transaction.mockImplementation((callback) =>
    callback(transactionClient()),
  );
  mocks.goldInventoryLedgerEntryFindUnique.mockImplementation(({ where }) =>
    Promise.resolve(
      state.ledger.find((entry) => entry.referenceKey === where.referenceKey) ??
        null,
    ),
  );
  mocks.goldMarketUpdateMany.mockImplementation(({ where, data }) => {
    if (where.id !== marketId || where.stockVersion !== state.stockVersion) {
      return Promise.resolve({ count: 0 });
    }
    if (
      where.stockQuantityGp?.gte != null &&
      state.stockQuantityGp < where.stockQuantityGp.gte
    ) {
      return Promise.resolve({ count: 0 });
    }
    if (
      where.buyingCapacityGp?.gte != null &&
      state.buyingCapacityGp < where.buyingCapacityGp.gte
    ) {
      return Promise.resolve({ count: 0 });
    }
    if (data.stockQuantityGp?.increment) {
      state.stockQuantityGp += data.stockQuantityGp.increment;
    }
    if (data.stockQuantityGp?.decrement) {
      state.stockQuantityGp -= data.stockQuantityGp.decrement;
    }
    if (data.buyingCapacityGp?.increment) {
      state.buyingCapacityGp += data.buyingCapacityGp.increment;
    }
    if (data.buyingCapacityGp?.decrement) {
      state.buyingCapacityGp -= data.buyingCapacityGp.decrement;
    }
    state.stockVersion += data.stockVersion?.increment ?? 0;
    return Promise.resolve({ count: 1 });
  });
  mocks.goldMarketFindUniqueOrThrow.mockImplementation(() =>
    Promise.resolve({
      id: marketId,
      stockQuantityGp: state.stockQuantityGp,
      buyingCapacityGp: state.buyingCapacityGp,
    }),
  );
  mocks.goldInventoryLedgerEntryCreate.mockImplementation(({ data }) => {
    const ledger = {
      id: `ledger${state.ledger.length + 1}`,
      ...data,
    };
    state.ledger.push(ledger);
    return Promise.resolve(ledger);
  });
  mocks.auditLogCreate.mockImplementation(({ data }) => {
    state.audits.push(data);
    return Promise.resolve(data);
  });
});

beforeAll(async () => {
  ({ adjustGoldInventory } = await import("@/lib/gold/admin"));
});

describe("gold inventory adjustments", () => {
  it("records stock increases and decreases atomically", async () => {
    await adjustGoldInventory({
      input: input("STOCK_INCREASE", 10_000_000n),
      actorId: "user1",
      expectedStockVersion: 1,
    });
    expect(state.stockQuantityGp).toBe(110_000_000n);
    expect(state.ledger).toHaveLength(1);
    expect(state.audits[0]).toEqual(
      expect.objectContaining({ action: "gold.stock.increased" }),
    );

    await adjustGoldInventory({
      input: input("STOCK_DECREASE", 30_000_000n),
      actorId: "user1",
      expectedStockVersion: 2,
    });
    expect(state.stockQuantityGp).toBe(80_000_000n);
    expect(state.ledger).toHaveLength(2);
    expect(state.audits[1]).toEqual(
      expect.objectContaining({ action: "gold.stock.decreased" }),
    );
  });

  it("records buying-capacity increases and decreases separately", async () => {
    await adjustGoldInventory({
      input: input("BUY_CAPACITY_INCREASE", 20_000_000n),
      actorId: "user1",
      expectedStockVersion: 1,
    });
    expect(state.buyingCapacityGp).toBe(100_000_000n);

    await adjustGoldInventory({
      input: input("BUY_CAPACITY_DECREASE", 25_000_000n),
      actorId: "user1",
      expectedStockVersion: 2,
    });
    expect(state.buyingCapacityGp).toBe(75_000_000n);
    expect(state.stockQuantityGp).toBe(100_000_000n);
    expect(state.ledger).toHaveLength(2);
  });

  it("rejects insufficient balances and stale versions without ledger writes", async () => {
    await expect(
      adjustGoldInventory({
        input: input("STOCK_DECREASE", 101_000_000n),
        actorId: "user1",
        expectedStockVersion: 1,
      }),
    ).rejects.toThrow(/Inventory changed/);
    await expect(
      adjustGoldInventory({
        input: input("BUY_CAPACITY_DECREASE", 81_000_000n),
        actorId: "user1",
        expectedStockVersion: 1,
      }),
    ).rejects.toThrow(/Inventory changed/);
    await expect(
      adjustGoldInventory({
        input: input("STOCK_INCREASE", 1_000_000n),
        actorId: "user1",
        expectedStockVersion: 99,
      }),
    ).rejects.toThrow(/Inventory changed/);

    expect(state.ledger).toHaveLength(0);
    expect(mocks.auditLogCreate).not.toHaveBeenCalled();
  });

  it("returns an existing referenced ledger entry idempotently", async () => {
    state.ledger.push({ id: "existingledger", referenceKey: "safe-ref" });

    const result = await adjustGoldInventory({
      input: input("STOCK_INCREASE", 10_000_000n, "safe-ref"),
      actorId: "user1",
      expectedStockVersion: 1,
    });

    expect(result).toEqual({ id: "existingledger", referenceKey: "safe-ref" });
    expect(state.stockQuantityGp).toBe(100_000_000n);
    expect(mocks.goldMarketUpdateMany).not.toHaveBeenCalled();
    expect(state.ledger).toHaveLength(1);
  });
});
