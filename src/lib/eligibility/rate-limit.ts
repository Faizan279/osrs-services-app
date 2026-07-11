import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { isIP } from "node:net";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

type RateLimitStore = Pick<
  typeof prisma.publicRateLimitBucket,
  "upsert" | "deleteMany"
>;

export const PUBLIC_CLIENT_COOKIE = "osrs_public_client";
export const PUBLIC_CLIENT_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

const publicClientTokenPattern = /^[A-Za-z0-9_-]{43}$/;

export type PublicClientCookie = {
  name: typeof PUBLIC_CLIENT_COOKIE;
  value: string;
  options: {
    httpOnly: true;
    sameSite: "lax";
    secure: boolean;
    path: "/";
    maxAge: number;
  };
};

export function isValidPublicClientToken(value: string | undefined | null) {
  return Boolean(value && publicClientTokenPattern.test(value));
}

export function createPublicClientToken() {
  return randomBytes(32).toString("base64url");
}

function publicClientCookie(value: string): PublicClientCookie {
  return {
    name: PUBLIC_CLIENT_COOKIE,
    value,
    options: {
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production",
      path: "/",
      maxAge: PUBLIC_CLIENT_COOKIE_MAX_AGE_SECONDS,
    },
  };
}

export function trustedIpIdentity(request: NextRequest) {
  if (!env.RSN_TRUST_PROXY_IP_HEADER) return null;
  const value = request.headers.get("x-real-ip")?.trim();
  if (!value || value.length > 64 || !isIP(value)) return null;
  return value;
}

export function requestIdentity(request: NextRequest): {
  identity: string;
  setCookie: PublicClientCookie | null;
} {
  const existingToken = request.cookies.get(PUBLIC_CLIENT_COOKIE)?.value;
  const token = isValidPublicClientToken(existingToken)
    ? existingToken!
    : createPublicClientToken();
  const trustedIp = trustedIpIdentity(request);
  return {
    identity: trustedIp ? `client:${token}:ip:${trustedIp}` : `client:${token}`,
    setCookie: token === existingToken ? null : publicClientCookie(token),
  };
}

export function privateIdentityKey(identity: string) {
  return createHmac("sha256", env.ELIGIBILITY_HMAC_SECRET)
    .update(identity)
    .digest("hex");
}

export async function consumePublicLookupLimit(
  identity: string,
  now = new Date(),
  store: RateLimitStore = prisma.publicRateLimitBucket,
) {
  const windowMs = env.RSN_RATE_LIMIT_WINDOW_SECONDS * 1000;
  const windowStart = new Date(Math.floor(now.getTime() / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs * 2);
  const identityKey = privateIdentityKey(identity);
  const bucket = await store.upsert({
    where: {
      identityKey_actionKey_windowStart: {
        identityKey,
        actionKey: "rsn-eligibility",
        windowStart,
      },
    },
    create: {
      identityKey,
      actionKey: "rsn-eligibility",
      windowStart,
      expiresAt,
      count: 1,
    },
    update: { count: { increment: 1 }, expiresAt },
  });
  void store
    .deleteMany({ where: { expiresAt: { lt: now } } })
    .catch(() => undefined);
  return bucket.count <= env.RSN_RATE_LIMIT_COUNT;
}
