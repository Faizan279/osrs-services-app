import type { Metadata } from "next";
import { Leaf } from "lucide-react";
import { notFound } from "next/navigation";

import { DirectOrderEngine } from "@/components/direct-order-engine";
import { DirectServiceHero } from "@/components/direct-service-hero";
import { getDirectOrderService } from "@/lib/direct-order/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "OSRS Misc Gathering Services",
  description:
    "Search and configure approved OSRS gathering services with quantity-aware pricing and direct cart ordering.",
  alternates: { canonical: "/misc-gathering" },
};

export default async function MiscGatheringPage() {
  const service = await getDirectOrderService(
    "ironman-gathering",
    "ironman-gathering-support",
  );
  if (!service) notFound();
  return (
    <main id="main-content" className="service-storefront min-h-[70vh]">
      <DirectServiceHero
        eyebrow="Direct ordering · gathering"
        title="Misc"
        accent="Gathering"
        description="Choose your resources, set the amount and let us handle the time-consuming grinds."
        artwork="/artwork/misc-gathering-resources.png"
        icon={Leaf}
      />
      <DirectOrderEngine mode="GATHERING" service={service} />
    </main>
  );
}
