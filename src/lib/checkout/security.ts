import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import {
  CART_COOKIE_MAX_AGE_SECONDS,
  CART_COOKIE_NAME,
} from "@/lib/checkout/constants";
import { rsnSchema } from "@/lib/eligibility/rsn";

export class CheckoutSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CheckoutSecurityError";
  }
}

const credentialKeyPattern =
  /(password|passcode|credential|login|username|email_password|emailpassword|bank_pin|bankpin|pin|recovery|recoveries|recoveryanswer|recoveryquestion|authenticator|twofactor|two_factor|2fa|backup_code|backupcodes|cookie|session|token|secret|seed|cvv|card|expiry|wallet|private_key|recovery_phrase)$/i;

const credentialTextPattern =
  /(password|bank\s*pin|recovery\s*(answer|question)|authenticator\s*(secret|seed)|backup\s*code|session\s*token|browser\s*cookie|card\s*number|cvv|wallet\s*(seed|phrase)|private\s*key)/i;

const tokenPattern = /^[A-Za-z0-9_-]{43}$/;

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a display name.")
  .max(120, "Display name is too long.");

const emailSchema = z
  .string()
  .trim()
  .max(191)
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

const discordSchema = z
  .string()
  .trim()
  .max(80)
  .optional()
  .or(z.literal(""))
  .transform((value) => value || null)
  .pipe(
    z
      .string()
      .regex(
        /^[A-Za-z0-9._-]{2,32}$/,
        "Use a Discord username with 2-32 letters, numbers, dots, underscores, or hyphens.",
      )
      .nullable(),
  );

export type NormalizedGuestContact = {
  displayName: string;
  email: string;
  discordUsername: string | null;
  rsn: string | null;
};

export function createSecureToken() {
  return randomBytes(32).toString("base64url");
}

export function isValidSecureToken(value: string | undefined | null) {
  return Boolean(value && tokenPattern.test(value));
}

export function hashToken(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function hashIdempotencyKey(value: string) {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 160) {
    throw new CheckoutSecurityError("Use a bounded idempotency key.");
  }
  return hashToken(normalized);
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

export function cartCookieOptions(expires: Date) {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
    maxAge: CART_COOKIE_MAX_AGE_SECONDS,
  };
}

export function expiredCartCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(0),
    maxAge: 0,
  };
}

export function cartCookie(rawToken: string, expires: Date) {
  return {
    name: CART_COOKIE_NAME,
    value: rawToken,
    options: cartCookieOptions(expires),
  };
}

export function normalizePlainText(input: unknown, maximumLength: number) {
  const text = String(input ?? "")
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u0000/g, "")
    .trim();
  if (text.length > maximumLength) {
    throw new CheckoutSecurityError(
      `Text must be ${maximumLength.toLocaleString()} characters or fewer.`,
    );
  }
  if (/[<>]/.test(text)) {
    throw new CheckoutSecurityError("Use plain text only.");
  }
  if (credentialTextPattern.test(text)) {
    throw new CheckoutSecurityError(
      "Do not include passwords, PINs, recovery answers, card data or secrets.",
    );
  }
  return text;
}

export function assertNoCredentialLikeKeys(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(assertNoCredentialLikeKeys);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^A-Za-z0-9_]/g, "_");
    if (credentialKeyPattern.test(normalizedKey)) {
      throw new CheckoutSecurityError(
        "Credential-like checkout fields are not accepted.",
      );
    }
    assertNoCredentialLikeKeys(nested);
  }
}

export function normalizeServiceDetails(input: unknown) {
  assertNoCredentialLikeKeys(input);
  if (input == null) return {};
  if (typeof input !== "object" || Array.isArray(input)) {
    throw new CheckoutSecurityError("Service details must be structured.");
  }
  const output: Record<string, string | boolean> = {};
  for (const [key, value] of Object.entries(input)) {
    if (!/^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)) {
      throw new CheckoutSecurityError("Service detail keys must be explicit.");
    }
    if (typeof value === "boolean") {
      output[key] = value;
      continue;
    }
    output[key] = normalizePlainText(value, 500);
  }
  return output;
}

export function normalizeGuestContact(input: {
  displayName: unknown;
  email: unknown;
  discordUsername?: unknown;
  rsn?: unknown;
}): NormalizedGuestContact {
  const displayName = displayNameSchema.parse(input.displayName);
  const email = emailSchema.parse(input.email);
  const discordUsername = discordSchema.parse(input.discordUsername ?? "");
  const rsnText = String(input.rsn ?? "").trim();
  const rsn = rsnText ? rsnSchema.parse(rsnText) : null;
  return { displayName, email, discordUsername, rsn };
}

type AttemptWindow = { count: number; resetAt: number };

const rateLimitWindows = new Map<string, AttemptWindow>();

export function checkCheckoutRateLimit({
  key,
  maxAttempts = 18,
  windowMs = 15 * 60 * 1000,
  now = Date.now(),
}: {
  key: string;
  maxAttempts?: number;
  windowMs?: number;
  now?: number;
}) {
  const current = rateLimitWindows.get(key);
  if (!current || current.resetAt <= now) {
    rateLimitWindows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0 };
  }
  if (current.count >= maxAttempts) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }
  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function clearCheckoutRateLimit(key: string) {
  rateLimitWindows.delete(key);
}
