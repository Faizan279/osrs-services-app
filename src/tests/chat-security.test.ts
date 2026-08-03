import { describe, expect, it } from "vitest";

import {
  ChatError,
  assertNoCredentialLikeChatFields,
  createGuestChatToken,
  guestChatCookie,
  hashChatIdempotencyKey,
  hashChatToken,
  isValidGuestChatToken,
  normalizeChatText,
  timingSafeHashEquals,
} from "@/lib/chat/security";

describe("chat security helpers", () => {
  it("generates guest tokens and stores only HMAC digests", () => {
    const token = createGuestChatToken();
    const tokenHash = hashChatToken(token);

    expect(isValidGuestChatToken(token)).toBe(true);
    expect(tokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(tokenHash).not.toBe(token);
    expect(timingSafeHashEquals(tokenHash, hashChatToken(token))).toBe(true);
    expect(timingSafeHashEquals(tokenHash, "not-a-hash")).toBe(false);
  });

  it("rejects HTML, credential-like text and credential-like fields", () => {
    expect(normalizeChatText("  Hello support\r\nplease help  ", 100)).toBe(
      "Hello support\nplease help",
    );
    expect(() => normalizeChatText("<b>hello</b>", 100)).toThrow(ChatError);
    expect(() => normalizeChatText("my bank pin is 1234", 100)).toThrow(
      ChatError,
    );
    expect(() =>
      assertNoCredentialLikeChatFields({ password: "secret" }),
    ).toThrow(ChatError);
    expect(() =>
      assertNoCredentialLikeChatFields({ message: "safe public context" }),
    ).not.toThrow();
  });

  it("bounds idempotency keys and marks guest cookies HttpOnly", () => {
    expect(hashChatIdempotencyKey("task015-idempotency")).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(() => hashChatIdempotencyKey("short")).toThrow(ChatError);

    const cookie = guestChatCookie(
      createGuestChatToken(),
      new Date(Date.now() + 1000),
    );
    expect(cookie.name).toBe("osrs_chat_guest");
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.sameSite).toBe("lax");
    expect(cookie.options.path).toBe("/");
  });
});
