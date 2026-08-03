import { NextRequest } from "next/server";
import { z } from "zod";

import { chatJson, requireChatActor } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { addInternalNote } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const noteSchema = z.object({
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
    const parsed = noteSchema.parse(await request.json());
    const { conversationId } = await context.params;
    const note = await addInternalNote({
      prisma,
      actor,
      conversationId,
      body: parsed.body,
      idempotencyKey: parsed.idempotencyKey,
    });
    return chatJson({ ok: true, note });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
