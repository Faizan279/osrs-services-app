import type { Metadata } from "next";
import { Coins } from "lucide-react";
import { notFound } from "next/navigation";

import { DirectServiceHero } from "@/components/direct-service-hero";
import { GoldTradingEngine } from "@/components/gold-trading-engine";
import { getDiscordHref } from "@/config/public-navigation";
import { getPublicGoldTradingService } from "@/lib/gold/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Buy OSRS Gold",
  description:
    "Choose a configured OSRS gold amount or enter a custom amount, see the published rate and add the purchase to cart.",
  alternates: { canonical: "/gold" },
};

export default async function GoldPage() {
  const engine = await getPublicGoldTradingService({
    categorySlug: "gold",
    serviceSlug: "gold-trading",
  });
  if (!engine) notFound();
  return (
    <main id="main-content" className="service-storefront min-h-[70vh]">
      <DirectServiceHero
        eyebrow="Direct ordering · marketplace"
        title="Buy OSRS"
        accent="Gold"
        description="Choose your amount and see the current gold price."
        icon={Coins}
      />
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
    </main>
  );
}
