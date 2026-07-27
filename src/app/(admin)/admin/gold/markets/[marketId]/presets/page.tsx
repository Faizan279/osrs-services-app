import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import {
  GoldMarketSummary,
  GoldMarketTabs,
  GoldPresetForm,
  GoldPresetList,
} from "@/components/gold-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getGoldMarketAdmin } from "@/lib/gold/admin";
import { saveGoldPresetAction } from "../../../actions";

export const metadata = { title: "Gold quantity presets" };
export const dynamic = "force-dynamic";

export default async function GoldPresetsPage({
  params,
  searchParams,
}: {
  params: Promise<{ marketId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { marketId } = await params;
  await requireCapability(
    "gold.view",
    `/admin/gold/markets/${marketId}/presets`,
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
          <h1 className="display-type mt-3 text-4xl">Quantity presets</h1>
          <p className="text-text-secondary mt-3">
            Presets are customer-facing shortcuts. They still validate against
            the active published rate limits.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/gold/markets/${market.id}/rates`}>Rates</Link>
        </Button>
      </div>
      <GoldMarketTabs marketId={market.id} />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <GoldMarketSummary market={market} />
      </section>
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <h2 className="display-type mb-5 text-3xl">Configured presets</h2>
          <GoldPresetList presets={market.quantityPresets} />
          {market.quantityPresets.length > 0 && (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              {market.quantityPresets.map((preset) => (
                <GoldPresetForm
                  key={preset.id}
                  marketId={market.id}
                  preset={preset}
                  action={saveGoldPresetAction}
                />
              ))}
            </div>
          )}
        </div>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-bold">New preset</h2>
          </CardHeader>
          <CardContent>
            <GoldPresetForm
              marketId={market.id}
              action={saveGoldPresetAction}
            />
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
