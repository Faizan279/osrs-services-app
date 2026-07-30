import { Boxes, History, PackagePlus, Tags } from "lucide-react";
import Link from "next/link";

import {
  ProductAdminHero,
  ProductMarketplaceSummary,
  ProductTable,
} from "@/components/product-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import {
  getProductAdminProducts,
  getProductMarketplaceAdmin,
  getProductsAdminOverview,
} from "@/lib/products/admin";

export const metadata = { title: "Products Centre" };
export const dynamic = "force-dynamic";

export default async function ProductsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("products.view", "/admin/products");
  const [overview, marketplace, products, notice] = await Promise.all([
    getProductsAdminOverview(),
    getProductMarketplaceAdmin(),
    getProductAdminProducts(),
    searchParams,
  ]);
  const stats = [
    ["Products", overview.products, PackagePlus],
    ["Published", overview.published, History],
    ["Variants", overview.variants, Boxes],
    ["Categories", overview.categories, Tags],
  ] as const;
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <ProductAdminHero
        title="Products Centre"
        description="Manage item, bond and outfit listings, published revisions, inventory balances and internal reservations."
        icon="products"
      />
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
        <ProductMarketplaceSummary marketplace={marketplace} />
      </section>
      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="display-type text-3xl">Recent products</h2>
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/products/new">Create product</Link>
          </Button>
        </div>
        <ProductTable products={products.slice(0, 8)} />
      </section>
      <section className="mt-10">
        <h2 className="display-type text-2xl">Recent product activity</h2>
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
              No product activity yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
