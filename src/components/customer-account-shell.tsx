import {
  Bell,
  ClipboardList,
  KeyRound,
  LayoutDashboard,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { BrandLogo } from "@/components/brand-logo";
import { CustomerLogoutButton } from "@/components/customer-account-forms";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/account", label: "Dashboard", icon: LayoutDashboard },
  { href: "/account/orders", label: "Orders", icon: ClipboardList },
  { href: "/account/profile", label: "Profile", icon: UserRound },
  { href: "/account/security", label: "Security", icon: KeyRound },
  { href: "/account/notifications", label: "Notifications", icon: Bell },
];

export function CustomerAccountShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { name: string | null; email: string };
}) {
  return (
    <div className="bg-background min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="border-border bg-surface-1/95 border-b shadow-2xl shadow-black/25 backdrop-blur lg:fixed lg:inset-y-0 lg:z-20 lg:w-72 lg:border-r lg:border-b-0">
        <div className="flex h-20 items-center justify-between px-5 lg:h-24 lg:px-6">
          <Link href="/account" aria-label="Customer dashboard">
            <BrandLogo priority className="w-40 lg:w-44" />
          </Link>
          <span className="border-primary/25 bg-primary-muted/50 text-primary flex size-9 items-center justify-center rounded-xl border lg:hidden">
            <ShieldCheck aria-label="Protected" className="size-4" />
          </span>
        </div>

        <div className="hidden px-7 pb-3 lg:block">
          <p className="text-gold kicker-type">Customer portal</p>
          <p className="text-text-muted mt-2 text-xs leading-5">
            Orders, account security, and in-app updates.
          </p>
        </div>

        <nav
          aria-label="Customer account navigation"
          className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-1.5 lg:overflow-visible lg:px-5 lg:pb-0"
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "focus-visible:ring-primary flex min-h-11 shrink-0 items-center gap-3 rounded-xl border px-4 text-sm font-semibold transition focus-visible:ring-2 focus-visible:outline-none lg:w-full",
                  "text-text-secondary hover:border-border hover:bg-surface-2 hover:text-text-primary border-transparent",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-border bg-surface-2/65 mx-4 mb-4 flex items-center justify-between gap-3 rounded-xl border px-3 py-3 lg:hidden">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {user.name ?? "Customer"}
            </p>
            <p className="screenshot-sensitive text-text-muted truncate text-xs">
              {user.email}
            </p>
          </div>
          <CustomerLogoutButton />
        </div>

        <div className="border-border bg-background/25 absolute inset-x-0 bottom-0 hidden border-t p-4 lg:block">
          <div className="border-border bg-surface-2/65 mb-3 rounded-xl border px-3 py-3">
            <p className="truncate text-sm font-semibold">
              {user.name ?? "Customer"}
            </p>
            <p className="screenshot-sensitive text-text-muted truncate text-xs">
              {user.email}
            </p>
          </div>
          <CustomerLogoutButton />
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="border-border bg-background/75 sticky top-0 z-10 hidden h-20 items-center justify-between border-b px-8 backdrop-blur-xl lg:flex">
          <div className="flex items-center gap-3">
            <span className="text-text-muted text-xs font-bold tracking-[0.16em] uppercase">
              OSRS Services
            </span>
            <span className="text-border-strong">/</span>
            <span className="text-sm font-semibold">Customer account</span>
          </div>
          <CustomerLogoutButton />
        </header>
        <div className="admin-atmosphere">{children}</div>
      </div>
    </div>
  );
}

export function CustomerUnavailablePanel({ message }: { message: string }) {
  return (
    <main className="mx-auto min-h-screen max-w-3xl px-5 py-12 sm:px-8">
      <BrandLogo priority className="w-44" />
      <section className="surface-panel mt-12 rounded-2xl p-6 sm:p-8">
        <p className="text-gold kicker-type">Customer portal</p>
        <h1 className="display-type mt-4 text-4xl font-black uppercase">
          Account access unavailable
        </h1>
        <p className="text-text-secondary mt-4 text-sm leading-6">{message}</p>
      </section>
    </main>
  );
}
