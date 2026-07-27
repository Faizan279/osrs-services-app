import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import {
  GoldMarketForm,
  GoldMarketSummary,
  GoldMarketTabs,
} from "@/components/gold-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getGoldMarketAdmin } from "@/lib/gold/admin";
import { saveGoldMarketAction } from "../../actions";

export const metadata = { title: "Gold market" };
export const dynamic = "force-dynamic";

export default async function GoldMarketPage({
  params,
  searchParams,
}: {
  params: Promise<{ marketId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { marketId } = await params;
  await requireCapability("gold.view", `/admin/gold/markets/${marketId}`);
  const [market, notice] = await Promise.all([
    getGoldMarketAdmin(marketId),
    searchParams,
  ]);
  if (!market) notFound();

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Gold market</Badge>
            {market.needsClientReview && (
              <Badge variant="warning">Needs client review</Badge>
            )}
          </div>
          <h1 className="display-type mt-4 text-4xl sm:text-5xl">
            {market.publicName}
          </h1>
          <p className="text-text-secondary mt-3 max-w-3xl leading-7">
            Connected to {market.service.name} in {market.service.category.name}
            . Public estimates use only published gold-rate revisions.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/admin/gold">Gold overview</Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/gold/markets/${market.id}/rates`}>
              Manage rates
            </Link>
          </Button>
        </div>
      </div>
      <GoldMarketTabs marketId={market.id} />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <GoldMarketSummary market={market} />
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <h2 className="display-type text-3xl">Market settings</h2>
            <p className="text-text-muted text-sm">
              Availability, public instructions, RSN requirements and optional
              secure-service pricing.
            </p>
          </CardHeader>
          <CardContent>
            <GoldMarketForm market={market} action={saveGoldMarketAction} />
          </CardContent>
        </Card>
        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold">Public routing</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="text-text-secondary">
                Service page: /services/{market.service.category.slug}/
                {market.service.slug}
              </p>
              <p className="text-text-secondary">Convenience route: /gold</p>
              <p className="text-text-muted">
                The public UI does not expose internal notes, exact balances, or
                draft rates.
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <h2 className="text-lg font-bold">Publication</h2>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {market.latestRevision ? (
                <p className="text-text-secondary">
                  Latest published revision #
                  {market.latestRevision.revisionNumber} from{" "}
                  {market.latestRevision.publishedAt.toLocaleString()}.
                </p>
              ) : (
                <p className="text-warning font-semibold">
                  No published gold-rate revision exists yet.
                </p>
              )}
              <Button asChild variant="secondary">
                <Link href={`/admin/gold/markets/${market.id}/history`}>
                  View history
                </Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </section>
    </main>
  );
}
