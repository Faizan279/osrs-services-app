import { NextRequest } from "next/server";
import { z } from "zod";

import { chatJson, requireChatActor } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { assignConversation } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const assignmentSchema = z.object({
  assigneeId: z.string().trim().min(1).max(40).nullable().optional(),
  expectedVersion: z.coerce.number().int().min(1),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { actor, response } = await requireChatActor(request);
  if (!actor) return response;
  try {
    const parsed = assignmentSchema.parse(await request.json());
    const { conversationId } = await context.params;
    const conversation = await assignConversation({
      prisma,
      actor,
      conversationId,
      assigneeId: parsed.assigneeId ?? null,
      expectedVersion: parsed.expectedVersion,
    });
    return chatJson({ ok: true, conversation });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
