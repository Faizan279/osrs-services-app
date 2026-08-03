import { chatJson } from "@/lib/chat/api";
import { getPublicChatAvailability } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const availability = await getPublicChatAvailability(prisma);
  return chatJson({ ok: true, availability });
}
