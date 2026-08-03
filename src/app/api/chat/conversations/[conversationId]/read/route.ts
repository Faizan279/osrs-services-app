import { NextRequest } from "next/server";
import { z } from "zod";

import { chatJson, requireChatActor } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { markRead } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const readSchema = z.object({
  lastReadSequence: z.coerce.number().int().min(0),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { actor, response } = await requireChatActor(request);
  if (!actor) return response;
  try {
    const parsed = readSchema.parse(await request.json());
    const { conversationId } = await context.params;
    const cursor = await markRead({
      prisma,
      actor,
      conversationId,
      lastReadSequence: parsed.lastReadSequence,
    });
    return chatJson({ ok: true, cursor });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
