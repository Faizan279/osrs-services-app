import { describe, expect, it } from "vitest";

import {
  calculateBossingEstimate,
  calculateBossingKillProgress,
} from "@/lib/bossing/estimate";

const method = {
  name: "Standard kill support",
  enabled: true,
  priceMode: "PER_KILL" as const,
  minimumKillCount: 5,
  maximumKillCount: 100,
  basePriceCentsPerKill: 100,
  fixedPackagePriceCents: 0,
  minimumPriceCents: 800,
  setupFeeCents: 200,
  suppliesEnabled: true,
  suppliesLabel: "Supply support",
  suppliesFeeCents: 300,
  customerGearRequired: true,
  customerGearLabel: "Customer-provided gear",
  gearAdjustmentCents: 500,
  estimatedKillsPerHour: 20,
};

const rule = {
  normalModeMultiplierBps: 0,
  ironmanMultiplierBps: 1000,
  hardcoreIronmanMultiplierBps: 2000,
  ultimateIronmanMultiplierBps: 3000,
  discordStreamEnabled: true,
  discordStreamPercentBps: 200,
  standardDeliveryEnabled: true,
  standardDeliveryLabel: "Standard",
  standardDeliveryDescription: null,
  standardDeliveryEstimate: "Reviewed before checkout",
  standardDeliveryMultiplierBps: 0,
  standardDeliveryFixedFeeCents: 0,
  priorityDeliveryEnabled: true,
  priorityDeliveryLabel: "Priority",
  priorityDeliveryDescription: null,
  priorityDeliveryEstimate: "Faster estimate",
  priorityDeliveryMultiplierBps: 1500,
  priorityDeliveryFixedFeeCents: 50,
  expressDeliveryEnabled: false,
  expressDeliveryLabel: "Express",
  expressDeliveryDescription: null,
  expressDeliveryEstimate: null,
  expressDeliveryMultiplierBps: 3000,
  expressDeliveryFixedFeeCents: 0,
};

describe("bossing kill-count and estimate engine", () => {
  it("calculates direct kill quantity with minimum price and setup fee", () => {
    const progress = calculateBossingKillProgress({
      mode: "DIRECT",
      killQuantity: 5,
    });
    const estimate = calculateBossingEstimate({
      progress,
      method,
      rule,
      gameMode: "NORMAL",
      customerGearConfirmed: true,
      includeSupplies: false,
      includeDiscordStream: false,
      deliverySpeed: "STANDARD",
    });

    expect(progress.requestedKills).toBe(5);
    expect(estimate.lineItems.map((item) => item.label)).toEqual([
      "Base bossing estimate",
      "Method setup fee",
    ]);
    expect(estimate.estimatedTotalCents).toBe(1_000);
  });

  it("calculates current KC to target KC with account, add-on and delivery adjustments", () => {
    const progress = calculateBossingKillProgress({
      mode: "TARGET_KC",
      currentKillCount: 10,
      targetKillCount: 35,
    });
    const estimate = calculateBossingEstimate({
      progress,
      method,
      rule,
      gameMode: "IRONMAN",
      customerGearConfirmed: false,
      includeSupplies: true,
      includeDiscordStream: true,
      deliverySpeed: "PRIORITY",
    });

    expect(progress.requestedKills).toBe(25);
    expect(estimate.lineItems.map((item) => item.label)).toEqual([
      "Base bossing estimate",
      "Method setup fee",
      "Ironman account adjustment",
      "Customer-provided gear",
      "Supply support",
      "Discord Stream add-on",
      "Priority delivery estimate",
    ]);
    expect(estimate.estimatedTotalCents).toBe(4_472);
    expect(estimate.estimatedHours).toBe(1.3);
  });

  it("rejects invalid kill-count inputs", () => {
    expect(() =>
      calculateBossingKillProgress({
        mode: "TARGET_KC",
        currentKillCount: 10,
        targetKillCount: 10,
      }),
    ).toThrow(/greater than current/);
    expect(() =>
      calculateBossingKillProgress({
        mode: "TARGET_KC",
        currentKillCount: 15,
        targetKillCount: 10,
      }),
    ).toThrow(/greater than current/);
    expect(() =>
      calculateBossingKillProgress({
        mode: "DIRECT",
        killQuantity: -1,
      }),
    ).toThrow(/greater than zero/);
    expect(() =>
      calculateBossingKillProgress({
        mode: "DIRECT",
        killQuantity: 1.5,
      }),
    ).toThrow(/whole number/);
    expect(() =>
      calculateBossingKillProgress({
        mode: "DIRECT",
        killQuantity: 1_000_001,
      }),
    ).toThrow(/too large/);
  });

  it("enforces method min and max ranges", () => {
    expect(() =>
      calculateBossingEstimate({
        progress: calculateBossingKillProgress({
          mode: "DIRECT",
          killQuantity: 4,
        }),
        method,
        rule,
        gameMode: "NORMAL",
        customerGearConfirmed: true,
        includeSupplies: false,
        includeDiscordStream: false,
        deliverySpeed: "STANDARD",
      }),
    ).toThrow(/at least 5/);
    expect(() =>
      calculateBossingEstimate({
        progress: calculateBossingKillProgress({
          mode: "DIRECT",
          killQuantity: 101,
        }),
        method,
        rule,
        gameMode: "NORMAL",
        customerGearConfirmed: true,
        includeSupplies: false,
        includeDiscordStream: false,
        deliverySpeed: "STANDARD",
      }),
    ).toThrow(/up to 100/);
  });

  it("supports fixed package pricing and rejects unavailable options", () => {
    const estimate = calculateBossingEstimate({
      progress: calculateBossingKillProgress({
        mode: "DIRECT",
        killQuantity: 10,
      }),
      method: {
        ...method,
        priceMode: "FIXED_PACKAGE",
        fixedPackagePriceCents: 2_000,
      },
      rule,
      gameMode: "NORMAL",
      customerGearConfirmed: true,
      includeSupplies: false,
      includeDiscordStream: false,
      deliverySpeed: "STANDARD",
    });
    expect(estimate.estimatedTotalCents).toBe(2_200);

    expect(() =>
      calculateBossingEstimate({
        progress: calculateBossingKillProgress({
          mode: "DIRECT",
          killQuantity: 10,
        }),
        method: { ...method, suppliesEnabled: false },
        rule,
        gameMode: "NORMAL",
        customerGearConfirmed: true,
        includeSupplies: true,
        includeDiscordStream: false,
        deliverySpeed: "STANDARD",
      }),
    ).toThrow(/Supplies/);
    expect(() =>
      calculateBossingEstimate({
        progress: calculateBossingKillProgress({
          mode: "DIRECT",
          killQuantity: 10,
        }),
        method,
        rule,
        gameMode: "NORMAL",
        customerGearConfirmed: true,
        includeSupplies: false,
        includeDiscordStream: false,
        deliverySpeed: "EXPRESS",
      }),
    ).toThrow(/not available/);
  });
});
