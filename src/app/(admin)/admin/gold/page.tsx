import { Coins, Database, History, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { GoldMarketSummary } from "@/components/gold-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getGoldAdminOverview } from "@/lib/gold/admin";

export const metadata = { title: "Gold Centre" };
export const dynamic = "force-dynamic";

export default async function GoldOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("gold.view", "/admin/gold");
  const [overview, notice] = await Promise.all([
    getGoldAdminOverview(),
    searchParams,
  ]);
  const stats = [
    ["Markets", overview.markets.length, Coins],
    ["Draft rate sets", overview.draftRateSets, Database],
    ["Published revisions", overview.publishedRevisions, History],
    [
      "Feature flag",
      overview.goldEngineEnabled ? "Enabled" : "Disabled",
      ShieldCheck,
    ],
  ] as const;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <Badge variant="success">Task 009</Badge>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="display-type text-4xl sm:text-5xl">Gold Centre</h1>
          <p className="text-text-secondary mt-3 max-w-2xl leading-7">
            Manage gold markets, draft rates, published revisions, quantity
            presets, stock and buying capacity.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/admin/gold/preview">Preview</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/gold/markets">Markets</Link>
          </Button>
        </div>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value, Icon]) => (
          <Card key={label}>
            <CardHeader>
              <Icon className="text-primary size-5" aria-hidden="true" />
              <p className="text-text-secondary pt-2 text-sm font-semibold">
                {label}
              </p>
            </CardHeader>
            <CardContent>
              <p className="display-type text-3xl">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="mt-10">
        <h2 className="display-type text-3xl">Markets</h2>
        <div className="mt-5 grid gap-5">
          {overview.markets.map((market) => (
            <article
              className="border-border bg-surface-1 rounded-2xl border p-5"
              key={market.id}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h3 className="font-bold">{market.publicName}</h3>
                  <p className="text-text-muted mt-1 text-sm">
                    {market.service.category.name} / {market.service.name}
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/admin/gold/markets/${market.id}`}>Open</Link>
                </Button>
              </div>
              <div className="mt-5">
                <GoldMarketSummary market={market} />
              </div>
            </article>
          ))}
          {!overview.markets.length && (
            <div className="border-border bg-surface-1 rounded-2xl border p-6">
              No gold markets have been seeded yet.
            </div>
          )}
        </div>
      </section>
      <section className="mt-10">
        <h2 className="display-type text-2xl">Recent gold activity</h2>
        <div className="border-border bg-surface-1 mt-5 overflow-hidden rounded-2xl border">
          {overview.activity.length ? (
            <ul className="divide-border divide-y">
              {overview.activity.map((item) => (
                <li
                  className="flex flex-wrap justify-between gap-3 px-5 py-4 text-sm"
                  key={item.id}
                >
                  <span>
                    <strong>{item.action.replaceAll(".", " ")}</strong>
                    <span className="text-text-muted ml-2">
                      by {item.actor?.name ?? item.actor?.email ?? "system"}
                    </span>
                  </span>
                  <time
                    className="text-text-muted"
                    dateTime={item.createdAt.toISOString()}
                  >
                    {item.createdAt.toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-text-muted p-6 text-sm">No gold activity yet.</p>
          )}
        </div>
      </section>
    </main>
  );
}
