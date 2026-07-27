import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import {
  GoldMarketSummary,
  GoldMarketTabs,
  GoldRevisionList,
} from "@/components/gold-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getGoldMarketAdmin } from "@/lib/gold/admin";
import { restoreGoldRevisionAction } from "../../../actions";

export const metadata = { title: "Gold rate history" };
export const dynamic = "force-dynamic";

export default async function GoldHistoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ marketId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { marketId } = await params;
  await requireCapability(
    "gold.view",
    `/admin/gold/markets/${marketId}/history`,
  );
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
          <h1 className="display-type mt-3 text-4xl">Published revisions</h1>
          <p className="text-text-secondary mt-3">
            Historical revisions are immutable. Restore copies an old revision
            into the current draft without changing the live public revision.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/gold/markets/${market.id}/rates`}>
            Draft rates
          </Link>
        </Button>
      </div>
      <GoldMarketTabs marketId={market.id} />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <GoldMarketSummary market={market} />
      </section>
      <section className="mt-8">
        <GoldRevisionList
          marketId={market.id}
          revisions={market.revisions}
          draft={market.draftRateSet}
          restoreAction={restoreGoldRevisionAction}
        />
      </section>
    </main>
  );
}
