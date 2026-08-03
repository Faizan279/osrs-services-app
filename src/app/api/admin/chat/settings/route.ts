import { NextRequest } from "next/server";
import { z } from "zod";

import { chatJson, requireChatActor } from "@/lib/chat/api";
import { sanitizeChatError } from "@/lib/chat/security";
import { getChatSettings, updateChatSettings } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  availabilityMode: z.enum(["OFFLINE", "ONLINE", "MAINTENANCE"]),
  publicLauncherEnabled: z.boolean(),
  offlineIntakeEnabled: z.boolean(),
  publicOnlineMessage: z.string().trim().min(1).max(500),
  publicOfflineMessage: z.string().trim().min(1).max(500),
  publicMaintenanceMessage: z.string().trim().min(1).max(500),
  maximumMessageLength: z.coerce.number().int().min(100).max(4000),
  maximumOpenConversationsPerGuest: z.coerce.number().int().min(1).max(10),
  maximumOpenConversationsPerCustomer: z.coerce.number().int().min(1).max(20),
  pollingFallbackIntervalSeconds: z.coerce.number().int().min(5).max(60),
  realtimeExpected: z.boolean(),
  needsClientReview: z.boolean(),
  expectedVersion: z.coerce.number().int().min(1),
});

export async function GET(request: NextRequest) {
  const { actor, response } = await requireChatActor(request);
  if (!actor) return response;
  try {
    if (
      actor.type !== "STAFF" ||
      !actor.capabilities.has("chat.settings.manage")
    ) {
      return chatJson(
        { ok: false, message: "Staff chat permission required." },
        403,
      );
    }
    const settings = await getChatSettings(prisma);
    return chatJson({ ok: true, settings });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}

export async function PATCH(request: NextRequest) {
  const { actor, response } = await requireChatActor(request);
  if (!actor) return response;
  try {
    const parsed = settingsSchema.parse(await request.json());
    const settings = await updateChatSettings({
      prisma,
      actor,
      input: parsed,
      expectedVersion: parsed.expectedVersion,
    });
    return chatJson({ ok: true, settings });
  } catch (error) {
    const safe = sanitizeChatError(error);
    return chatJson({ ok: false, message: safe.message }, safe.status);
  }
}
