import type { ReactNode } from "react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";

export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-border/80 bg-background/80 border-b backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 lg:px-8">
          <Link href="/" aria-label="OSRS Services home">
            <BrandLogo priority className="w-40" />
          </Link>
          <Button asChild size="sm" variant="secondary">
            <Link href="/login">Staff sign in</Link>
          </Button>
        </div>
      </header>
      {children}
    </div>
  );
}
