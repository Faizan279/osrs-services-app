import { Sparkles } from "lucide-react";

import { DesignSystemShowcase } from "@/components/design-system-showcase";
import { Badge } from "@/components/ui/badge";
import { requireCapability } from "@/lib/auth/guards";

export const metadata = { title: "Design system" };

export default async function DesignSystemPage() {
  await requireCapability("design_system.view", "/admin/design-system");

  return (
    <main className="mx-auto max-w-[90rem] px-5 py-8 sm:px-8 lg:px-10 lg:py-12">
      <div className="flex flex-col gap-7 border-b border-white/5 pb-9 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="ornament-rule text-gold kicker-type">
            Interface foundation
          </p>
          <h1 className="display-type mt-5 max-w-3xl text-4xl leading-[1.06] text-balance text-white sm:text-5xl">
            OSRS Services design system
          </h1>
          <p className="text-text-secondary mt-4 max-w-2xl text-base leading-7">
            A focused visual language for secure marketplace operations—dark,
            precise, and built to keep information readable under pressure.
          </p>
        </div>
        <Badge
          variant="success"
          className="w-fit gap-2 px-3 py-2 tracking-[0.08em] uppercase"
        >
          <Sparkles className="size-3" aria-hidden="true" />
          Protected showcase
        </Badge>
      </div>

      <div className="mt-8">
        <DesignSystemShowcase />
      </div>
    </main>
  );
}
