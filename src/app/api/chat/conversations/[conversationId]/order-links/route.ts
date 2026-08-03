import { NextRequest } from "next/server";
import { z } from "zod";

import { chatJson, requireChatActor } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { linkOrderToConversation } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const linkSchema = z.object({
  orderId: z.string().trim().min(1).max(40).optional(),
  trackingToken: z.string().trim().min(32).max(120).optional(),
  idempotencyKey: z.string().trim().min(8).max(160).optional(),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { actor, response } = await requireChatActor(request);
  if (!actor) return response;
  try {
    const parsed = linkSchema.parse(await request.json());
    const { conversationId } = await context.params;
    const link = await linkOrderToConversation({
      prisma,
      actor,
      conversationId,
      orderId: parsed.orderId,
      trackingToken: parsed.trackingToken,
      idempotencyKey: parsed.idempotencyKey,
    });
    return chatJson({ ok: true, link });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
