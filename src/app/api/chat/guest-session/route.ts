import { NextRequest } from "next/server";
import { z } from "zod";

import { chatJson, setChatCookie } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { createGuestChatSession } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const guestSessionSchema = z.object({
  displayName: z.unknown().optional(),
  supportCategory: z.unknown().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const parsed = guestSessionSchema.parse(await request.json());
    const session = await createGuestChatSession(prisma, parsed);
    return setChatCookie(
      chatJson({
        ok: true,
        session: {
          id: session.session.id,
          displayName: session.session.displayName,
          supportCategory: session.session.supportCategory,
        },
      }),
      session.cookie,
    );
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
