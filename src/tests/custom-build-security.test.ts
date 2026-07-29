import { describe, expect, it } from "vitest";

import {
  assertNoCredentialLikeKeys,
  createTrackingToken,
  hashSecret,
  normalizeContact,
  normalizePlainText,
  timingSafeHashEquals,
} from "@/lib/custom-build/security";

describe("custom build security helpers", () => {
  it("normalizes minimum contact details without broadening public data", () => {
    expect(
      normalizeContact({
        displayName: "  Quote Customer  ",
        email: "CUSTOMER@EXAMPLE.TEST",
        discordUsername: "quote.customer_1",
        rsn: "Safe_Name",
      }),
    ).toEqual({
      displayName: "Quote Customer",
      email: "customer@example.test",
      discordUsername: "quote.customer_1",
      rsn: "Safe Name",
    });
  });

  it("rejects credential-like keys recursively", () => {
    expect(() =>
      assertNoCredentialLikeKeys({
        displayName: "Quote Customer",
        discordUsername: "quote.customer_1",
      }),
    ).not.toThrow();

    expect(() =>
      assertNoCredentialLikeKeys({
        build: { targetLevel: 80 },
        accountPassword: "never",
      }),
    ).toThrow(/Credential-like/);

    expect(() =>
      assertNoCredentialLikeKeys({
        build: [{ recoveryAnswer: "never" }],
      }),
    ).toThrow(/Credential-like/);
  });

  it("keeps notes plain text and rejects credential content", () => {
    expect(normalizePlainText("Line one\r\nLine two", 100)).toBe(
      "Line one\nLine two",
    );
    expect(() => normalizePlainText("<script>alert(1)</script>", 100)).toThrow(
      /plain text/i,
    );
    expect(() => normalizePlainText("my bank pin is 1234", 100)).toThrow(
      /passwords, PINs/i,
    );
  });

  it("generates high-entropy tokens and stores only hashes", () => {
    const token = createTrackingToken();
    expect(token.token.length).toBeGreaterThanOrEqual(40);
    expect(token.hash).toBe(hashSecret(token.token));
    expect(token.hash).not.toContain(token.token);
    expect(timingSafeHashEquals(token.hash, hashSecret(token.token))).toBe(
      true,
    );
    expect(timingSafeHashEquals(token.hash, hashSecret("wrong"))).toBe(false);
  });
});
