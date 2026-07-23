import { catalogueGameModes, gameModeLabels } from "@/lib/catalogue/constants";
import {
  premiumDeliveryLabels,
  type PremiumDeliverySpeed,
  type PremiumOptionPricingMode,
  type PremiumOptionType,
} from "@/lib/premium/constants";

type CatalogueGameMode = (typeof catalogueGameModes)[number];

export class PremiumValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PremiumValidationError";
  }
}

export type PremiumEstimatePackage = {
  name: string;
  enabled: boolean;
  basePriceCents: number;
  minimumPriceCents: number;
  setupFeeCents: number;
  estimatedHours: number | null;
  customerGearRequired: boolean;
  customerGearLabel: string | null;
  gearUnconfirmedAdjustmentCents: number;
};

export type PremiumEstimateOption = {
  slug: string;
  name: string;
  enabled: boolean;
  optionType: PremiumOptionType;
  pricingMode: PremiumOptionPricingMode;
  fixedPriceCents: number;
  percentBps: number;
  perUnitPriceCents: number;
  minimumQuantity: number;
  maximumQuantity: number;
  defaultQuantity: number;
};

export type PremiumEstimateRule = {
  normalModeMultiplierBps: number;
  ironmanMultiplierBps: number;
  hardcoreIronmanMultiplierBps: number;
  ultimateIronmanMultiplierBps: number;
  discordStreamEnabled: boolean;
  discordStreamPercentBps: number;
  standardDeliveryEnabled: boolean;
  standardDeliveryLabel: string;
  standardDeliveryDescription: string | null;
  standardDeliveryEstimate: string | null;
  standardDeliveryMultiplierBps: number;
  standardDeliveryFixedFeeCents: number;
  priorityDeliveryEnabled: boolean;
  priorityDeliveryLabel: string;
  priorityDeliveryDescription: string | null;
  priorityDeliveryEstimate: string | null;
  priorityDeliveryMultiplierBps: number;
  priorityDeliveryFixedFeeCents: number;
  expressDeliveryEnabled: boolean;
  expressDeliveryLabel: string;
  expressDeliveryDescription: string | null;
  expressDeliveryEstimate: string | null;
  expressDeliveryMultiplierBps: number;
  expressDeliveryFixedFeeCents: number;
};

export type PremiumOptionSelection = {
  slug: string;
  quantity?: number;
};

export type PremiumEstimateInput = {
  package: PremiumEstimatePackage;
  rule: PremiumEstimateRule;
  availableOptions: PremiumEstimateOption[];
  selectedOptions: PremiumOptionSelection[];
  gameMode: CatalogueGameMode;
  customerGearConfirmed: boolean;
  includeDiscordStream: boolean;
  deliverySpeed: PremiumDeliverySpeed;
};

type LineItem = {
  label: string;
  amountCents: number;
};

function assertMoney(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0 || value > 100_000_000) {
    throw new PremiumValidationError(
      `${label} must be a safe whole-cent value.`,
    );
  }
}

function assertBps(value: number) {
  if (!Number.isInteger(value) || value < 0 || value > 100_000) {
    throw new PremiumValidationError("Percentage must be valid basis points.");
  }
}

function applyBps(amountCents: number, bps: number) {
  assertBps(bps);
  return Math.round((amountCents * bps) / 10_000);
}

function gameModeBps(rule: PremiumEstimateRule, gameMode: CatalogueGameMode) {
  if (gameMode === "NORMAL") return rule.normalModeMultiplierBps;
  if (gameMode === "IRONMAN") return rule.ironmanMultiplierBps;
  if (gameMode === "HARDCORE_IRONMAN") return rule.hardcoreIronmanMultiplierBps;
  return rule.ultimateIronmanMultiplierBps;
}

function deliveryRule(rule: PremiumEstimateRule, speed: PremiumDeliverySpeed) {
  if (speed === "STANDARD") {
    return {
      enabled: rule.standardDeliveryEnabled,
      label: rule.standardDeliveryLabel || premiumDeliveryLabels.STANDARD,
      description: rule.standardDeliveryDescription,
      estimate: rule.standardDeliveryEstimate,
      multiplierBps: rule.standardDeliveryMultiplierBps,
      fixedFeeCents: rule.standardDeliveryFixedFeeCents,
    };
  }
  if (speed === "PRIORITY") {
    return {
      enabled: rule.priorityDeliveryEnabled,
      label: rule.priorityDeliveryLabel || premiumDeliveryLabels.PRIORITY,
      description: rule.priorityDeliveryDescription,
      estimate: rule.priorityDeliveryEstimate,
      multiplierBps: rule.priorityDeliveryMultiplierBps,
      fixedFeeCents: rule.priorityDeliveryFixedFeeCents,
    };
  }
  return {
    enabled: rule.expressDeliveryEnabled,
    label: rule.expressDeliveryLabel || premiumDeliveryLabels.EXPRESS,
    description: rule.expressDeliveryDescription,
    estimate: rule.expressDeliveryEstimate,
    multiplierBps: rule.expressDeliveryMultiplierBps,
    fixedFeeCents: rule.expressDeliveryFixedFeeCents,
  };
}

