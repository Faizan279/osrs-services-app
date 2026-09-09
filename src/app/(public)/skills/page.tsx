import type { Metadata } from "next";
import { Pickaxe } from "lucide-react";
import { notFound } from "next/navigation";

import { DirectServiceHero } from "@/components/direct-service-hero";
import { SkillingCalculatorEngine } from "@/components/skilling-calculator-engine";
import { getDiscordHref } from "@/config/public-navigation";
import {
  getCatalogueFeatureFlags,
  getPublicSkillingCalculatorService,
} from "@/lib/catalogue/queries";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OSRS Skilling Calculator",
  description:
    "Choose an OSRS skill, levels and an admin-configured training method, then see the price and add the configuration to cart.",
  alternates: { canonical: "/skills" },
};

export default async function SkillsPage() {
  const [engine, flags] = await Promise.all([
    getPublicSkillingCalculatorService({
      categorySlug: "power-levelling",
      serviceSlug: "skill-training-request",
    }),
    getCatalogueFeatureFlags(),
  ]);
  if (!engine || !flags.skilling_calculator_enabled) notFound();

  return (
    <main id="main-content" className="service-storefront min-h-[70vh]">
      <DirectServiceHero
        eyebrow="Direct ordering · skills"
        title="Skilling"
        accent="Services"
        description="Choose a skill, set any valid level range from 1 to 99, pick an available training method and add the server-priced configuration to cart."
        icon={Pickaxe}
      />
      <SkillingCalculatorEngine
        service={engine.service}
        skills={engine.skills}
        rule={engine.rule}
        requestHref={getDiscordHref()}
      />
    </main>
  );
}
