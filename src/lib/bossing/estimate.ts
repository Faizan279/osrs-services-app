import { catalogueGameModes, gameModeLabels } from "@/lib/catalogue/constants";
import {
  bossingDeliveryLabels,
  type BossingDeliverySpeed,
  type BossingKillMode,
  type BossingPriceMode,
} from "@/lib/bossing/constants";

type CatalogueGameMode = (typeof catalogueGameModes)[number];

export class BossingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BossingValidationError";
  }
}

const MAX_SAFE_KILL_COUNT = 1_000_000;

export type BossingKillInput = {
  mode: BossingKillMode;
  killQuantity?: number;
  currentKillCount?: number;
  targetKillCount?: number;
};

export type BossingKillProgress = {
  mode: BossingKillMode;
  requestedKills: number;
  currentKillCount: number | null;
  targetKillCount: number | null;
};

export type BossingEstimateMethod = {
  name: string;
  enabled: boolean;
  priceMode: BossingPriceMode;
  minimumKillCount: number;
  maximumKillCount: number | null;
  basePriceCentsPerKill: number;
  fixedPackagePriceCents: number;
  minimumPriceCents: number;
  setupFeeCents: number;
  suppliesEnabled: boolean;
  suppliesLabel: string | null;
  suppliesFeeCents: number;
  customerGearRequired: boolean;
  customerGearLabel: string | null;
  gearAdjustmentCents: number;
  estimatedKillsPerHour: number | null;
};

export type BossingEstimateRule = {
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

export type BossingEstimateInput = {
  progress: BossingKillProgress;
  method: BossingEstimateMethod;
  rule: BossingEstimateRule;
  gameMode: CatalogueGameMode;
  customerGearConfirmed: boolean;
  includeSupplies: boolean;
  includeDiscordStream: boolean;
  deliverySpeed: BossingDeliverySpeed;
};

type LineItem = {
  label: string;
  amountCents: number;
};

function assertWholeNumber(value: number | undefined, label: string) {
  if (value == null || !Number.isFinite(value) || !Number.isInteger(value)) {
    throw new BossingValidationError(`${label} must be a whole number.`);
  }
}

function assertNonNegativeInteger(value: number, label: string) {
  assertWholeNumber(value, label);
  if (value < 0) {
    throw new BossingValidationError(`${label} cannot be negative.`);
  }
  if (value > MAX_SAFE_KILL_COUNT) {
    throw new BossingValidationError(`${label} is too large to estimate.`);
  }
}

function assertPositiveInteger(value: number | undefined, label: string) {
  assertWholeNumber(value, label);
  if (value! <= 0) {
    throw new BossingValidationError(`${label} must be greater than zero.`);
  }
  if (value! > MAX_SAFE_KILL_COUNT) {
    throw new BossingValidationError(`${label} is too large to estimate.`);
  }
}

export function calculateBossingKillProgress(
  input: BossingKillInput,
): BossingKillProgress {
  if (input.mode === "DIRECT") {
    assertPositiveInteger(input.killQuantity, "Kill quantity");
    return {
      mode: input.mode,
      requestedKills: input.killQuantity!,
      currentKillCount: null,
      targetKillCount: null,
    };
  }

  assertNonNegativeInteger(input.currentKillCount!, "Current KC");
  assertPositiveInteger(input.targetKillCount, "Target KC");
  if (input.targetKillCount! <= input.currentKillCount!) {
    throw new BossingValidationError(
      "Target KC must be greater than current KC.",
    );
  }
  const requestedKills = input.targetKillCount! - input.currentKillCount!;
  if (requestedKills > MAX_SAFE_KILL_COUNT) {
    throw new BossingValidationError("Requested kills are too large.");
  }
  return {
    mode: input.mode,
    requestedKills,
    currentKillCount: input.currentKillCount!,
    targetKillCount: input.targetKillCount!,
  };
}

function assertMoney(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0 || value > 100_000_000) {
    throw new BossingValidationError(
      `${label} must be a safe whole-cent value.`,
    );
  }
}

function applyBps(amountCents: number, bps: number) {
  if (!Number.isInteger(bps) || bps < 0 || bps > 100_000) {
    throw new BossingValidationError("Percentage must be valid basis points.");
  }
  return Math.round((amountCents * bps) / 10_000);
}

function gameModeBps(rule: BossingEstimateRule, gameMode: CatalogueGameMode) {
  if (gameMode === "NORMAL") return rule.normalModeMultiplierBps;
  if (gameMode === "IRONMAN") return rule.ironmanMultiplierBps;
  if (gameMode === "HARDCORE_IRONMAN") return rule.hardcoreIronmanMultiplierBps;
  return rule.ultimateIronmanMultiplierBps;
}

