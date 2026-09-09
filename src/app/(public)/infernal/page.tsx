import type { Metadata } from "next";
import { Flame } from "lucide-react";
import { notFound } from "next/navigation";

import { DirectServiceHero } from "@/components/direct-service-hero";
import { PremiumConfiguratorEngine } from "@/components/premium-configurator-engine";
import { getDiscordHref } from "@/config/public-navigation";
import {
  getCatalogueFeatureFlags,
  getPublicPremiumConfiguratorService,
} from "@/lib/catalogue/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Infernal Cape Service",
  description:
    "Configure an Infernal Cape service using admin-managed weapons, account modes, options, requirements and pricing.",
  alternates: { canonical: "/infernal" },
};

export default async function InfernalPage() {
  const [engine, flags] = await Promise.all([
    getPublicPremiumConfiguratorService({
      categorySlug: "premium-services",
      serviceSlug: "infernal-cape-service",
    }),
    getCatalogueFeatureFlags(),
  ]);
  if (!engine || !flags.premium_configurator_enabled) notFound();
  return (
    <main id="main-content" className="service-storefront min-h-[70vh]">
      <DirectServiceHero
        eyebrow="Premium end-game service"
        title="Infernal Cape"
        accent="Service"
        description="Choose your setup and configure your journey to the Infernal Cape."
        icon={Flame}
        inferno
      />
      <PremiumConfiguratorEngine
        service={engine.service}
        packages={engine.packages}
        options={engine.options}
        rule={engine.rule}
        requestHref={getDiscordHref()}
        eligibilityEnabled={Boolean(flags.rsn_eligibility_enabled)}
      />
    </main>
  );
}
