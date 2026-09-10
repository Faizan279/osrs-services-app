import { Headphones, MessageCircle, MonitorPlay, Send } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";

import { StoreTrustStrip } from "@/components/store-trust-strip";
import { BrandLogo } from "@/components/brand-logo";
import { getDiscordHref } from "@/config/public-navigation";

const columns = [
  {
    title: "Quick links",
    links: [
      ["Home", "/"],
      ["Services", "/services"],
      ["Accounts", "/accounts"],
      ["Offers", "/services?featured=1"],
      ["About us", "/support"],
      ["Contact", "/support"],
    ],
  },
  {
    title: "Our services",
    links: [
      ["Inferno", "/infernal"],
      ["Quiver service", "/services"],
      ["Bossing", "/bossing"],
      ["Raids", "/bossing"],
      ["Skilling", "/skills"],
      ["Questing", "/quests"],
      ["Diaries", "/diaries"],
      ["Misc Gathering", "/misc-gathering"],
    ],
  },
  {
    title: "Support",
    links: [
      ["Discord support", getDiscordHref()],
      ["Terms of service", "/terms"],
      ["Privacy policy", "/privacy"],
      ["Refund policy", "/refund-policy"],
      ["FAQ", "/support"],
    ],
  },
] as const;

const socialLinks: ReadonlyArray<{
  icon: LucideIcon;
  href: string;
  label: string;
}> = [
  { icon: MessageCircle, href: getDiscordHref(), label: "Discord" },
  { icon: MonitorPlay, href: "/support", label: "Video updates" },
  { icon: Headphones, href: "/support", label: "Support" },
];

export function PublicFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="reference-footer border-primary/20 border-t bg-[#030303]">
      <StoreTrustStrip />
      <div className="mx-auto max-w-7xl px-5 pt-10 pb-6 sm:px-8">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_1.8fr_1fr]">
          <div>
            <Link
              href="/"
              aria-label="OSRS Services home"
              className="inline-block"
            >
              <BrandLogo forceRed className="w-52" />
            </Link>
            <p className="text-text-secondary mt-4 max-w-sm text-sm leading-6">
              Professional OSRS services with clear estimates, secure
              communication and visible order progress.
            </p>
            <div className="mt-5 flex gap-2">
              {socialLinks.map(({ icon: Icon, href, label }) => (
                <Link
                  key={label}
                  href={href}
                  aria-label={label}
                  className="border-border bg-surface-2 hover:border-primary hover:text-primary flex size-9 items-center justify-center rounded-full border transition"
                >
                  <Icon className="size-4" aria-hidden="true" />
                </Link>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
            {columns.map((column) => (
              <div key={column.title}>
                <h2 className="display-type text-sm uppercase">
                  {column.title}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {column.links.map(([label, href]) => (
                    <li key={label}>
                      <Link
                        href={href}
                        className="text-text-muted hover:text-primary text-xs transition"
                      >
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <div>
            <h2 className="display-type text-sm uppercase">Newsletter</h2>
            <p className="text-text-muted mt-4 text-xs leading-5">
              Ask support to add you to launch offers and product updates.
            </p>
            <form action="/support" method="get" className="mt-4 flex">
              <label className="sr-only" htmlFor="footer-email">
                Email address
              </label>
              <input
                id="footer-email"
                name="email"
                type="email"
                required
                placeholder="Enter your email"
                className="border-border bg-surface-1 focus:border-primary min-w-0 flex-1 border px-3 text-xs outline-none"
              />
              <button
                type="submit"
                aria-label="Contact support about newsletter updates"
                className="bg-primary hover:bg-primary-hover flex size-11 items-center justify-center text-white transition"
              >
                <Send className="size-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        </div>
        <div className="border-border text-text-muted mt-9 flex flex-col gap-2 border-t pt-5 text-[0.65rem] sm:flex-row sm:justify-between">
          <p>© {year} OSRS Services. All rights reserved.</p>
          <p>
            Not affiliated with Jagex. RuneScape is a trademark of its
            respective owner.
          </p>
        </div>
      </div>
    </footer>
  );
}
