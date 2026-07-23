import Link from "next/link";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { PricingRuleForm } from "@/components/pricing-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getPricingRuleCreationContext } from "@/lib/pricing/queries";
import { savePricingRuleAction } from "../../actions";

export const metadata = { title: "New pricing rule" };
export const dynamic = "force-dynamic";

export default async function NewPricingRulePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("pricing.edit", "/admin/pricing/rules/new");
  const [context, notice] = await Promise.all([
    getPricingRuleCreationContext(),
    searchParams,
  ]);

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
      <Button asChild variant="ghost">
        <Link href="/admin/pricing/rules">Back to rules</Link>
      </Button>
      <div className="mt-5">
        <p className="text-gold kicker-type">Pricing center</p>
        <h1 className="display-type mt-3 text-4xl">New pricing rule</h1>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="border-border bg-surface-1 mt-8 rounded-2xl border p-6">
        {context.draft ? (
          <PricingRuleForm
            draft={context.draft}
            options={context.options}
            action={savePricingRuleAction}
          />
        ) : (
          <p className="text-warning text-sm font-semibold">
            Pricing seed data has not created a draft rule set yet.
          </p>
        )}
      </section>
    </main>
  );
}
