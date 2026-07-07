export const MAX_SAFE_REQUIREMENT_VALUE = Number.MAX_SAFE_INTEGER;

export type RequirementNumericValue = number | bigint | null | undefined;

export function safeRequirementNumber(
  value: RequirementNumericValue,
): number | null {
  if (value == null) return null;
  if (typeof value === "bigint") {
    if (value < 0n || value > BigInt(MAX_SAFE_REQUIREMENT_VALUE)) {
      throw new TypeError("Requirement value is outside the safe JSON range.");
    }
    return Number(value);
  }
  if (
    !Number.isSafeInteger(value) ||
    value < 0 ||
    value > MAX_SAFE_REQUIREMENT_VALUE
  ) {
    throw new TypeError("Requirement value is outside the safe JSON range.");
  }
  return value;
}

export function prismaRequirementBigInt(
  value: RequirementNumericValue,
): bigint | null {
  const numberValue = safeRequirementNumber(value);
  return numberValue == null ? null : BigInt(numberValue);
}
