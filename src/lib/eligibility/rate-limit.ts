import "server-only";

import { createHmac } from "node:crypto";
import type { NextRequest } from "next/server";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

type RateLimitStore = Pick<
  typeof prisma.publicRateLimitBucket,
  "upsert" | "deleteMany"
>;

export function requestIdentity(request: NextRequest) {
  const trustedIp = env.RSN_TRUST_PROXY_IP_HEADER
    ? request.headers.get("x-real-ip")?.slice(0, 64)
    : null;
  return trustedIp
    ? `ip:${trustedIp}`
    : `client:${request.headers.get("user-agent")?.slice(0, 300) ?? "unknown"}:${
        request.headers.get("accept-language")?.slice(0, 80) ?? "unknown"
      }`;
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
