import { describe, expect, it } from "vitest";

import {
  catalogueCategorySeeds,
  seedCatalogue,
  type CatalogueSeedClient,
} from "../../prisma/catalogue-seed";

function createFakeClient() {
  const state = {
    categories: new Map<string, { id: string; name: string }>(),
    services: new Map<
      string,
      {
        id: string;
        name: string;
        availabilityState: string;
        isQuoteOnly: boolean;
      }
    >(),
    gameModes: new Set<string>(),
    requirements: new Set<string>(),
    categoryUpdates: [] as unknown[],
    serviceUpdates: [] as unknown[],
  };
  const client = {
    catalogueCategory: {
      async upsert(args: {
        where: { seededKey: string };
        create: { name: string };
        update: unknown;
      }) {
        state.categoryUpdates.push(args.update);
        const existing = state.categories.get(args.where.seededKey);
        if (existing) return { id: existing.id };
        const record = {
          id: `category:${args.where.seededKey}`,
          name: args.create.name,
        };
        state.categories.set(args.where.seededKey, record);
        return { id: record.id };
      },
    },
    catalogueService: {
      async upsert(args: {
        where: { seededKey: string };
        create: {
          name: string;
          availabilityState: string;
          isQuoteOnly: boolean;
        };
        update: unknown;
      }) {
        state.serviceUpdates.push(args.update);
        const existing = state.services.get(args.where.seededKey);
        if (existing) return { id: existing.id };
        const record = {
          id: `service:${args.where.seededKey}`,
          name: args.create.name,
          availabilityState: args.create.availabilityState,
          isQuoteOnly: args.create.isQuoteOnly,
        };
        state.services.set(args.where.seededKey, record);
        return { id: record.id };
      },
    },
    catalogueServiceGameMode: {
      async createMany(args: {
        data: { serviceId: string; gameMode: string }[];
      }) {
        args.data.forEach((item) =>
          state.gameModes.add(`${item.serviceId}:${item.gameMode}`),
        );
        return { count: args.data.length };
      },
    },
    catalogueRequirement: {
      async createMany(args: { data: { seededKey: string }[] }) {
        args.data.forEach((item) => state.requirements.add(item.seededKey));
        return { count: args.data.length };
      },
    },
  } as unknown as CatalogueSeedClient;
  return { client, state };
}

describe("catalogue seed", () => {
  it("creates the normalized catalogue taxonomy", async () => {
    const { client, state } = createFakeClient();
    await seedCatalogue(client);
    expect(state.categories.size).toBe(catalogueCategorySeeds.length);
    expect(state.services.size).toBe(4);
    expect(state.requirements.size).toBe(4);
    expect(
      [...state.services.values()].every(
        (service) =>
          service.availabilityState === "AVAILABLE" && service.isQuoteOnly,
      ),
    ).toBe(true);
  });

  it("is additive and preserves admin-edited seeded records on rerun", async () => {
    const { client, state } = createFakeClient();
    await seedCatalogue(client);
    state.categories.get("quests")!.name = "Client quest taxonomy";
    state.services.get("quest-progression")!.name = "Client quest service";
    const counts = [
      state.categories.size,
      state.services.size,
      state.gameModes.size,
      state.requirements.size,
    ];
    await seedCatalogue(client);
    expect([
      state.categories.size,
      state.services.size,
      state.gameModes.size,
      state.requirements.size,
    ]).toEqual(counts);
    expect(state.categories.get("quests")?.name).toBe("Client quest taxonomy");
    expect(state.services.get("quest-progression")?.name).toBe(
      "Client quest service",
    );
    expect(
      state.categoryUpdates.every((value) => JSON.stringify(value) === "{}"),
    ).toBe(true);
    expect(
      state.serviceUpdates.every((value) => JSON.stringify(value) === "{}"),
    ).toBe(true);
  });
});
