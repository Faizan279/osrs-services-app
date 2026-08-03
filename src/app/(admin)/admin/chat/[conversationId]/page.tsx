import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ChatAdminConversationPanel } from "@/components/chat-admin";
import type { AdminConversation } from "@/components/chat-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getConversation } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Support conversation" };

function serializable<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export default async function AdminChatConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const session = await requireCapability("chat.view", "/admin/chat");
  const actor = {
    type: "STAFF" as const,
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    capabilities: session.capabilities,
  };
  const { conversationId } = await params;
  const conversation = await getConversation(
    prisma,
    actor,
    conversationId,
  ).catch(() => null);
  if (!conversation) notFound();

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="mb-6">
        <Button asChild variant="secondary">
          <Link href="/admin/chat">Back to queue</Link>
        </Button>
      </div>
      <ChatAdminConversationPanel
        initialConversation={serializable<AdminConversation>(conversation)}
        staffUserId={session.user.id}
      />
    </main>
  );
}
