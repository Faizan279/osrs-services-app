import { ArrowUpRight, MessageCircle } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { footerNavigation, getDiscordHref } from "@/config/public-navigation";

export function PublicFooter() {
  const discordHref = getDiscordHref();
  const year = new Date().getFullYear();

  return (
    <footer className="border-border border-t bg-[#020a0d]">
      <div className="mx-auto max-w-7xl px-5 pt-12 pb-7 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.05fr_2.3fr]">
          <div className="max-w-sm">
            <Link
              href="/"
              aria-label="OSRS Services home"
              className="focus-visible:ring-primary inline-block rounded-lg focus-visible:ring-2 focus-visible:outline-none"
            >
              <BrandLogo className="w-48" />
            </Link>
            <p className="text-text-secondary mt-5 text-sm leading-7">
              Professional OSRS services with clear estimates, visible order
              progress and privacy-conscious handling.
            </p>
            <div className="border-primary/15 bg-primary/5 mt-6 inline-flex rounded-xl border p-1.5">
              <Link
                href={discordHref}
                className="text-primary hover:text-primary-hover focus-visible:ring-primary inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                Discord support
                <ArrowUpRight aria-hidden="true" className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-4">
            {Object.entries(footerNavigation).map(([group, links]) => (
              <div key={group}>
                <h2 className="text-text-primary text-sm font-bold capitalize">
                  {group}
                </h2>
                <ul className="mt-4 space-y-3">
                  {links.map((link) => (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        className="text-text-muted hover:text-primary focus-visible:ring-primary inline-flex min-h-7 items-center rounded text-sm transition focus-visible:ring-2 focus-visible:outline-none"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div
          id="legal-note"
          className="border-border text-text-muted mt-12 flex flex-col gap-3 border-t pt-6 text-xs leading-5 sm:flex-row sm:items-center sm:justify-between"
        >
          <p>© {year} OSRS Services. All rights reserved.</p>
          <p className="max-w-2xl sm:text-right">
            Legal destinations are placeholders for later project tasks. OSRS
            Services is not affiliated with Jagex. RuneScape is a trademark of
            its respective owner.
          </p>
        </div>
      </div>
    </footer>
  );
}
