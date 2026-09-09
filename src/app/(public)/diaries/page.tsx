import type { Metadata } from "next";
import { MapPinned } from "lucide-react";
import { notFound } from "next/navigation";

import { DirectOrderEngine } from "@/components/direct-order-engine";
import { DirectServiceHero } from "@/components/direct-service-hero";
import { getDirectOrderService } from "@/lib/direct-order/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OSRS Achievement Diary Selector",
  description:
    "Choose one or more OSRS Achievement Diary regions and tiers, review dependencies and add the priced selection to cart.",
  alternates: { canonical: "/diaries" },
};

export default async function DiariesPage() {
  const service = await getDirectOrderService(
    "achievement-diaries",
    "diary-progression",
  );
  if (!service) notFound();
  return (
    <main id="main-content" className="service-storefront min-h-[70vh]">
      <DirectServiceHero
        eyebrow="Direct ordering · diaries"
        title="Achievement"
        accent="Diaries"
        description="Choose regions and tiers directly. Multi-selection, dependency guidance and the running total stay visible as you build the order."
        icon={MapPinned}
      />
      <DirectOrderEngine mode="DIARIES" service={service} />
    </main>
  );
}
