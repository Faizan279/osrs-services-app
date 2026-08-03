import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { z } from "zod";

import { chatGuestCookieName } from "@/lib/chat/config";

export class ChatError extends Error {
  status = 400;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "ChatError";
    this.status = status;
  }
}

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;
const idPattern = /^[a-z0-9]{10,40}$/i;
const referencePattern = /^CHAT-[A-Z0-9]{8,18}$/;
const controlCharacters = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;
const credentialKeyPattern =
  /(password|passcode|credential|login|username|email_password|emailpassword|bank_pin|bankpin|pin|recovery|recoveries|recoveryanswer|recoveryquestion|authenticator|twofactor|two_factor|2fa|backup_code|backupcodes|cookie|session|token|secret|seed|cvv|card|expiry|wallet|private_key|recovery_phrase)$/i;
const credentialTextPattern =
  /(password|bank\s*pin|recovery\s*(answer|question)|authenticator\s*(secret|seed)|backup\s*code|session\s*token|browser\s*cookie|card\s*number|cvv|wallet\s*(seed|phrase)|private\s*key|email\s*password|runescape\s*password)/i;

export const chatDisplayNameSchema = z
  .string()
  .trim()
  .max(120)
  .optional()
  .or(z.literal(""))
  .transform((value) => value || null)
  .pipe(
    z
      .string()
      .min(1)
      .max(120)
      .regex(/^[^<>]*$/, "Use plain text only.")
      .nullable(),
  );

export const chatCategorySchema = z
  .string()
  .trim()
  .max(80)
  .optional()
  .or(z.literal(""))
  .transform((value) => value || null)
  .pipe(
    z
      .string()
      .regex(/^[A-Za-z0-9 _-]{1,80}$/, "Use a plain support category.")
      .nullable(),
  );

export function createGuestChatToken() {
  return randomBytes(32).toString("base64url");
}

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be configured for chat token hashing.");
  }
  return secret;
}

export function hashChatToken(value: string) {
  return createHmac("sha256", authSecret()).update(value, "utf8").digest("hex");
}

export function hashChatIdempotencyKey(value: string) {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 160) {
    throw new ChatError("Use a bounded idempotency key.");
  }
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

export function isValidGuestChatToken(value: string | undefined | null) {
  return Boolean(value && tokenPattern.test(value));
}

export function isValidChatId(value: string | undefined | null) {
  return Boolean(value && idPattern.test(value));
}

export function isValidConversationReference(value: string | undefined | null) {
  return Boolean(value && referencePattern.test(value));
}

export function timingSafeHashEquals(left: string, right: string) {
  if (!/^[a-f0-9]{64}$/i.test(left) || !/^[a-f0-9]{64}$/i.test(right)) {
    return false;
  }
  const leftBuffer = Buffer.from(left, "hex");
  const rightBuffer = Buffer.from(right, "hex");
  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function normalizeChatText(input: unknown, maximumLength: number) {
  const text = String(input ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(controlCharacters, "")
    .trim();
  if (!text) throw new ChatError("Enter a message.");
  if (text.length > maximumLength) {
    throw new ChatError(
      `Message must be ${maximumLength.toLocaleString()} characters or fewer.`,
    );
  }
  if (/[<>]/.test(text)) throw new ChatError("Use plain text only.");
  if (credentialTextPattern.test(text)) {
    throw new ChatError(
      "Do not include passwords, PINs, recovery answers, card data or secrets.",
    );
  }
  return text;
}

export function normalizeInternalNote(input: unknown) {
  const text = normalizeChatText(input, 2000);
  return text;
}

export function assertNoCredentialLikeChatFields(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(assertNoCredentialLikeChatFields);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^A-Za-z0-9_]/g, "_");
    if (credentialKeyPattern.test(normalizedKey)) {
      throw new ChatError("Credential-like chat fields are not accepted.");
    }
    if (typeof nested === "string" && credentialTextPattern.test(nested)) {
      throw new ChatError(
        "Do not include passwords, PINs, recovery answers, card data or secrets.",
      );
    }
    assertNoCredentialLikeChatFields(nested);
  }
}

export function guestChatCookie(rawToken: string, expires: Date) {
  return {
    name: chatGuestCookieName(),
    value: rawToken,
    options: {
      httpOnly: true as const,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires,
    },
  };
}

export function expiredGuestChatCookie() {
  return {
    name: chatGuestCookieName(),
    value: "",
    options: {
      httpOnly: true as const,
      sameSite: "lax" as const,
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: new Date(0),
      maxAge: 0,
    },
  };
}

export function safeJson<T>(value: T) {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested,
    ),
  ) as T;
}

export function sanitizeChatError(error: unknown) {
  if (error instanceof ChatError) {
    return { message: error.message, status: error.status };
  }
  if (error instanceof Error && error.name === "ZodError") {
    return { message: "Check the chat details and try again.", status: 400 };
  }
  return {
    message: "The chat request could not be completed safely.",
    status: 500,
  };
}
