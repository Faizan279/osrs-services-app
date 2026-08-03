import { NextRequest } from "next/server";
import { z } from "zod";

import { chatJson, requireChatActor } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { changeConversationStatus } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const statusSchema = z.object({
  nextStatus: z.enum([
    "QUEUED",
    "ASSIGNED",
    "WAITING_FOR_SUPPORT",
    "WAITING_FOR_CUSTOMER",
    "RESOLVED",
    "CLOSED",
    "ARCHIVED",
    "SPAM",
  ]),
  expectedVersion: z.coerce.number().int().min(1),
  reasonCode: z.string().trim().max(80).optional(),
});

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string }> },
) {
  const { actor, response } = await requireChatActor(request);
  if (!actor) return response;
  try {
    const parsed = statusSchema.parse(await request.json());
    const { conversationId } = await context.params;
    const conversation = await changeConversationStatus({
      prisma,
      actor,
      conversationId,
      nextStatus: parsed.nextStatus,
      expectedVersion: parsed.expectedVersion,
      reasonCode: parsed.reasonCode,
    });
    return chatJson({ ok: true, conversation });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
