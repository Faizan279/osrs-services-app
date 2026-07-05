import {
  AlertTriangle,
  Archive,
  FolderTree,
  Library,
  Radio,
} from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getCatalogueOverview } from "@/lib/catalogue/queries";

export const metadata = { title: "Catalogue overview" };
export const dynamic = "force-dynamic";

export default async function CatalogueOverviewPage() {
  await requireCapability("products.view", "/admin/catalogue");
  const overview = await getCatalogueOverview();
  const stats = [
    ["Categories", overview.categories, FolderTree],
    ["Drafts", overview.drafts, Library],
    ["Published", overview.published, Radio],
    ["Archived", overview.archived, Archive],
    ["Limited availability", overview.limited, AlertTriangle],
    ["Needs review", overview.review, AlertTriangle],
  ] as const;
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <Badge variant="success">Task 003</Badge>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="display-type text-4xl sm:text-5xl">Catalogue</h1>
          <p className="text-text-secondary mt-3 max-w-2xl leading-7">
            Manage taxonomy, public content, availability and publishing without
            introducing pricing or checkout logic.
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="secondary">
            <Link href="/admin/catalogue/categories">Categories</Link>
          </Button>
          <Button asChild>
            <Link href="/admin/catalogue/services/new">New service</Link>
          </Button>
        </div>
      </div>
      <section
        aria-label="Catalogue status"
        className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        {stats.map(([label, value, Icon]) => (
          <Card key={label}>
            <CardHeader>
              <Icon className="text-primary size-5" aria-hidden="true" />
              <p className="text-text-secondary pt-2 text-sm font-semibold">
                {label}
              </p>
            </CardHeader>
            <CardContent>
              <p className="display-type text-4xl">{value}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <section className="mt-10">
        <div className="flex items-center justify-between">
          <h2 className="display-type text-2xl">Recent catalogue activity</h2>
          <Link
            className="text-primary text-sm font-bold"
            href="/admin/catalogue/services"
          >
            View services
          </Link>
        </div>
        <div className="border-border bg-surface-1 mt-5 overflow-hidden rounded-2xl border">
          {overview.activity.length ? (
            <ul className="divide-border divide-y">
              {overview.activity.map((item) => (
                <li
                  key={item.id}
                  className="flex flex-wrap justify-between gap-3 px-5 py-4 text-sm"
                >
                  <span>
                    <strong className="text-text-primary">
                      {item.action.replaceAll(".", " ")}
                    </strong>
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
              No catalogue activity yet.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}
