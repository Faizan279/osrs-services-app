import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";

import { OrderPublicSummary } from "@/components/order-public-summary";
import { Button } from "@/components/ui/button";
import { getOrderForConfirmation } from "@/lib/checkout/orders";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Order confirmation",
  robots: { index: false, follow: false },
};

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const order = await getOrderForConfirmation(token);
  if (!order) notFound();

  return (
    <main
      id="main-content"
      className="mx-auto min-h-[70vh] max-w-6xl px-5 py-10 sm:px-8"
    >
      <OrderPublicSummary order={order} />
      <section className="border-border bg-surface-1 mt-8 rounded-2xl border p-5">
        <h2 className="text-xl font-bold">Optional account</h2>
        <p className="text-text-secondary mt-2 text-sm leading-6">
          Create a customer account for this order only if the registration
          foundation is enabled. The order email must match the account email.
        </p>
        <Button asChild variant="secondary" className="mt-4">
          <Link
            href={`/account/register?trackingToken=${encodeURIComponent(token)}`}
          >
            Create account for this order
          </Link>
        </Button>
      </section>
    </main>
  );
}
