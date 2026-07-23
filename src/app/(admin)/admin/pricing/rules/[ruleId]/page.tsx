import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { PricingRuleForm } from "@/components/pricing-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getPricingRuleForEditor } from "@/lib/pricing/queries";
import { savePricingRuleAction } from "../../actions";

export const metadata = { title: "Edit pricing rule" };
export const dynamic = "force-dynamic";

export default async function EditPricingRulePage({
  params,
  searchParams,
}: {
  params: Promise<{ ruleId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { ruleId } = await params;
  await requireCapability("pricing.edit", `/admin/pricing/rules/${ruleId}`);
  const [context, notice] = await Promise.all([
    getPricingRuleForEditor(ruleId),
    searchParams,
  ]);
  if (!context) notFound();

  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
      <Button asChild variant="ghost">
        <Link href="/admin/pricing/rules">Back to rules</Link>
      </Button>
      <div className="mt-5">
        <p className="text-gold kicker-type">Pricing center</p>
        <h1 className="display-type mt-3 text-4xl">
          {context.rule.publicLabel}
        </h1>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="border-border bg-surface-1 mt-8 rounded-2xl border p-6">
        <PricingRuleForm
          draft={context.draft}
          rule={context.rule}
          options={context.options}
          action={savePricingRuleAction}
        />
      </section>
    </main>
  );
}
