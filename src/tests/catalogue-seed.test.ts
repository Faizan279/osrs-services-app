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
    offerings: new Map<string, { id: string; name: string }>(),
    offeringFacets: new Set<string>(),
    offeringModes: new Set<string>(),
    offeringRequirements: new Set<string>(),
    skillingRules: new Map<
      string,
      {
        standardDeliveryEnabled: boolean;
        priorityDeliveryEnabled: boolean;
        expressDeliveryEnabled: boolean;
      }
    >(),
    skillingSkills: new Map<string, { id: string; name: string }>(),
    skillingMethods: new Map<string, { id: string; name: string }>(),
    bossingRules: new Map<
      string,
      {
        standardDeliveryEnabled: boolean;
        priorityDeliveryEnabled: boolean;
        expressDeliveryEnabled: boolean;
      }
    >(),
    bossingBosses: new Map<string, { id: string; name: string }>(),
    bossingMethods: new Map<string, { id: string; name: string }>(),
    bossingStatRequirements: new Set<string>(),
    bossingGearRequirements: new Set<string>(),
    categoryUpdates: [] as unknown[],
    serviceUpdates: [] as unknown[],
    skillingSkillUpdates: [] as unknown[],
    skillingMethodUpdates: [] as unknown[],
    skillingRuleUpdates: [] as unknown[],
    bossingBossUpdates: [] as unknown[],
    bossingMethodUpdates: [] as unknown[],
    bossingRuleUpdates: [] as unknown[],
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
    catalogueOffering: {
      async upsert(args: {
        where: { seededKey: string };
        create: { name: string };
      }) {
        const existing = state.offerings.get(args.where.seededKey);
        if (existing) return { id: existing.id };
        const record = {
          id: `offering:${args.where.seededKey}`,
          name: args.create.name,
        };
        state.offerings.set(args.where.seededKey, record);
        return { id: record.id };
      },
    },
    catalogueOfferingFacet: {
      async createMany(args: {
        data: Array<{
          offeringId: string;
          facetKey: string;
          facetValue: string;
        }>;
      }) {
        args.data.forEach((item) =>
          state.offeringFacets.add(
            `${item.offeringId}:${item.facetKey}:${item.facetValue}`,
          ),
        );
        return { count: args.data.length };
      },
    },
    catalogueOfferingGameMode: {
      async createMany(args: {
        data: Array<{ offeringId: string; gameMode: string }>;
      }) {
        args.data.forEach((item) =>
          state.offeringModes.add(`${item.offeringId}:${item.gameMode}`),
        );
        return { count: args.data.length };
      },
    },
    catalogueOfferingRequirement: {
      async createMany(args: { data: Array<{ seededKey: string }> }) {
        args.data.forEach((item) =>
          state.offeringRequirements.add(item.seededKey),
        );
        return { count: args.data.length };
      },
    },
    skillingCalculatorRule: {
      async upsert(args: {
        where: { serviceId: string };
        create: {
          serviceId: string;
          standardDeliveryEnabled: boolean;
          priorityDeliveryEnabled: boolean;
          expressDeliveryEnabled: boolean;
        };
        update: unknown;
      }) {
        state.skillingRuleUpdates.push(args.update);
        const key = args.where.serviceId || args.create.serviceId;
        if (state.skillingRules.has(key)) return {};
        state.skillingRules.set(key, {
          standardDeliveryEnabled: args.create.standardDeliveryEnabled,
          priorityDeliveryEnabled: args.create.priorityDeliveryEnabled,
          expressDeliveryEnabled: args.create.expressDeliveryEnabled,
        });
        return {};
      },
    },
    skillingSkillConfig: {
      async upsert(args: {
        where: { seededKey: string };
        create: { name: string };
        update: unknown;
      }) {
        state.skillingSkillUpdates.push(args.update);
        const existing = state.skillingSkills.get(args.where.seededKey);
        if (existing) return { id: existing.id };
        const record = {
          id: `skill:${args.where.seededKey}`,
          name: args.create.name,
        };
        state.skillingSkills.set(args.where.seededKey, record);
        return { id: record.id };
      },
    },
    skillingTrainingMethod: {
      async upsert(args: {
        where: { seededKey: string };
        create: { name: string };
        update: unknown;
      }) {
        state.skillingMethodUpdates.push(args.update);
        const existing = state.skillingMethods.get(args.where.seededKey);
        if (existing) return { id: existing.id };
        const record = {
          id: `method:${args.where.seededKey}`,
          name: args.create.name,
        };
        state.skillingMethods.set(args.where.seededKey, record);
        return { id: record.id };
      },
    },
    bossingCalculatorRule: {
      async upsert(args: {
        where: { serviceId: string };
        create: {
          serviceId: string;
          standardDeliveryEnabled: boolean;
          priorityDeliveryEnabled: boolean;
          expressDeliveryEnabled: boolean;
        };
        update: unknown;
      }) {
        state.bossingRuleUpdates.push(args.update);
        const key = args.where.serviceId || args.create.serviceId;
        if (state.bossingRules.has(key)) return {};
        state.bossingRules.set(key, {
          standardDeliveryEnabled: args.create.standardDeliveryEnabled,
          priorityDeliveryEnabled: args.create.priorityDeliveryEnabled,
          expressDeliveryEnabled: args.create.expressDeliveryEnabled,
        });
        return {};
      },
    },
    bossingBossConfig: {
      async upsert(args: {
        where: { seededKey: string };
        create: { name: string };
        update: unknown;
      }) {
        state.bossingBossUpdates.push(args.update);
        const existing = state.bossingBosses.get(args.where.seededKey);
        if (existing) return { id: existing.id };
        const record = {
          id: `boss:${args.where.seededKey}`,
          name: args.create.name,
        };
        state.bossingBosses.set(args.where.seededKey, record);
        return { id: record.id };
      },
    },
    bossingMethod: {
      async upsert(args: {
        where: { seededKey: string };
        create: { name: string };
        update: unknown;
      }) {
        state.bossingMethodUpdates.push(args.update);
        const existing = state.bossingMethods.get(args.where.seededKey);
        if (existing) return { id: existing.id };
        const record = {
          id: `bossing-method:${args.where.seededKey}`,
          name: args.create.name,
        };
        state.bossingMethods.set(args.where.seededKey, record);
        return { id: record.id };
      },
    },
    bossingStatRequirement: {
      async createMany(args: { data: Array<{ seededKey: string }> }) {
        args.data.forEach((item) =>
          state.bossingStatRequirements.add(item.seededKey),
        );
        return { count: args.data.length };
      },
    },
    bossingGearRequirement: {
      async createMany(args: { data: Array<{ seededKey: string }> }) {
        args.data.forEach((item) =>
          state.bossingGearRequirements.add(item.seededKey),
        );
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
    expect(state.services.size).toBe(6);
    expect(state.requirements.size).toBe(6);
    expect(state.offerings.size).toBe(8);
    expect(state.offeringRequirements.size).toBe(8);
    expect(state.skillingRules.size).toBe(1);
    expect(state.skillingRules.get("service:skill-training-request")).toEqual({
      standardDeliveryEnabled: true,
      priorityDeliveryEnabled: false,
      expressDeliveryEnabled: false,
    });
    expect(state.skillingSkills.size).toBe(23);
    expect(state.skillingMethods.size).toBe(4);
    expect(state.bossingRules.size).toBe(1);
    expect(state.bossingRules.get("service:pvm-support")).toEqual({
      standardDeliveryEnabled: true,
      priorityDeliveryEnabled: false,
      expressDeliveryEnabled: false,
    });
    expect(state.bossingBosses.size).toBe(3);
    expect(state.bossingMethods.size).toBe(3);
    expect(state.bossingStatRequirements.size).toBe(8);
    expect(state.bossingGearRequirements.size).toBe(6);
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
    state.skillingRules.set("service:skill-training-request", {
      standardDeliveryEnabled: false,
      priorityDeliveryEnabled: true,
      expressDeliveryEnabled: true,
    });
    state.bossingRules.set("service:pvm-support", {
      standardDeliveryEnabled: false,
      priorityDeliveryEnabled: true,
      expressDeliveryEnabled: true,
    });
    state.bossingMethods.get("pvm-support:giant-mole:standard-kills")!.name =
      "Client-edited Mole method";
    const counts = [
      state.categories.size,
      state.services.size,
      state.gameModes.size,
      state.requirements.size,
      state.offerings.size,
      state.offeringFacets.size,
      state.offeringRequirements.size,
      state.skillingSkills.size,
      state.skillingMethods.size,
      state.bossingBosses.size,
      state.bossingMethods.size,
      state.bossingStatRequirements.size,
      state.bossingGearRequirements.size,
    ];
    await seedCatalogue(client);
    expect([
      state.categories.size,
      state.services.size,
      state.gameModes.size,
      state.requirements.size,
      state.offerings.size,
      state.offeringFacets.size,
      state.offeringRequirements.size,
      state.skillingSkills.size,
      state.skillingMethods.size,
      state.bossingBosses.size,
      state.bossingMethods.size,
      state.bossingStatRequirements.size,
      state.bossingGearRequirements.size,
    ]).toEqual(counts);
    expect(state.categories.get("quests")?.name).toBe("Client quest taxonomy");
    expect(state.services.get("quest-progression")?.name).toBe(
      "Client quest service",
    );
    expect(state.skillingRules.get("service:skill-training-request")).toEqual({
      standardDeliveryEnabled: false,
      priorityDeliveryEnabled: true,
      expressDeliveryEnabled: true,
    });
    expect(state.bossingRules.get("service:pvm-support")).toEqual({
      standardDeliveryEnabled: false,
      priorityDeliveryEnabled: true,
      expressDeliveryEnabled: true,
    });
    expect(
      state.bossingMethods.get("pvm-support:giant-mole:standard-kills")?.name,
    ).toBe("Client-edited Mole method");
    expect(
      state.categoryUpdates.every((value) => JSON.stringify(value) === "{}"),
    ).toBe(true);
    expect(
      state.serviceUpdates.every((value) => JSON.stringify(value) === "{}"),
    ).toBe(true);
    expect(
      state.skillingSkillUpdates.every(
        (value) => JSON.stringify(value) === "{}",
      ),
    ).toBe(true);
    expect(
      state.skillingMethodUpdates.every(
        (value) => JSON.stringify(value) === "{}",
      ),
    ).toBe(true);
    expect(
      state.skillingRuleUpdates.every(
        (value) => JSON.stringify(value) === "{}",
      ),
    ).toBe(true);
    expect(
      state.bossingBossUpdates.every((value) => JSON.stringify(value) === "{}"),
    ).toBe(true);
    expect(
      state.bossingMethodUpdates.every(
        (value) => JSON.stringify(value) === "{}",
      ),
    ).toBe(true);
    expect(
      state.bossingRuleUpdates.every((value) => JSON.stringify(value) === "{}"),
    ).toBe(true);
  });
});
