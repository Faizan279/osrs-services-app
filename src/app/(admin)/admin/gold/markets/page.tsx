import Link from "next/link";

import { GoldMarketSummary } from "@/components/gold-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getGoldAdminOverview } from "@/lib/gold/admin";

export const metadata = { title: "Gold markets" };
export const dynamic = "force-dynamic";

export default async function GoldMarketsPage() {
  await requireCapability("gold.view", "/admin/gold/markets");
  const overview = await getGoldAdminOverview();

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Gold center</p>
          <h1 className="display-type mt-3 text-4xl">Markets</h1>
          <p className="text-text-secondary mt-3">
            Gold engine market configurations connected to catalogue services.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/gold">Overview</Link>
        </Button>
      </div>
      <section className="mt-8 grid gap-5">
        {overview.markets.length ? (
          overview.markets.map((market) => (
            <Card key={market.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="display-type text-2xl">
                      {market.publicName}
                    </h2>
                    <p className="text-text-muted mt-2 text-sm">
                      {market.service.name} / {market.service.category.name}
                    </p>
                  </div>
                  <Button asChild>
                    <Link href={`/admin/gold/markets/${market.id}`}>
                      Open market
                    </Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <GoldMarketSummary market={market} />
              </CardContent>
            </Card>
          ))
        ) : (
          <p className="text-text-muted rounded-2xl border p-6">
            No gold markets have been seeded yet.
          </p>
        )}
      </section>
    </main>
  );
}
