import { NextRequest } from "next/server";
import { z } from "zod";

import { chatJson, optionalChatActor, setChatCookie } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import {
  createConversation,
  createGuestChatSession,
  listConversations,
} from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const createConversationSchema = z.object({
  initialMessage: z.unknown(),
  displayName: z.unknown().optional(),
  supportCategory: z.unknown().optional(),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const actor = await optionalChatActor(request);
    if (!actor) return chatJson({ ok: true, conversations: [] });
    const filter =
      request.nextUrl.searchParams.get("filter") === "resolved"
        ? "resolved"
        : "active";
    const conversations = await listConversations({
      prisma,
      actor,
      filter,
    });
    return chatJson({ ok: true, conversations });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}

export async function POST(request: NextRequest) {
  try {
    const parsed = createConversationSchema.parse(await request.json());
    let actor = await optionalChatActor(request);
    let cookie:
      Awaited<ReturnType<typeof createGuestChatSession>>["cookie"] | null =
      null;
    if (!actor) {
      const guest = await createGuestChatSession(prisma, {
        displayName: parsed.displayName,
        supportCategory: parsed.supportCategory,
      });
      actor = guest.actor;
      cookie = guest.cookie;
    }
    const conversation = await createConversation({
      prisma,
      actor,
      initialMessage: parsed.initialMessage,
      displayName: parsed.displayName,
      supportCategory: parsed.supportCategory,
      idempotencyKey: parsed.idempotencyKey,
    });
    return setChatCookie(chatJson({ ok: true, conversation }), cookie);
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
