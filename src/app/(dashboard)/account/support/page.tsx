import { MessageCircle } from "lucide-react";
import type { Metadata } from "next";

import { ChatPanel, ChatSafetyPanel } from "@/components/chat-live";
import { Badge } from "@/components/ui/badge";
import { requireCustomer } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Customer support",
  robots: { index: false, follow: false },
};

export default async function CustomerSupportPage() {
  await requireCustomer("/account/support");

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Badge variant="info">Task 015</Badge>
          <h1 className="display-type mt-4 text-4xl font-black uppercase sm:text-5xl">
            Support
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl text-sm leading-6">
            Customer chat uses your customer session and only shows
            conversations owned by this account.
          </p>
        </div>
        <span className="border-primary/25 bg-primary-muted/45 text-primary flex size-12 items-center justify-center rounded-xl border">
          <MessageCircle className="size-5" aria-hidden="true" />
        </span>
      </div>
      <div className="mt-6">
        <ChatSafetyPanel />
      </div>
      <div className="mt-8">
        <ChatPanel customer />
      </div>
    </main>
  );
}
