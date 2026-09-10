import type { Metadata } from "next";
import { ScrollText } from "lucide-react";
import { notFound } from "next/navigation";

import { DirectOrderEngine } from "@/components/direct-order-engine";
import { DirectServiceHero } from "@/components/direct-service-hero";
import { getDirectOrderService } from "@/lib/direct-order/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OSRS Quest Selector",
  description:
    "Search and select multiple OSRS quests, review quest points and requirements, and add the priced selection to cart.",
  alternates: { canonical: "/quests" },
};

export default async function QuestsPage() {
  const service = await getDirectOrderService("quests", "quest-progression");
  if (!service) notFound();
  return (
    <main id="main-content" className="service-storefront min-h-[70vh]">
      <DirectServiceHero
        eyebrow="Direct ordering · quests"
        title="Quest"
        accent="Services"
        description="Select one or multiple quests and have them completed by our team."
        icon={ScrollText}
      />
      <DirectOrderEngine mode="QUESTS" service={service} />
    </main>
  );
}