function deliveryRule(rule: BossingEstimateRule, speed: BossingDeliverySpeed) {
  if (speed === "STANDARD") {
    return {
      enabled: rule.standardDeliveryEnabled,
      label: rule.standardDeliveryLabel || bossingDeliveryLabels.STANDARD,
      description: rule.standardDeliveryDescription,
      estimate: rule.standardDeliveryEstimate,
      multiplierBps: rule.standardDeliveryMultiplierBps,
      fixedFeeCents: rule.standardDeliveryFixedFeeCents,
    };
  }
  if (speed === "PRIORITY") {
    return {
      enabled: rule.priorityDeliveryEnabled,
      label: rule.priorityDeliveryLabel || bossingDeliveryLabels.PRIORITY,
      description: rule.priorityDeliveryDescription,
      estimate: rule.priorityDeliveryEstimate,
      multiplierBps: rule.priorityDeliveryMultiplierBps,
      fixedFeeCents: rule.priorityDeliveryFixedFeeCents,
    };
  }
  return {
    enabled: rule.expressDeliveryEnabled,
    label: rule.expressDeliveryLabel || bossingDeliveryLabels.EXPRESS,
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

export function calculateBossingEstimate(input: BossingEstimateInput) {
  const { method, progress, rule } = input;
  if (!method.enabled) {
    throw new BossingValidationError("This bossing method is unavailable.");
  }
  if (progress.requestedKills < method.minimumKillCount) {
    throw new BossingValidationError(
      `This method requires at least ${method.minimumKillCount.toLocaleString()} kill${method.minimumKillCount === 1 ? "" : "s"}.`,
    );
  }
  if (
    method.maximumKillCount != null &&
    progress.requestedKills > method.maximumKillCount
  ) {
    throw new BossingValidationError(
      `This method supports up to ${method.maximumKillCount.toLocaleString()} kills.`,
    );
  }
  [
    ["Base price", method.basePriceCentsPerKill],
    ["Package price", method.fixedPackagePriceCents],
    ["Minimum price", method.minimumPriceCents],
    ["Setup fee", method.setupFeeCents],
    ["Supply fee", method.suppliesFeeCents],
    ["Gear adjustment", method.gearAdjustmentCents],
  ].forEach(([label, value]) => assertMoney(Number(value), String(label)));

  const lineItems: LineItem[] = [];
  const calculatedBase =
    method.priceMode === "FIXED_PACKAGE"
      ? method.fixedPackagePriceCents
      : progress.requestedKills * method.basePriceCentsPerKill;
  let subtotal = Math.max(calculatedBase, method.minimumPriceCents);
  lineItems.push({
    label:
      method.priceMode === "FIXED_PACKAGE"
        ? "Base bossing package"
        : "Base bossing estimate",
    amountCents: subtotal,
  });

  if (method.setupFeeCents > 0) {
    subtotal += method.setupFeeCents;
    lineItems.push({
      label: "Method setup fee",
      amountCents: method.setupFeeCents,
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

  if (method.customerGearRequired && !input.customerGearConfirmed) {
    if (method.gearAdjustmentCents > 0) {
      subtotal += method.gearAdjustmentCents;
      lineItems.push({
        label: method.customerGearLabel || "Gear support adjustment",
        amountCents: method.gearAdjustmentCents,
      });
    }
  }

  if (input.includeSupplies) {
    if (!method.suppliesEnabled) {
      throw new BossingValidationError(
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
      throw new BossingValidationError(
        "Discord Stream is not available for this service.",
      );
    }
    const streamFee = applyBps(subtotal, rule.discordStreamPercentBps);
    subtotal += streamFee;
    lineItems.push({ label: "Discord Stream add-on", amountCents: streamFee });
  }

  const delivery = deliveryRule(rule, input.deliverySpeed);
  if (!delivery.enabled) {
    throw new BossingValidationError(
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
    requestedKills: progress.requestedKills,
    currentKillCount: progress.currentKillCount,
    targetKillCount: progress.targetKillCount,
    killMode: progress.mode,
    methodName: method.name,
    accountMode: gameModeLabels[input.gameMode],
    customerGearConfirmed: input.customerGearConfirmed,
    includesSupplies: input.includeSupplies,
    includesDiscordStream: input.includeDiscordStream,
    delivery: {
      speed: input.deliverySpeed,
      label: delivery.label,
      description: delivery.description,
      estimate: delivery.estimate,
    },
    estimatedHours: method.estimatedKillsPerHour
      ? Math.ceil(
          (progress.requestedKills / method.estimatedKillsPerHour) * 10,
        ) / 10
      : null,
    lineItems,
    estimatedTotalCents: subtotal,
    estimatedTotal: formatCents(subtotal),
    finalPriceNote: "Final price is confirmed before checkout.",
  };
}
