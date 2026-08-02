import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

type SessionAudienceValue = "STAFF" | "CUSTOMER";

function hashToken(token: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(token).digest("hex");
}

function cookieNameForAudience(audience: SessionAudienceValue) {
  return audience === "CUSTOMER"
    ? env.CUSTOMER_SESSION_COOKIE
    : env.AUTH_SESSION_COOKIE;
}

function accountTypeForAudience(audience: SessionAudienceValue) {
  return audience;
}

export async function createSession(
  userId: string,
  metadata: { ipAddress?: string; userAgent?: string } = {},
  options: { audience?: SessionAudienceValue; expiresAt?: Date } = {},
) {
  const audience = options.audience ?? "STAFF";
  const rawToken = randomBytes(32).toString("base64url");
  const expires =
    options.expiresAt ??
    new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      sessionToken: hashToken(rawToken),
      userId,
      audience,
      expires,
      ipAddress: metadata.ipAddress?.slice(0, 64),
      userAgent: metadata.userAgent?.slice(0, 500),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(cookieNameForAudience(audience), rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires,
  });

  return { id: session.id, expires };
}

export async function deleteCurrentSession(
  audience: SessionAudienceValue = "STAFF",
) {
  const cookieStore = await cookies();
  const cookieName = cookieNameForAudience(audience);
  const rawToken = cookieStore.get(cookieName)?.value;
  if (rawToken) {
    await prisma.session.updateMany({
      where: { sessionToken: hashToken(rawToken), audience },
      data: { revokedAt: new Date() },
    });
  }
  cookieStore.delete(cookieName);
}

export async function getCurrentSession(
  audience: SessionAudienceValue = "STAFF",
) {
  const cookieStore = await cookies();
  const cookieName = cookieNameForAudience(audience);
  const rawToken = cookieStore.get(cookieName)?.value;
  if (!rawToken) return null;

  const session = await prisma.session.findUnique({
    where: { sessionToken: hashToken(rawToken) },
    include: {
      user: {
        include: {
          roles: {
            include: {
              role: {
                include: {
                  permissions: { include: { permission: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (
    !session ||
    session.audience !== audience ||
    session.revokedAt ||
    session.expires <= new Date() ||
    session.user.status !== "ACTIVE" ||
    session.user.accountType !== accountTypeForAudience(audience)
  ) {
    if (session && !session.revokedAt) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
    cookieStore.delete(cookieName);
    return null;
  }

  const capabilities = new Set(
    session.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );

  return {
    id: session.id,
    expires: session.expires,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      accountType: session.user.accountType,
    },
    roles: session.user.roles.map(({ role }) => role.key),
    capabilities,
  };
}

export function getCurrentCustomerSession() {
  return getCurrentSession("CUSTOMER");
}

export function deleteCurrentCustomerSession() {
  return deleteCurrentSession("CUSTOMER");
}

export async function revokeCustomerSession({
  sessionId,
  userId,
}: {
  sessionId: string;
  userId: string;
}) {
  await prisma.session.updateMany({
    where: { id: sessionId, userId, audience: "CUSTOMER", revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeOtherCustomerSessions({
  userId,
  keepSessionId,
}: {
  userId: string;
  keepSessionId?: string | null;
}) {
  await prisma.session.updateMany({
    where: {
      userId,
      audience: "CUSTOMER",
      revokedAt: null,
      id: keepSessionId ? { not: keepSessionId } : undefined,
    },
    data: { revokedAt: new Date() },
  });
}
