import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import {
  GoldMarketSummary,
  GoldMarketTabs,
  GoldPublishControls,
  GoldRateForm,
} from "@/components/gold-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getGoldMarketAdmin } from "@/lib/gold/admin";
import {
  discardGoldDraftAction,
  publishGoldDraftAction,
  saveGoldRateAction,
} from "../../../actions";

export const metadata = { title: "Gold rates" };
export const dynamic = "force-dynamic";

export default async function GoldRatesPage({
  params,
  searchParams,
}: {
  params: Promise<{ marketId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { marketId } = await params;
  await requireCapability("gold.view", `/admin/gold/markets/${marketId}/rates`);
  const [market, notice] = await Promise.all([
    getGoldMarketAdmin(marketId),
    searchParams,
  ]);
  if (!market) notFound();

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Gold market</p>
          <h1 className="display-type mt-3 text-4xl">Draft rates</h1>
          <p className="text-text-secondary mt-3">
            Draft rate edits stay private until published atomically.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/gold/markets/${market.id}`}>Market settings</Link>
        </Button>
      </div>
      <GoldMarketTabs marketId={market.id} />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <GoldMarketSummary market={market} />
      </section>
      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <GoldRateForm
          marketId={market.id}
          draft={market.draftRateSet}
          direction="CUSTOMER_BUYS_GOLD"
          action={saveGoldRateAction}
        />
        <GoldRateForm
          marketId={market.id}
          draft={market.draftRateSet}
          direction="CUSTOMER_SELLS_GOLD"
          action={saveGoldRateAction}
        />
      </section>
      <Card className="mt-8">
        <CardHeader>
          <h2 className="text-lg font-bold">Publish controls</h2>
          <p className="text-text-muted text-sm">
            Publishing creates a new immutable customer-safe revision. The
            current public revision remains live if publishing fails.
          </p>
        </CardHeader>
        <CardContent>
          <GoldPublishControls
            marketId={market.id}
            draft={market.draftRateSet}
            publishAction={publishGoldDraftAction}
            discardAction={discardGoldDraftAction}
          />
        </CardContent>
      </Card>
    </main>
  );
}
