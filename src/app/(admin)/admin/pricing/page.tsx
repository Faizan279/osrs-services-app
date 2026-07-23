import {
  CircleDollarSign,
  History,
  Layers3,
  Percent,
  ShieldCheck,
} from "lucide-react";
import Link from "next/link";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { PricingRuleList, PublishControls } from "@/components/pricing-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminPricingOverview } from "@/lib/pricing/queries";
import {
  discardPricingDraftAction,
  publishPricingDraftAction,
} from "./actions";

export const metadata = { title: "Pricing center" };
export const dynamic = "force-dynamic";

export default async function PricingOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("pricing.view", "/admin/pricing");
  const [overview, notice] = await Promise.all([
    getAdminPricingOverview(),
    searchParams,
  ]);
  const draft = overview.draft;
  const stats = [
    ["Draft rules", draft?.rules.length ?? 0, Layers3],
    [
      "Published revision",
      overview.latestRevision?.revisionNumber ?? "None",
      History,
    ],
    [
      "Global pricing flag",
      overview.globalPricingEnabled ? "Enabled" : "Disabled",
      ShieldCheck,
    ],
    ["Needs review", draft?.needsClientReview ? "Yes" : "No", Percent],
  ] as const;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <Badge variant="success">Task 008</Badge>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="display-type text-4xl sm:text-5xl">Pricing</h1>
          <p className="text-text-secondary mt-3 max-w-2xl leading-7">
            Manage draft global pricing rules, immutable published revisions and
            server-side preview calculations.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/admin/pricing/preview">Preview</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin/pricing/history">History</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/pricing/rules/new">New rule</Link>
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
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="display-type text-3xl">Draft rules</h2>
            <Button asChild variant="secondary">
              <Link href="/admin/pricing/rules">View all rules</Link>
            </Button>
          </div>
          <PricingRuleList rules={draft?.rules ?? []} />
        </div>
        <aside className="border-border bg-surface-1 h-fit rounded-2xl border p-6">
          <div className="flex items-center gap-3">
            <CircleDollarSign className="text-gold size-5" aria-hidden="true" />
            <h2 className="font-bold">Publication</h2>
          </div>
          <p className="text-text-secondary mt-4 text-sm leading-6">
            Public estimates use only the latest published pricing revision.
            Draft rules are private until published.
          </p>
          {overview.latestRevision ? (
            <p className="text-text-muted mt-4 text-sm">
              Current public revision #{overview.latestRevision.revisionNumber}
              published {overview.latestRevision.publishedAt.toLocaleString()}.
            </p>
          ) : (
            <p className="text-warning mt-4 text-sm font-semibold">
              No published pricing revision exists yet.
            </p>
          )}
          <div className="mt-5">
            <PublishControls
              draft={draft}
              publishAction={publishPricingDraftAction}
              discardAction={discardPricingDraftAction}
            />
          </div>
        </aside>
      </section>
      <section className="mt-10">
        <h2 className="display-type text-2xl">Recent pricing activity</h2>
        <div className="border-border bg-surface-1 mt-5 overflow-hidden rounded-2xl border">
          {overview.activity.length ? (
            <ul className="divide-border divide-y">
              {overview.activity.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap justify-between gap-3 px-5 py-4 text-sm"
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
            <p className="text-text-muted p-6 text-sm">
              No pricing activity yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
