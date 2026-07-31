import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { OrderPublicSummary } from "@/components/order-public-summary";
import { getTrackedOrder } from "@/lib/checkout/orders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Track order",
  robots: { index: false, follow: false },
};

export default async function TrackedOrderPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await getTrackedOrder(token);
  if (!order) notFound();

  return (
    <main
      id="main-content"
      className="mx-auto min-h-[70vh] max-w-6xl px-5 py-10 sm:px-8"
    >
      <OrderPublicSummary order={order} />
    </main>
  );
}
