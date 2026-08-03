import { NextRequest } from "next/server";
import { z } from "zod";

import { chatJson, requireChatActor } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { sendMessage } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const messageSchema = z.object({
  body: z.unknown(),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { actor, response } = await requireChatActor(request);
  if (!actor) return response;
  try {
    const parsed = messageSchema.parse(await request.json());
    const { conversationId } = await context.params;
    const conversation = await sendMessage({
      prisma,
      actor,
      conversationId,
      body: parsed.body,
      idempotencyKey: parsed.idempotencyKey,
    });
    return chatJson({ ok: true, conversation });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
