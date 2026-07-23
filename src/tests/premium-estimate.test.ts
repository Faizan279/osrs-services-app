import { describe, expect, it } from "vitest";

import {
  calculatePremiumEstimate,
  type PremiumEstimateOption,
  type PremiumEstimatePackage,
  type PremiumEstimateRule,
} from "@/lib/premium/estimate";

const premiumPackage: PremiumEstimatePackage = {
  name: "Standard Fire Cape run",
  enabled: true,
  basePriceCents: 10_000,
  minimumPriceCents: 12_000,
  setupFeeCents: 500,
  estimatedHours: 3,
  customerGearRequired: true,
  customerGearLabel: "Customer-provided gear",
  gearUnconfirmedAdjustmentCents: 1_500,
};

const rule: PremiumEstimateRule = {
  normalModeMultiplierBps: 0,
  ironmanMultiplierBps: 1_000,
  hardcoreIronmanMultiplierBps: 2_000,
  ultimateIronmanMultiplierBps: 3_000,
  discordStreamEnabled: true,
  discordStreamPercentBps: 200,
  standardDeliveryEnabled: true,
  standardDeliveryLabel: "Standard",
  standardDeliveryDescription: null,
  standardDeliveryEstimate: "Confirmed before checkout",
  standardDeliveryMultiplierBps: 0,
  standardDeliveryFixedFeeCents: 0,
  priorityDeliveryEnabled: true,
  priorityDeliveryLabel: "Priority",
  priorityDeliveryDescription: null,
  priorityDeliveryEstimate: "Faster estimate",
  priorityDeliveryMultiplierBps: 1_500,
  priorityDeliveryFixedFeeCents: 250,
  expressDeliveryEnabled: false,
  expressDeliveryLabel: "Express",
  expressDeliveryDescription: null,
  expressDeliveryEstimate: null,
  expressDeliveryMultiplierBps: 3_000,
  expressDeliveryFixedFeeCents: 0,
};

const options: PremiumEstimateOption[] = [
  {
    slug: "supply-support",
    name: "Supply support",
    enabled: true,
    optionType: "SUPPLIES",
    pricingMode: "FIXED_FEE",
    fixedPriceCents: 1_000,
    percentBps: 0,
    perUnitPriceCents: 0,
    minimumQuantity: 1,
    maximumQuantity: 1,
    defaultQuantity: 1,
  },
  {
    slug: "gear-gap-review",
    name: "Gear gap support review",
    enabled: true,
    optionType: "GEAR_SUPPORT",
    pricingMode: "PERCENT_OF_BASE",
    fixedPriceCents: 0,
    percentBps: 500,
    perUnitPriceCents: 0,
    minimumQuantity: 1,
    maximumQuantity: 1,
    defaultQuantity: 1,
  },
  {
    slug: "extra-attempt-window",
    name: "Extra attempt window",
    enabled: true,
    optionType: "ADDON",
    pricingMode: "PER_UNIT",
    fixedPriceCents: 0,
    percentBps: 0,
    perUnitPriceCents: 300,
    minimumQuantity: 1,
    maximumQuantity: 5,
    defaultQuantity: 1,
  },
];

describe("premium service estimate engine", () => {
  it("uses package minimums and setup fees for the base estimate", () => {
    const estimate = calculatePremiumEstimate({
      package: premiumPackage,
      rule,
      availableOptions: options,
      selectedOptions: [],
      gameMode: "NORMAL",
      customerGearConfirmed: true,
      includeDiscordStream: false,
      deliverySpeed: "STANDARD",
    });

    expect(estimate.lineItems.map((item) => item.label)).toEqual([
      "Base premium package",
      "Package setup fee",
    ]);
    expect(estimate.estimatedTotalCents).toBe(12_500);
    expect(estimate.estimatedTotal).toBe("$125.00");
    expect(estimate.finalPriceNote).toBe(
      "Final price is confirmed before checkout.",
    );
  });

  it("applies account, gear, option, Discord Stream and delivery adjustments", () => {
    const estimate = calculatePremiumEstimate({
      package: premiumPackage,
      rule,
      availableOptions: options,
      selectedOptions: [
        { slug: "supply-support" },
        { slug: "gear-gap-review" },
        { slug: "extra-attempt-window", quantity: 3 },
      ],
      gameMode: "IRONMAN",
      customerGearConfirmed: false,
      includeDiscordStream: true,
      deliverySpeed: "PRIORITY",
    });

    expect(estimate.lineItems.map((item) => item.label)).toEqual([
      "Base premium package",
      "Package setup fee",
      "Ironman account adjustment",
      "Customer-provided gear",
      "Supply support",
      "Gear gap support review",
      "Extra attempt window x 3",
      "Discord Stream add-on",
      "Priority delivery estimate",
    ]);
    expect(estimate.estimatedTotalCents).toBe(21_320);
    expect(estimate.estimatedHours).toBe(3);
  });

  it("rejects disabled packages, disabled options and unavailable delivery", () => {
    expect(() =>
      calculatePremiumEstimate({
        package: { ...premiumPackage, enabled: false },
        rule,
        availableOptions: options,
        selectedOptions: [],
        gameMode: "NORMAL",
        customerGearConfirmed: true,
        includeDiscordStream: false,
        deliverySpeed: "STANDARD",
      }),
    ).toThrow(/package is unavailable/i);

    expect(() =>
      calculatePremiumEstimate({
        package: premiumPackage,
        rule,
        availableOptions: [{ ...options[0]!, enabled: false }],
        selectedOptions: [{ slug: "supply-support" }],
        gameMode: "NORMAL",
        customerGearConfirmed: true,
        includeDiscordStream: false,
        deliverySpeed: "STANDARD",
      }),
    ).toThrow(/available premium option/i);

    expect(() =>
      calculatePremiumEstimate({
        package: premiumPackage,
        rule,
        availableOptions: options,
        selectedOptions: [],
        gameMode: "NORMAL",
        customerGearConfirmed: true,
        includeDiscordStream: false,
        deliverySpeed: "EXPRESS",
      }),
    ).toThrow(/not available/i);
  });

  it("validates quantities and duplicate option selections", () => {
    expect(() =>
      calculatePremiumEstimate({
        package: premiumPackage,
        rule,
        availableOptions: options,
        selectedOptions: [{ slug: "extra-attempt-window", quantity: 6 }],
        gameMode: "NORMAL",
        customerGearConfirmed: true,
        includeDiscordStream: false,
        deliverySpeed: "STANDARD",
      }),
    ).toThrow(/between 1 and 5/i);

    expect(() =>
      calculatePremiumEstimate({
        package: premiumPackage,
        rule,
        availableOptions: options,
        selectedOptions: [
          { slug: "supply-support" },
          { slug: "supply-support" },
        ],
        gameMode: "NORMAL",
        customerGearConfirmed: true,
        includeDiscordStream: false,
        deliverySpeed: "STANDARD",
      }),
    ).toThrow(/each option only once/i);
  });
});
