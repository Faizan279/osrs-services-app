import type { Metadata } from "next";
import { Swords } from "lucide-react";
import { notFound } from "next/navigation";

import { BossingCalculatorEngine } from "@/components/bossing-calculator-engine";
import { DirectServiceHero } from "@/components/direct-service-hero";
import { getDiscordHref } from "@/config/public-navigation";
import {
  getCatalogueFeatureFlags,
  getPublicBossingCalculatorService,
} from "@/lib/catalogue/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OSRS Bossing Services",
  description:
    "Search an OSRS boss, choose kill count and service options, see the live server price and add the configuration to cart.",
  alternates: { canonical: "/bossing" },
};

export default async function BossingPage() {
  const [engine, flags] = await Promise.all([
    getPublicBossingCalculatorService({
      categorySlug: "bossing-pvm",
      serviceSlug: "pvm-support",
    }),
    getCatalogueFeatureFlags(),
  ]);
  if (!engine || !flags.bossing_calculator_enabled) notFound();

  return (
    <main id="main-content" className="service-storefront min-h-[70vh]">
      <DirectServiceHero
        eyebrow="Direct ordering · PvM"
        title="Bossing"
        accent="Services"
        description="Search the full enabled boss list, choose a method and kill count, then receive a server-authoritative total without an intermediate category page."
        icon={Swords}
      />
      <BossingCalculatorEngine
        service={engine.service}
        bosses={engine.bosses}
        rule={engine.rule}
        requestHref={getDiscordHref()}
        eligibilityEnabled={Boolean(flags.rsn_eligibility_enabled)}
      />
    </main>
  );
}