export function formatCents(amountCents: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amountCents / 100);
}

function optionPrice(
  option: PremiumEstimateOption,
  quantity: number,
  baseCents: number,
) {
  if (quantity < option.minimumQuantity || quantity > option.maximumQuantity) {
    throw new PremiumValidationError(
      `${option.name} quantity must be between ${option.minimumQuantity} and ${option.maximumQuantity}.`,
    );
  }
  if (option.pricingMode === "PERCENT_OF_BASE") {
    return applyBps(baseCents, option.percentBps);
  }
  if (option.pricingMode === "PER_UNIT") {
    return option.perUnitPriceCents * quantity;
  }
  return option.fixedPriceCents;
}

export function calculatePremiumEstimate(input: PremiumEstimateInput) {
  const { package: selectedPackage, rule } = input;
  if (!selectedPackage.enabled) {
    throw new PremiumValidationError("This package is unavailable.");
  }
  [
    ["Base price", selectedPackage.basePriceCents],
    ["Minimum price", selectedPackage.minimumPriceCents],
    ["Setup fee", selectedPackage.setupFeeCents],
    ["Gear adjustment", selectedPackage.gearUnconfirmedAdjustmentCents],
  ].forEach(([label, value]) => assertMoney(Number(value), String(label)));

  const lineItems: LineItem[] = [];
  const baseCents = Math.max(
    selectedPackage.basePriceCents,
    selectedPackage.minimumPriceCents,
  );
  let subtotal = baseCents;
  lineItems.push({ label: "Base premium package", amountCents: subtotal });

  if (selectedPackage.setupFeeCents > 0) {
    subtotal += selectedPackage.setupFeeCents;
    lineItems.push({
      label: "Package setup fee",
      amountCents: selectedPackage.setupFeeCents,
    });
  }

  const accountModeFee = applyBps(subtotal, gameModeBps(rule, input.gameMode));
  if (accountModeFee > 0) {
    subtotal += accountModeFee;
    lineItems.push({
      label: `${gameModeLabels[input.gameMode]} account adjustment`,
      amountCents: accountModeFee,
    });
  }

  if (
    selectedPackage.customerGearRequired &&
    !input.customerGearConfirmed &&
    selectedPackage.gearUnconfirmedAdjustmentCents > 0
  ) {
    subtotal += selectedPackage.gearUnconfirmedAdjustmentCents;
    lineItems.push({
      label: selectedPackage.customerGearLabel || "Gear support adjustment",
      amountCents: selectedPackage.gearUnconfirmedAdjustmentCents,
    });
  }

  const availableOptions = new Map(
    input.availableOptions.map((option) => [option.slug, option]),
  );
  const seenOptions = new Set<string>();
  for (const selection of input.selectedOptions) {
    if (seenOptions.has(selection.slug)) {
      throw new PremiumValidationError("Select each option only once.");
    }
    seenOptions.add(selection.slug);
    const option = availableOptions.get(selection.slug);
    if (!option || !option.enabled) {
      throw new PremiumValidationError("Choose an available premium option.");
    }
    const quantity = selection.quantity ?? option.defaultQuantity;
    if (!Number.isInteger(quantity)) {
      throw new PremiumValidationError(`${option.name} quantity is invalid.`);
    }
    const amountCents = optionPrice(option, quantity, subtotal);
    if (amountCents > 0) {
      subtotal += amountCents;
      lineItems.push({
        label:
          option.pricingMode === "PER_UNIT"
            ? `${option.name} x ${quantity.toLocaleString()}`
            : option.name,
        amountCents,
      });
    }
  }

  if (input.includeDiscordStream) {
    if (!rule.discordStreamEnabled) {
      throw new PremiumValidationError(
        "Discord Stream is not available for this service.",
      );
    }
    const streamFee = applyBps(subtotal, rule.discordStreamPercentBps);
    subtotal += streamFee;
    lineItems.push({ label: "Discord Stream add-on", amountCents: streamFee });
  }

  const delivery = deliveryRule(rule, input.deliverySpeed);
  if (!delivery.enabled) {
    throw new PremiumValidationError(
      `${delivery.label} delivery is not available for this service.`,
    );
  }
  const deliveryFee =
    applyBps(subtotal, delivery.multiplierBps) + delivery.fixedFeeCents;
  if (deliveryFee > 0) {
    subtotal += deliveryFee;
    lineItems.push({
      label: `${delivery.label} delivery estimate`,
      amountCents: deliveryFee,
    });
  }

  return {
    packageName: selectedPackage.name,
    accountMode: gameModeLabels[input.gameMode],
    customerGearConfirmed: input.customerGearConfirmed,
    includesDiscordStream: input.includeDiscordStream,
    delivery: {
      speed: input.deliverySpeed,
      label: delivery.label,
      description: delivery.description,
      estimate: delivery.estimate,
    },
    estimatedHours: selectedPackage.estimatedHours,
    selectedOptions: input.selectedOptions,
    lineItems,
    estimatedTotalCents: subtotal,
    estimatedTotal: formatCents(subtotal),
    finalPriceNote: "Final price is confirmed before checkout.",
  };
}
