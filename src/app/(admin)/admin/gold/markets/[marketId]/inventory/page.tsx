import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import {
  GoldInventoryForm,
  GoldLedgerList,
  GoldMarketSummary,
  GoldMarketTabs,
} from "@/components/gold-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getGoldMarketAdmin } from "@/lib/gold/admin";
import { adjustGoldInventoryAction } from "../../../actions";

export const metadata = { title: "Gold inventory" };
export const dynamic = "force-dynamic";

export default async function GoldInventoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ marketId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { marketId } = await params;
  await requireCapability(
    "gold.view",
    `/admin/gold/markets/${marketId}/inventory`,
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
          <h1 className="display-type mt-3 text-4xl">Inventory ledger</h1>
          <p className="text-text-secondary mt-3">
            Adjust stock and buying capacity with atomic balance protection.
            Public estimates never create ledger entries.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/gold/markets/${market.id}/history`}>
            Rate history
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
      <section className="mt-8 grid gap-6 xl:grid-cols-[24rem_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold">Record adjustment</h2>
          </CardHeader>
          <CardContent>
            <GoldInventoryForm
              market={market}
              action={adjustGoldInventoryAction}
            />
          </CardContent>
        </Card>
        <div>
          <h2 className="display-type mb-5 text-3xl">Recent ledger</h2>
          <GoldLedgerList entries={market.ledgerEntries} />
        </div>
      </section>
    </main>
  );
}
