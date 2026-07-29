import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import { rsnSchema } from "@/lib/eligibility/rsn";

export class CustomBuildSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustomBuildSecurityError";
  }
}

const credentialKeyPattern =
  /(password|passcode|credential|login|username|email_password|emailpassword|bank_pin|bankpin|pin|recovery|recoveries|recoveryanswer|recoveryquestion|authenticator|twofactor|two_factor|2fa|backup_code|backupcodes|cookie|session|token|secret|seed)$/i;

const credentialTextPattern =
  /(password|bank\s*pin|recovery\s*(answer|question)|authenticator\s*(secret|seed)|backup\s*code|session\s*token|browser\s*cookie)/i;

const allowedContactKeys = new Set(["discordusername"]);

const emailSchema = z
  .string()
  .trim()
  .max(191)
  .email()
  .transform((value) => value.toLowerCase());

const displayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a display name.")
  .max(120, "Display name is too long.");

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

export type NormalizedContact = {
  displayName: string;
  email: string;
  discordUsername: string | null;
  rsn: string | null;
};

export function assertNoCredentialLikeKeys(value: unknown, path = "request") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertNoCredentialLikeKeys(item, `${path}.${index}`),
    );
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^A-Za-z0-9_]/g, "_");
    if (
      !allowedContactKeys.has(normalizedKey.toLowerCase()) &&
      credentialKeyPattern.test(normalizedKey)
    ) {
      throw new CustomBuildSecurityError(
        "Credential-like request fields are not accepted.",
      );
    }
    assertNoCredentialLikeKeys(nested, `${path}.${key}`);
  }
}

export function normalizePlainText(input: string, maximumLength: number) {
  const text = input
    .normalize("NFKC")
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .replace(/\u0000/g, "")
    .trim();
  if (text.length > maximumLength) {
    throw new CustomBuildSecurityError(
      `Customer notes must be ${maximumLength.toLocaleString()} characters or fewer.`,
    );
  }
  if (/[<>]/.test(text)) {
    throw new CustomBuildSecurityError(
      "Use plain text only. HTML and script-like markup are not accepted.",
    );
  }
  if (credentialTextPattern.test(text)) {
    throw new CustomBuildSecurityError(
      "Do not include passwords, PINs, recovery answers or authenticator details.",
    );
  }
  return text || null;
}

export function normalizeContact(input: {
  displayName: unknown;
  email: unknown;
  discordUsername?: unknown;
  rsn?: unknown;
}): NormalizedContact {
  const displayName = displayNameSchema.parse(input.displayName);
  const email = emailSchema.parse(input.email);
  const discordUsername = discordSchema.parse(input.discordUsername ?? "");
  const rsnText = String(input.rsn ?? "").trim();
  const rsn = rsnText ? rsnSchema.parse(rsnText) : null;
  return { displayName, email, discordUsername, rsn };
}

export function hashSecret(value: string) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function createTrackingToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashSecret(token) };
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

type AttemptWindow = { count: number; resetAt: number };

const windows = new Map<string, AttemptWindow>();

export function checkCustomBuildRateLimit({
  key,
  maxAttempts = 12,
  windowMs = 15 * 60 * 1000,
  now = Date.now(),
}: {
  key: string;
  maxAttempts?: number;
  windowMs?: number;
  now?: number;
}) {
  const current = windows.get(key);
  if (!current || current.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
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

export function clearCustomBuildRateLimit(key: string) {
  windows.delete(key);
}
