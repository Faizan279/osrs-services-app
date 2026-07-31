import { describe, expect, it } from "vitest";

import {
  assertNoCredentialLikeKeys,
  cartCookie,
  checkCheckoutRateLimit,
  clearCheckoutRateLimit,
  createSecureToken,
  expiredCartCookieOptions,
  hashIdempotencyKey,
  hashToken,
  isValidSecureToken,
  normalizeGuestContact,
  normalizePlainText,
  normalizeServiceDetails,
  timingSafeHashEquals,
} from "@/lib/checkout/security";

describe("checkout security helpers", () => {
  it("creates bounded URL-safe tokens and stores only stable hashes", () => {
    const token = createSecureToken();
    const tokenHash = hashToken(token);

    expect(isValidSecureToken(token)).toBe(true);
    expect(token).toHaveLength(43);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(timingSafeHashEquals(tokenHash, hashToken(token))).toBe(true);
    expect(timingSafeHashEquals(tokenHash, hashToken(`${token}x`))).toBe(false);
  });

  it("creates HttpOnly cart cookie options and expiry options", () => {
    const expires = new Date("2030-01-01T00:00:00.000Z");
    const cookie = cartCookie(createSecureToken(), expires);
    const expired = expiredCartCookieOptions();

    expect(cookie.name).toBe("osrs_guest_cart");
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe("lax");
    expect(cookie.options.path).toBe("/");
    expect(expired.maxAge).toBe(0);
  });

  it("rejects credential-like checkout fields and text", () => {
    expect(() =>
      assertNoCredentialLikeKeys({ account: { bank_pin: "1234" } }),
    ).toThrow(/Credential-like/);
    expect(() => normalizePlainText("my password is here", 100)).toThrow(
      /passwords/i,
    );
    expect(() =>
      normalizeServiceDetails({ safeNote: "bring supplies" }),
    ).not.toThrow();
  });

  it("normalizes guest contact and idempotency inputs", () => {
    const contact = normalizeGuestContact({
      displayName: "  Example Buyer  ",
      email: "BUYER@EXAMPLE.TEST",
      discordUsername: "buyer.name",
      rsn: "Buyer RSN",
    });

    expect(contact).toEqual({
      displayName: "Example Buyer",
      email: "buyer@example.test",
      discordUsername: "buyer.name",
      rsn: "Buyer RSN",
    });
    expect(hashIdempotencyKey("checkout-key-1")).toMatch(/^[a-f0-9]{64}$/);
    expect(() => hashIdempotencyKey("short")).toThrow(/bounded/);
  });

  it("rate limits repeated checkout attempts by key", () => {
    const key = "checkout-test-key";
    clearCheckoutRateLimit(key);

    expect(checkCheckoutRateLimit({ key, maxAttempts: 2 }).allowed).toBe(true);
    expect(checkCheckoutRateLimit({ key, maxAttempts: 2 }).allowed).toBe(true);
    const blocked = checkCheckoutRateLimit({ key, maxAttempts: 2 });

    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
    clearCheckoutRateLimit(key);
  });
});
