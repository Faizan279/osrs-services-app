import { MessageSquare } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import {
  ChatConversationList,
  ChatSettingsForm,
} from "@/components/chat-admin";
import type { AdminConversation, ChatSettings } from "@/components/chat-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminChatDashboard, listConversations } from "@/lib/chat/service";
import { prisma } from "@/lib/db/prisma";

export const metadata: Metadata = { title: "Admin support chat" };

function asStaffActor(session: Awaited<ReturnType<typeof requireCapability>>) {
  return {
    type: "STAFF" as const,
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    capabilities: session.capabilities,
  };
}

type ConversationFilter =
  "active" | "mine" | "unassigned" | "resolved" | "archived" | "spam";

function serializable<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function normalizeFilter(value: string | undefined): ConversationFilter {
  return ["mine", "unassigned", "resolved", "archived", "spam"].includes(
    value ?? "",
  )
    ? (value as ConversationFilter)
    : "active";
}

export default async function AdminChatPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const session = await requireCapability("chat.view", "/admin/chat");
  const actor = asStaffActor(session);
  const { filter: rawFilter } = await searchParams;
  const filter = normalizeFilter(rawFilter);
  const dashboard = await getAdminChatDashboard(prisma, actor);
  const conversations = await listConversations({
    prisma,
    actor,
    filter,
  });

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Badge variant="info">Task 015</Badge>
          <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
            Support chat
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
            Queue, assignment, transcript, internal note and availability
            foundation for custom live chat.
          </p>
        </div>
        <span className="border-primary/25 bg-primary-muted/45 text-primary flex size-12 items-center justify-center rounded-xl border">
          <MessageSquare className="size-5" aria-hidden="true" />
        </span>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <article className="surface-panel rounded-xl p-5">
          <p className="text-text-muted text-xs font-bold uppercase">Active</p>
          <p className="mt-2 text-3xl font-black">{dashboard.activeCount}</p>
        </article>
        <article className="surface-panel rounded-xl p-5">
          <p className="text-text-muted text-xs font-bold uppercase">
            Unassigned
          </p>
          <p className="mt-2 text-3xl font-black">
            {dashboard.unassignedCount}
          </p>
        </article>
        <article className="surface-panel rounded-xl p-5">
          <p className="text-text-muted text-xs font-bold uppercase">Mine</p>
          <p className="mt-2 text-3xl font-black">{dashboard.mineCount}</p>
        </article>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_25rem]">
        <div>
          <div className="mb-4 flex flex-wrap gap-2">
            {[
              "active",
              "mine",
              "unassigned",
              "resolved",
              "archived",
              "spam",
            ].map((item) => (
              <Button
                key={item}
                asChild
                variant={filter === item ? "primary" : "secondary"}
                size="sm"
              >
                <Link href={`/admin/chat?filter=${item}`}>{item}</Link>
              </Button>
            ))}
          </div>
          <ChatConversationList
            conversations={serializable<AdminConversation[]>(conversations)}
          />
        </div>
        <aside className="border-border bg-surface-1 self-start rounded-xl border p-5">
          <h2 className="text-xl font-bold">Chat settings</h2>
          <p className="text-text-muted mt-2 text-sm">
            Seeded values remain offline and marked for client review until
            deliberately changed.
          </p>
          <div className="mt-5">
            <ChatSettingsForm
              settings={serializable<ChatSettings>(dashboard.settings)}
            />
          </div>
        </aside>
      </section>
    </main>
  );
}
