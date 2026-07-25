import Link from "next/link";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { PricingRuleList } from "@/components/pricing-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminPricingOverview } from "@/lib/pricing/queries";

export const metadata = { title: "Pricing rules" };
export const dynamic = "force-dynamic";

export default async function PricingRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("pricing.view", "/admin/pricing/rules");
  const [overview, notice] = await Promise.all([
    getAdminPricingOverview(),
    searchParams,
  ]);

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Pricing center</p>
          <h1 className="display-type mt-3 text-4xl">Draft rules</h1>
          <p className="text-text-secondary mt-3">
            Review the editable rule set before it becomes a published pricing
            revision.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/admin/pricing">Overview</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/pricing/rules/new">New rule</Link>
          </Button>
        </div>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <PricingRuleList rules={overview.draft?.rules ?? []} />
      </section>
    </main>
  );
}
