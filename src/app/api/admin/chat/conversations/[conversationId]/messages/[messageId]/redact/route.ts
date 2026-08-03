import { NextRequest } from "next/server";
import { z } from "zod";

import { chatJson, requireChatActor } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { redactMessage } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const redactionSchema = z.object({
  expectedVersion: z.coerce.number().int().min(1),
  reason: z.enum([
    "CREDENTIAL_SECRET",
    "EXTREME_PII",
    "PROHIBITED_CONTENT",
    "CLIENT_REQUEST",
    "STAFF_SAFETY_REVIEW",
  ]),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ conversationId: string; messageId: string }> },
) {
  const { actor, response } = await requireChatActor(request);
  if (!actor) return response;
  try {
    const parsed = redactionSchema.parse(await request.json());
    const { conversationId, messageId } = await context.params;
    const conversation = await redactMessage({
      prisma,
      actor,
      conversationId,
      messageId,
      expectedVersion: parsed.expectedVersion,
      reason: parsed.reason,
    });
    return chatJson({ ok: true, conversation });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
