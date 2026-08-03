import type { NextRequest, NextResponse } from "next/server";
import { NextResponse as ResponseFactory } from "next/server";

import type { ChatActor } from "@/lib/chat/auth";
import {
  authenticateChatActorFromCookieHeader,
  loadGuestActorFromRawToken,
  loadSessionActorFromRawToken,
} from "@/lib/chat/auth";
import { chatGuestCookieName } from "@/lib/chat/config";
import { ChatError, sanitizeChatError } from "@/lib/chat/security";
import { prisma } from "@/lib/db/prisma";

export function chatJson(body: unknown, status = 200) {
  return ResponseFactory.json(body, {
    status,
    headers: { "Cache-Control": "private, no-store, max-age=0" },
  });
}

export function setChatCookie(
  response: NextResponse,
  cookie: {
    name: string;
    value: string;
    options: Parameters<NextResponse["cookies"]["set"]>[2];
  } | null,
) {
  if (cookie) response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}

export async function authenticateChatRequest(request: NextRequest) {
  return authenticateChatActorFromCookieHeader({
    prisma,
    cookieHeader: request.headers.get("cookie"),
  });
}

export async function optionalChatActor(request: NextRequest) {
  const staffRaw = request.cookies.get(
    process.env.AUTH_SESSION_COOKIE ?? "osrs_session",
  )?.value;
  const staff = await loadSessionActorFromRawToken({
    prisma,
    rawToken: staffRaw,
    audience: "STAFF",
  });
  if (staff) return staff;

  const customerRaw = request.cookies.get(
    process.env.CUSTOMER_SESSION_COOKIE ?? "osrs_customer_session",
  )?.value;
  const customer = await loadSessionActorFromRawToken({
    prisma,
    rawToken: customerRaw,
    audience: "CUSTOMER",
  });
  if (customer) return customer;

  return loadGuestActorFromRawToken({
    prisma,
    rawToken: request.cookies.get(chatGuestCookieName())?.value,
  });
}

export async function requireChatActor(request: NextRequest) {
  try {
    const actor = await authenticateChatRequest(request);
    return { actor, response: null };
  } catch (error) {
    const safe = sanitizeChatError(error);
    return {
      actor: null,
      response: chatJson({ ok: false, message: safe.message }, safe.status),
    };
  }
}

export function requireStaffActor(actor: ChatActor | null) {
  if (!actor || actor.type !== "STAFF") {
    throw new ChatError("Staff chat permission required.", 403);
  }
  return actor;
}
