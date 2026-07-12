import {
  MAX_SKILLING_XP,
  SKILLING_MAX_LEVEL,
  SKILLING_MIN_LEVEL,
} from "@/lib/skilling/constants";

export class SkillingValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SkillingValidationError";
  }
}

function assertInteger(value: number, label: string) {
  if (!Number.isInteger(value)) {
    throw new SkillingValidationError(`${label} must be a whole number.`);
  }
}

function assertLevel(value: number, label: string) {
  assertInteger(value, label);
  if (value < SKILLING_MIN_LEVEL || value > SKILLING_MAX_LEVEL) {
    throw new SkillingValidationError(
      `${label} must be between ${SKILLING_MIN_LEVEL} and ${SKILLING_MAX_LEVEL}.`,
    );
  }
}

function assertXp(value: number, label: string) {
  assertInteger(value, label);
  if (value < 0) {
    throw new SkillingValidationError(`${label} cannot be negative.`);
  }
  if (value > MAX_SKILLING_XP) {
    throw new SkillingValidationError(
      `${label} cannot exceed ${MAX_SKILLING_XP.toLocaleString()} XP.`,
    );
  }
}

function buildXpTable() {
  const table = new Array<number>(SKILLING_MAX_LEVEL + 1).fill(0);
  let points = 0;
  table[1] = 0;
  for (let level = 1; level < SKILLING_MAX_LEVEL; level += 1) {
    points += Math.floor(level + 300 * Math.pow(2, level / 7));
    table[level + 1] = Math.floor(points / 4);
  }
  return table as readonly number[];
}

export const osrsXpTable = buildXpTable();

export function xpForLevel(level: number) {
  assertLevel(level, "Level");
  return osrsXpTable[level]!;
}

export function levelForXp(xp: number) {
  assertXp(xp, "XP");
  let level = SKILLING_MIN_LEVEL;
  for (
    let candidate = SKILLING_MIN_LEVEL;
    candidate <= SKILLING_MAX_LEVEL;
    candidate += 1
  ) {
    if (osrsXpTable[candidate]! <= xp) level = candidate;
    else break;
  }
  return level;
}

export function calculateLevelProgress(input: {
  currentLevel: number;
  targetLevel: number;
}) {
  assertLevel(input.currentLevel, "Current level");
  assertLevel(input.targetLevel, "Target level");
  if (input.currentLevel >= input.targetLevel) {
    throw new SkillingValidationError(
      "Target level must be higher than current level.",
    );
  }
  const currentXp = xpForLevel(input.currentLevel);
  const targetXp = xpForLevel(input.targetLevel);
  return {
    mode: "LEVEL" as const,
    currentLevel: input.currentLevel,
    targetLevel: input.targetLevel,
    currentXp,
    targetXp,
    xpRequired: targetXp - currentXp,
  };
}

export function calculateXpProgress(input: {
  currentXp: number;
  targetXp: number;
}) {
  assertXp(input.currentXp, "Current XP");
  assertXp(input.targetXp, "Target XP");
  if (input.currentXp >= input.targetXp) {
    throw new SkillingValidationError(
      "Target XP must be higher than current XP.",
    );
  }
  return {
    mode: "XP" as const,
    currentLevel: levelForXp(input.currentXp),
    targetLevel: levelForXp(input.targetXp),
    currentXp: input.currentXp,
    targetXp: input.targetXp,
    xpRequired: input.targetXp - input.currentXp,
  };
}
