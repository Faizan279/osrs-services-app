import { Blocks, LayoutDashboard, LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/actions";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export function AdminShell({
  children,
  user,
}: {
  children: ReactNode;
  user: { name: string | null; email: string };
}) {
  return (
    <div className="bg-background min-h-screen lg:grid lg:grid-cols-[17rem_1fr]">
      <aside className="border-border bg-surface-1 border-b lg:fixed lg:inset-y-0 lg:w-[17rem] lg:border-r lg:border-b-0">
        <div className="flex h-20 items-center justify-between px-5 lg:px-6">
          <Link href="/admin" aria-label="Admin overview">
            <BrandLogo priority className="w-40" />
          </Link>
          <ShieldCheck
            aria-label="Protected"
            className="text-primary size-5 lg:hidden"
          />
        </div>
        <nav
          aria-label="Admin navigation"
          className="flex gap-2 overflow-x-auto px-4 pb-4 lg:block lg:space-y-1 lg:overflow-visible lg:pb-0"
        >
          <Button
            asChild
            variant="ghost"
            className="shrink-0 justify-start lg:w-full"
          >
            <Link href="/admin">
              <LayoutDashboard className="size-4" />
              Overview
            </Link>
          </Button>
          <Button
            asChild
            variant="ghost"
            className="shrink-0 justify-start lg:w-full"
          >
            <Link href="/admin/design-system">
              <Blocks className="size-4" />
              Design system
            </Link>
          </Button>
        </nav>
        <div className="border-border hidden border-t p-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p className="truncate px-3 text-sm font-semibold">
            {user.name ?? "Staff member"}
          </p>
          <p className="text-text-muted truncate px-3 pb-3 text-xs">
            {user.email}
          </p>
          <form action={logoutAction}>
            <Button
              type="submit"
              variant="ghost"
              className="w-full justify-start"
            >
              <LogOut className="size-4" />
              Sign out
            </Button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 lg:col-start-2">
        <header className="border-border hidden h-20 items-center justify-between border-b px-8 lg:flex">
          <p className="text-text-muted text-sm font-bold tracking-[0.18em] uppercase">
            Administration
          </p>
          <span className="border-success/30 bg-success/10 text-success inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold">
            <span className="bg-success size-1.5 rounded-full" />
            Secure session
          </span>
        </header>
        {children}
      </div>
    </div>
  );
}
