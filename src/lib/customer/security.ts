import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/db/prisma";
import {
  privateIdentityKey,
  requestIdentity,
} from "@/lib/eligibility/rate-limit";
import { rsnSchema } from "@/lib/eligibility/rsn";
import { env } from "@/lib/env";

export class CustomerAccountError extends Error {
  status = 400;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "CustomerAccountError";
    this.status = status;
  }
}

const credentialKeyPattern =
  /(password|passcode|credential|login|email_password|emailpassword|bank_pin|bankpin|pin|recovery|recoveries|recoveryanswer|recoveryquestion|authenticator|twofactor|two_factor|2fa|backup_code|backupcodes|cookie|session|token|secret|seed|cvv|card|wallet|private_key|recovery_phrase)$/i;

const credentialTextPattern =
  /(bank\s*pin|recovery\s*(answer|question)|authenticator\s*(secret|seed)|backup\s*code|session\s*token|browser\s*cookie|card\s*number|cvv|wallet\s*(seed|phrase)|private\s*key)/i;

export const customerEmailSchema = z
  .string()
  .trim()
  .max(191)
  .email("Enter a valid email address.")
  .transform((value) => value.toLowerCase());

export const customerDisplayNameSchema = z
  .string()
  .trim()
  .min(1, "Enter a display name.")
  .max(120, "Display name is too long.")
  .refine((value) => !/[<>]/.test(value), "Use plain text only.");

export const customerDiscordSchema = z
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

export const customerTimezoneSchema = z
  .string()
  .trim()
  .max(80)
  .optional()
  .or(z.literal(""))
  .transform((value) => value || null)
  .pipe(
    z
      .string()
      .regex(/^[A-Za-z0-9_+./-]{1,80}$/, "Use a valid timezone.")
      .nullable(),
  );

export const customerLocaleSchema = z
  .string()
  .trim()
  .max(16)
  .optional()
  .or(z.literal(""))
  .transform((value) => value || null)
  .pipe(
    z
      .string()
      .regex(/^[A-Za-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/, "Use a valid locale.")
      .nullable(),
  );

export const customerPasswordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(256, "Password is too long.");

export function normalizeOptionalRsn(value: unknown) {
  const text = String(value ?? "").trim();
  return text ? rsnSchema.parse(text) : null;
}

export function assertNoCredentialLikeFields(value: unknown) {
  if (Array.isArray(value)) {
    value.forEach(assertNoCredentialLikeFields);
    return;
  }
  if (typeof value !== "object" || value === null) return;
  for (const [key, nested] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^A-Za-z0-9_]/g, "_");
    if (credentialKeyPattern.test(normalizedKey)) {
      throw new CustomerAccountError(
        "Credential-like customer fields are not accepted.",
      );
    }
    if (typeof nested === "string" && credentialTextPattern.test(nested)) {
      throw new CustomerAccountError(
        "Do not include passwords, PINs, recovery answers, card data or secrets.",
      );
    }
    assertNoCredentialLikeFields(nested);
  }
}

export function createCustomerToken() {
  return randomBytes(32).toString("base64url");
}

export function hashCustomerToken(value: string) {
  return createHmac("sha256", env.AUTH_SECRET)
    .update(value, "utf8")
    .digest("hex");
}

export function isValidCustomerToken(value: string | undefined | null) {
  return Boolean(value && /^[A-Za-z0-9_-]{43}$/.test(value));
}

export function timingSafeTokenHashEquals(left: string, right: string) {
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

export function safeJson<T>(value: T) {
  return JSON.parse(
    JSON.stringify(value, (_key, nested) =>
      typeof nested === "bigint" ? nested.toString() : nested,
    ),
  ) as T;
}

export function safeHash(value: string | null | undefined) {
  if (!value) return null;
  return createHmac("sha256", env.AUTH_SECRET)
    .update(value.slice(0, 500), "utf8")
    .digest("hex");
}

export async function consumeCustomerRateLimit({
  identity,
  action,
  limit,
  windowSeconds = 15 * 60,
}: {
  identity: string;
  action: string;
  limit: number;
  windowSeconds?: number;
}) {
  const now = new Date();
  const windowMs = windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs * 2);
  const identityKey = privateIdentityKey(`customer:${identity}`);
  const bucket = await prisma.publicRateLimitBucket.upsert({
    where: {
      identityKey_actionKey_windowStart: {
        identityKey,
        actionKey: action.slice(0, 80),
        windowStart,
      },
    },
    create: {
      identityKey,
      actionKey: action.slice(0, 80),
      windowStart,
      expiresAt,
      count: 1,
    },
    update: { count: { increment: 1 }, expiresAt },
  });
  void prisma.publicRateLimitBucket
    .deleteMany({ where: { expiresAt: { lt: now } } })
    .catch(() => undefined);
  return bucket.count <= limit;
}

export function requestCustomerIdentity(request: NextRequest) {
  const { identity, setCookie } = requestIdentity(request);
  return {
    identity,
    setCookie,
    ipAddress:
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip")?.trim() ??
      "local",
    userAgent: request.headers.get("user-agent") ?? undefined,
  };
}
