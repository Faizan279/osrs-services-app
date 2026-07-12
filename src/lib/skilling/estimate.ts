import { catalogueGameModes, gameModeLabels } from "@/lib/catalogue/constants";
import {
  skillingDeliveryLabels,
  type SkillingDeliverySpeed,
} from "@/lib/skilling/constants";
import type {
  calculateLevelProgress,
  calculateXpProgress,
} from "@/lib/skilling/xp";
import { SkillingValidationError } from "@/lib/skilling/xp";

type CatalogueGameMode = (typeof catalogueGameModes)[number];
type Progress = ReturnType<
  typeof calculateLevelProgress | typeof calculateXpProgress
>;

export type SkillingEstimateMethod = {
  name: string;
  enabled: boolean;
  minimumLevel: number;
  maximumLevel: number;
  xpPerHour: number | null;
  basePriceCentsPerMillionXp: number;
  minimumPriceCents: number;
  fixedFeeCents: number;
  suppliesEnabled: boolean;
  suppliesLabel: string | null;
  suppliesFeeCents: number;
};

export type SkillingEstimateRule = {
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

export type SkillingEstimateInput = {
  progress: Progress;
  method: SkillingEstimateMethod;
  rule: SkillingEstimateRule;
  gameMode: CatalogueGameMode;
  includeSupplies: boolean;
  includeDiscordStream: boolean;
  deliverySpeed: SkillingDeliverySpeed;
};

type LineItem = {
  label: string;
  amountCents: number;
};

function assertNonNegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new SkillingValidationError(`${label} must be a whole number.`);
  }
}

function applyBps(amountCents: number, bps: number) {
  assertNonNegativeInteger(bps, "Percentage");
  return Math.round((amountCents * bps) / 10_000);
}

function gameModeBps(rule: SkillingEstimateRule, gameMode: CatalogueGameMode) {
  if (gameMode === "NORMAL") return rule.normalModeMultiplierBps;
  if (gameMode === "IRONMAN") return rule.ironmanMultiplierBps;
  if (gameMode === "HARDCORE_IRONMAN") return rule.hardcoreIronmanMultiplierBps;
  return rule.ultimateIronmanMultiplierBps;
}

function deliveryRule(
  rule: SkillingEstimateRule,
  speed: SkillingDeliverySpeed,
) {
  if (speed === "STANDARD") {
    return {
      enabled: rule.standardDeliveryEnabled,
      label: rule.standardDeliveryLabel || skillingDeliveryLabels.STANDARD,
      description: rule.standardDeliveryDescription,
      estimate: rule.standardDeliveryEstimate,
      multiplierBps: rule.standardDeliveryMultiplierBps,
      fixedFeeCents: rule.standardDeliveryFixedFeeCents,
    };
  }
  if (speed === "PRIORITY") {
    return {
      enabled: rule.priorityDeliveryEnabled,
      label: rule.priorityDeliveryLabel || skillingDeliveryLabels.PRIORITY,
      description: rule.priorityDeliveryDescription,
      estimate: rule.priorityDeliveryEstimate,
      multiplierBps: rule.priorityDeliveryMultiplierBps,
      fixedFeeCents: rule.priorityDeliveryFixedFeeCents,
    };
  }
  return {
    enabled: rule.expressDeliveryEnabled,
    label: rule.expressDeliveryLabel || skillingDeliveryLabels.EXPRESS,
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

export function calculateSkillingEstimate(input: SkillingEstimateInput) {
  const { method, progress, rule } = input;
  if (!method.enabled) {
    throw new SkillingValidationError("This training method is unavailable.");
  }
  if (progress.currentLevel < method.minimumLevel) {
    throw new SkillingValidationError(
      `This method starts at level ${method.minimumLevel}.`,
    );
  }
  if (progress.targetLevel > method.maximumLevel) {
    throw new SkillingValidationError(
      `This method supports targets up to level ${method.maximumLevel}.`,
    );
  }
  [
    ["Base price", method.basePriceCentsPerMillionXp],
    ["Minimum price", method.minimumPriceCents],
    ["Fixed method fee", method.fixedFeeCents],
    ["Supply fee", method.suppliesFeeCents],
  ].forEach(([label, value]) =>
    assertNonNegativeInteger(Number(value), String(label)),
  );

  const lineItems: LineItem[] = [];
  const calculatedBase =
    Math.ceil(
      (progress.xpRequired * method.basePriceCentsPerMillionXp) / 1_000_000,
    ) + method.fixedFeeCents;
  let subtotal = Math.max(calculatedBase, method.minimumPriceCents);
  lineItems.push({ label: "Base skilling estimate", amountCents: subtotal });

  const accountModeFee = applyBps(subtotal, gameModeBps(rule, input.gameMode));
  if (accountModeFee > 0) {
    subtotal += accountModeFee;
    lineItems.push({
      label: `${gameModeLabels[input.gameMode]} account adjustment`,
      amountCents: accountModeFee,
    });
  }

  if (input.includeSupplies) {
    if (!method.suppliesEnabled) {
      throw new SkillingValidationError(
        "Supplies are not configured for this method.",
      );
    }
    subtotal += method.suppliesFeeCents;
    lineItems.push({
      label: method.suppliesLabel || "Supplies and materials",
      amountCents: method.suppliesFeeCents,
    });
  }

  if (input.includeDiscordStream) {
    if (!rule.discordStreamEnabled) {
      throw new SkillingValidationError(
        "Discord Stream is not available for this service.",
      );
    }
    const streamFee = applyBps(subtotal, rule.discordStreamPercentBps);
    subtotal += streamFee;
    lineItems.push({ label: "Discord Stream add-on", amountCents: streamFee });
  }

  const delivery = deliveryRule(rule, input.deliverySpeed);
  if (!delivery.enabled) {
    throw new SkillingValidationError(
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
    xpRequired: progress.xpRequired,
    currentLevel: progress.currentLevel,
    targetLevel: progress.targetLevel,
    currentXp: progress.currentXp,
    targetXp: progress.targetXp,
    methodName: method.name,
    accountMode: gameModeLabels[input.gameMode],
    delivery: {
      speed: input.deliverySpeed,
      label: delivery.label,
      description: delivery.description,
      estimate: delivery.estimate,
    },
    estimatedHours: method.xpPerHour
      ? Math.ceil((progress.xpRequired / method.xpPerHour) * 10) / 10
      : null,
    lineItems,
    estimatedTotalCents: subtotal,
    estimatedTotal: formatCents(subtotal),
    finalPriceNote: "Final price is confirmed before checkout.",
  };
}
