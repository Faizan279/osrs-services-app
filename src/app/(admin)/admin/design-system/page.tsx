import { Badge } from "@/components/ui/badge";
import { DesignSystemShowcase } from "@/components/design-system-showcase";
import { requireCapability } from "@/lib/auth/guards";

export const metadata = { title: "Design system" };

export default async function DesignSystemPage() {
  await requireCapability("design_system.view", "/admin/design-system");
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <Badge variant="success">Protected showcase</Badge>
      <h1 className="display-type mt-5 text-4xl font-black uppercase sm:text-5xl">
        OSRS Services design system
      </h1>
      <p className="text-text-secondary mt-3 max-w-2xl text-base leading-7">
        Foundation tokens and reusable interaction primitives. This is not a
        homepage or business-module implementation.
      </p>
      <div className="mt-10">
        <DesignSystemShowcase />
      </div>
    </main>
  );
}
