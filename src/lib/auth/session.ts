import "server-only";

import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { prisma } from "@/lib/db/prisma";
import { env } from "@/lib/env";

function hashToken(token: string) {
  return createHmac("sha256", env.AUTH_SECRET).update(token).digest("hex");
}

export async function createSession(
  userId: string,
  metadata: { ipAddress?: string; userAgent?: string } = {},
) {
  const rawToken = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      sessionToken: hashToken(rawToken),
      userId,
      expires,
      ipAddress: metadata.ipAddress?.slice(0, 64),
      userAgent: metadata.userAgent?.slice(0, 500),
    },
  });

  const cookieStore = await cookies();
  cookieStore.set(env.AUTH_SESSION_COOKIE, rawToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function deleteCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(env.AUTH_SESSION_COOKIE)?.value;
  if (rawToken) {
    await prisma.session.deleteMany({
      where: { sessionToken: hashToken(rawToken) },
    });
  }
  cookieStore.delete(env.AUTH_SESSION_COOKIE);
}

export async function getCurrentSession() {
  const cookieStore = await cookies();
  const rawToken = cookieStore.get(env.AUTH_SESSION_COOKIE)?.value;
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
    session.expires <= new Date() ||
    session.user.status !== "ACTIVE"
  ) {
    if (session) await prisma.session.delete({ where: { id: session.id } });
    cookieStore.delete(env.AUTH_SESSION_COOKIE);
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
    },
    roles: session.user.roles.map(({ role }) => role.key),
    capabilities,
  };
}
