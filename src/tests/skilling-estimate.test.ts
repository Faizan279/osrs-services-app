import { describe, expect, it } from "vitest";

import { calculateSkillingEstimate } from "@/lib/skilling/estimate";
import { calculateLevelProgress, calculateXpProgress } from "@/lib/skilling/xp";

const method = {
  name: "Rooftop course route",
  enabled: true,
  minimumLevel: 1,
  maximumLevel: 99,
  xpPerHour: 50_000,
  basePriceCentsPerMillionXp: 10_000,
  minimumPriceCents: 500,
  fixedFeeCents: 100,
  suppliesEnabled: true,
  suppliesLabel: "Supply support",
  suppliesFeeCents: 250,
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

describe("skilling estimate engine", () => {
  it("calculates level-mode estimates with minimum price", () => {
    const estimate = calculateSkillingEstimate({
      progress: calculateLevelProgress({ currentLevel: 1, targetLevel: 2 }),
      method,
      rule,
      gameMode: "NORMAL",
      includeSupplies: false,
      includeDiscordStream: false,
      deliverySpeed: "STANDARD",
    });

    expect(estimate.xpRequired).toBe(83);
    expect(estimate.estimatedTotalCents).toBe(500);
    expect(estimate.estimatedTotal).toBe("$5.00");
  });

  it("calculates XP-mode estimates with account, add-on and delivery adjustments", () => {
    const estimate = calculateSkillingEstimate({
      progress: calculateXpProgress({ currentXp: 0, targetXp: 1_000_000 }),
      method,
      rule,
      gameMode: "IRONMAN",
      includeSupplies: true,
      includeDiscordStream: true,
      deliverySpeed: "PRIORITY",
    });

    expect(estimate.lineItems.map((item) => item.label)).toEqual([
      "Base skilling estimate",
      "Ironman account adjustment",
      "Supply support",
      "Discord Stream add-on",
      "Priority delivery estimate",
    ]);
    expect(estimate.estimatedTotalCents).toBe(13_375);
    expect(estimate.estimatedHours).toBe(20);
  });

  it("rejects unavailable options and invalid method ranges", () => {
    expect(() =>
      calculateSkillingEstimate({
        progress: calculateLevelProgress({ currentLevel: 1, targetLevel: 10 }),
        method: { ...method, enabled: false },
        rule,
        gameMode: "NORMAL",
        includeSupplies: false,
        includeDiscordStream: false,
        deliverySpeed: "STANDARD",
      }),
    ).toThrow(/unavailable/);

    expect(() =>
      calculateSkillingEstimate({
        progress: calculateLevelProgress({ currentLevel: 1, targetLevel: 10 }),
        method: { ...method, minimumLevel: 20 },
        rule,
        gameMode: "NORMAL",
        includeSupplies: false,
        includeDiscordStream: false,
        deliverySpeed: "STANDARD",
      }),
    ).toThrow(/starts at level 20/);

    expect(() =>
      calculateSkillingEstimate({
        progress: calculateLevelProgress({ currentLevel: 1, targetLevel: 10 }),
        method: { ...method, suppliesEnabled: false },
        rule,
        gameMode: "NORMAL",
        includeSupplies: true,
        includeDiscordStream: false,
        deliverySpeed: "STANDARD",
      }),
    ).toThrow(/Supplies/);

    expect(() =>
      calculateSkillingEstimate({
        progress: calculateLevelProgress({ currentLevel: 1, targetLevel: 10 }),
        method,
        rule,
        gameMode: "NORMAL",
        includeSupplies: false,
        includeDiscordStream: false,
        deliverySpeed: "EXPRESS",
      }),
    ).toThrow(/not available/);
  });
});
