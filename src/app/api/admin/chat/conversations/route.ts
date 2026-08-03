import { NextRequest } from "next/server";

import { chatJson, requireChatActor } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { listConversations } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

type ConversationFilter =
  "active" | "mine" | "unassigned" | "resolved" | "archived" | "spam";

const filters = new Set<ConversationFilter>([
  "active",
  "mine",
  "unassigned",
  "resolved",
  "archived",
  "spam",
]);

export async function GET(request: NextRequest) {
  const { actor, response } = await requireChatActor(request);
  if (!actor) return response;
  try {
    const rawFilter = request.nextUrl.searchParams.get("filter") ?? "active";
    const filter: ConversationFilter = filters.has(
      rawFilter as ConversationFilter,
    )
      ? (rawFilter as ConversationFilter)
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
