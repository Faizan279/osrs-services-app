import { NextRequest } from "next/server";

import { chatJson, requireChatActor } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { getConversation } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { actor, response } = await requireChatActor(request);
  if (!actor) return response;
  try {
    const { conversationId } = await context.params;
    const conversation = await getConversation(prisma, actor, conversationId);
    return chatJson({ ok: true, conversation });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
