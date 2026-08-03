import { createHmac } from "node:crypto";

import type { PrismaClient } from "@/generated/prisma/client";
import { chatGuestCookieName } from "@/lib/chat/config";
import {
  ChatError,
  hashChatToken,
  isValidGuestChatToken,
  timingSafeHashEquals,
} from "@/lib/chat/security";

type SessionAudienceValue = "STAFF" | "CUSTOMER";

export type ChatActor =
  | {
      type: "GUEST";
      guestSessionId: string;
      displayName: string | null;
      capabilities: ReadonlySet<string>;
    }
  | {
      type: "CUSTOMER";
      userId: string;
      email: string;
      name: string | null;
      capabilities: ReadonlySet<string>;
    }
  | {
      type: "STAFF";
      userId: string;
      email: string;
      name: string | null;
      capabilities: ReadonlySet<string>;
    };

function authSecret() {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be configured for chat authentication.");
  }
  return secret;
}

function hashSessionToken(token: string) {
  return createHmac("sha256", authSecret()).update(token).digest("hex");
}

function cookieNameForAudience(audience: SessionAudienceValue) {
  return audience === "CUSTOMER"
    ? (process.env.CUSTOMER_SESSION_COOKIE ?? "osrs_customer_session")
    : (process.env.AUTH_SESSION_COOKIE ?? "osrs_session");
}

export function parseCookieHeader(header: string | undefined | null) {
  const cookies = new Map<string, string>();
  for (const part of (header ?? "").split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (!rawName || !rawValue.length) continue;
    cookies.set(rawName, decodeURIComponent(rawValue.join("=")));
  }
  return cookies;
}

export async function loadSessionActorFromRawToken({
  prisma,
  rawToken,
  audience,
}: {
  prisma: PrismaClient;
  rawToken: string | undefined | null;
  audience: SessionAudienceValue;
}): Promise<ChatActor | null> {
  if (!rawToken) return null;
  const session = await prisma.session.findUnique({
    where: { sessionToken: hashSessionToken(rawToken) },
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
    session.user.accountType !== audience
  ) {
    return null;
  }
  const capabilities = new Set(
    session.user.roles.flatMap(({ role }) =>
      role.permissions.map(({ permission }) => permission.key),
    ),
  );
  return {
    type: audience,
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    capabilities,
  };
}

export async function loadGuestActorFromRawToken({
  prisma,
  rawToken,
}: {
  prisma: PrismaClient;
  rawToken: string | undefined | null;
}): Promise<ChatActor | null> {
  if (!rawToken || !isValidGuestChatToken(rawToken)) return null;
  const tokenHash = hashChatToken(rawToken);
  const session = await prisma.chatGuestSession.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      tokenHash: true,
      displayName: true,
      status: true,
      expiresAt: true,
      revokedAt: true,
    },
  });
  if (
    !session ||
    !timingSafeHashEquals(session.tokenHash, tokenHash) ||
    session.status !== "ACTIVE" ||
    session.revokedAt ||
    session.expiresAt <= new Date()
  ) {
    return null;
  }
  await prisma.chatGuestSession
    .update({ where: { id: session.id }, data: { lastSeenAt: new Date() } })
    .catch(() => undefined);
  return {
    type: "GUEST",
    guestSessionId: session.id,
    displayName: session.displayName,
    capabilities: new Set(),
  };
}

async function featureEnabled(prisma: PrismaClient, key: string) {
  const flag = await prisma.featureFlag.findUnique({
    where: { key },
    select: { enabled: true },
  });
  return Boolean(flag?.enabled);
}

export async function authenticateChatActorFromCookieHeader({
  prisma,
  cookieHeader,
  requireRealtime,
}: {
  prisma: PrismaClient;
  cookieHeader: string | undefined | null;
  requireRealtime?: boolean;
}) {
  if (
    requireRealtime &&
    !(await featureEnabled(prisma, "chat_realtime_enabled"))
  ) {
    throw new ChatError("Real-time chat is disabled.", 403);
  }
  const cookies = parseCookieHeader(cookieHeader);
  const staff = await loadSessionActorFromRawToken({
    prisma,
    rawToken: cookies.get(cookieNameForAudience("STAFF")),
    audience: "STAFF",
  });
  if (staff) return staff;
  const customer = await loadSessionActorFromRawToken({
    prisma,
    rawToken: cookies.get(cookieNameForAudience("CUSTOMER")),
    audience: "CUSTOMER",
  });
  if (customer) return customer;
  const guest = await loadGuestActorFromRawToken({
    prisma,
    rawToken: cookies.get(chatGuestCookieName()),
  });
  if (guest) return guest;
  throw new ChatError("Chat authentication required.", 401);
}
