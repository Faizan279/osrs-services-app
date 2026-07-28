import { Clock3, History, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";

import {
  AccountMarketplaceSummary,
  AccountListingTable,
} from "@/components/account-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import {
  getAccountAdminListings,
  getAccountMarketplaceAdmin,
  getAccountsAdminOverview,
} from "@/lib/accounts/admin";

export const metadata = { title: "Accounts Centre" };
export const dynamic = "force-dynamic";

export default async function AccountsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("accounts.view", "/admin/accounts");
  const [overview, marketplace, listings, notice] = await Promise.all([
    getAccountsAdminOverview(),
    getAccountMarketplaceAdmin(),
    getAccountAdminListings(),
    searchParams,
  ]);
  const stats = [
    ["Marketplaces", overview.marketplaces, Store],
    ["Listings", overview.listings, ShieldCheck],
    ["Active holds", overview.activeHolds, Clock3],
    ["Published", overview.published, History],
  ] as const;

  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <Badge variant="success">Task 010</Badge>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="display-type text-4xl sm:text-5xl">Accounts Centre</h1>
          <p className="text-text-secondary mt-3 max-w-2xl leading-7">
            Manage account listings, approvals, public revisions, availability,
            temporary holds and secure-handover readiness.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/admin/accounts/preview">Preview</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/accounts/listings">Listings</Link>
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
      <section className="mt-8">
        <AccountMarketplaceSummary marketplace={marketplace} />
      </section>
      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="display-type text-3xl">Recent listings</h2>
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/accounts/listings/new">Create listing</Link>
          </Button>
        </div>
        <AccountListingTable listings={listings.slice(0, 6)} />
      </section>
      <section className="mt-10">
        <h2 className="display-type text-2xl">Recent account activity</h2>
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
            <p className="text-text-muted p-6 text-sm">
              No account activity yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
