import type { ReactNode } from "react";

import { ChatLauncher } from "@/components/chat-live";
import { PublicFooter } from "@/components/public-footer";
import { PublicHeader } from "@/components/public-header";
import { getDiscordHref } from "@/config/public-navigation";

export default function PublicLayout({ children }: { children: ReactNode }) {
  const discordHref = getDiscordHref();

  return (
    <div className="min-h-screen overflow-x-clip">
      <a
        href="#main-content"
        className="bg-primary text-primary-foreground focus-visible:ring-background fixed top-3 left-3 z-[70] -translate-y-24 rounded-lg px-4 py-3 text-sm font-bold transition focus:translate-y-0 focus-visible:ring-2 focus-visible:outline-none"
      >
        Skip to main content
      </a>
      <PublicHeader discordHref={discordHref} />
      {children}
      <PublicFooter />
      <ChatLauncher />
    </div>
  );
}
