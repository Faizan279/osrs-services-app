import { describe, expect, it } from "vitest";

import {
  CustomerAccountError,
  assertNoCredentialLikeFields,
  createCustomerToken,
  customerDiscordSchema,
  customerPasswordSchema,
  hashCustomerToken,
  isValidCustomerToken,
  normalizeOptionalRsn,
} from "@/lib/customer/security";

describe("customer account security helpers", () => {
  it("accepts long password-manager values without composition rules", () => {
    expect(customerPasswordSchema.parse("correct horse battery staple")).toBe(
      "correct horse battery staple",
    );
    expect(() => customerPasswordSchema.parse("short")).toThrow();
    expect(() => customerPasswordSchema.parse("x".repeat(257))).toThrow();
  });

  it("rejects credential-like profile fields and values", () => {
    expect(() =>
      assertNoCredentialLikeFields({ displayName: "Valid Customer" }),
    ).not.toThrow();
    expect(() =>
      assertNoCredentialLikeFields({ recoveryAnswer: "lumbridge" }),
    ).toThrow(CustomerAccountError);
    expect(() =>
      assertNoCredentialLikeFields({ note: "my bank pin is 1234" }),
    ).toThrow(CustomerAccountError);
  });

  it("validates Discord names and RSNs conservatively", () => {
    expect(customerDiscordSchema.parse("valid.name_12")).toBe("valid.name_12");
    expect(() => customerDiscordSchema.parse("not valid name")).toThrow();
    expect(normalizeOptionalRsn("Task014")).toBe("Task014");
    expect(() => normalizeOptionalRsn("this name is too long")).toThrow();
  });

  it("generates high-entropy tokens and stores only hashes", () => {
    const token = createCustomerToken();
    const tokenHash = hashCustomerToken(token);
    expect(isValidCustomerToken(token)).toBe(true);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toBe(token);
  });
});
