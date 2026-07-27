import Link from "next/link";

import { GoldTradingEngine } from "@/components/gold-trading-engine";
import { Button } from "@/components/ui/button";
import { getDiscordHref } from "@/config/public-navigation";
import { requireCapability } from "@/lib/auth/guards";
import { getPublicGoldTradingService } from "@/lib/gold/server";

export const metadata = { title: "Gold preview" };
export const dynamic = "force-dynamic";

export default async function GoldPreviewPage() {
  await requireCapability("gold.view", "/admin/gold/preview");
  const engine = await getPublicGoldTradingService({
    categorySlug: "gold",
    serviceSlug: "gold-trading",
  });

  return (
    <main className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-10">
        <div className="mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-5 px-5 sm:px-8">
          <div>
            <p className="text-gold kicker-type">Admin preview</p>
            <h1 className="display-type mt-3 text-4xl">Gold engine preview</h1>
            <p className="text-text-secondary mt-3">
              Uses the same public component and server estimate endpoint as the
              customer service page.
            </p>
          </div>
          <Button asChild variant="secondary">
            <Link href="/admin/gold">Gold overview</Link>
          </Button>
        </div>
      </section>
      {engine ? (
        <GoldTradingEngine
          service={{
            id: engine.service.id,
            name: engine.service.name,
            content: engine.service.content,
            requirements: engine.service.requirements.map(
              ({ id, title, description, isRequired, verificationMode }) => ({
                id,
                title,
                description,
                isRequired,
                verificationMode,
              }),
            ),
          }}
          market={engine.market}
          presets={engine.presets}
          latestRevision={engine.latestRevision}
          featureEnabled={engine.featureEnabled}
          requestHref={getDiscordHref()}
        />
      ) : (
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <p className="border-warning/30 bg-warning/10 text-warning rounded-2xl border p-5 font-semibold">
            The seeded gold service is not available for preview yet.
          </p>
        </div>
      )}
    </main>
  );
}
