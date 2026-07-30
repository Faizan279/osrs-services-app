import Link from "next/link";

import {
  CustomBuildAdminHero,
  CustomBuildConfigSummary,
  CustomBuildRequestsTable,
} from "@/components/custom-build-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import {
  getCustomBuildAdminConfig,
  getCustomBuildAdminOverview,
  getCustomBuildRequestsAdmin,
} from "@/lib/custom-build/admin";

export const metadata = { title: "Custom Builds Centre" };
export const dynamic = "force-dynamic";

export default async function CustomBuildsAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("custom_builds.view", "/admin/custom-builds");
  const [overview, config, requests, notice] = await Promise.all([
    getCustomBuildAdminOverview(),
    getCustomBuildAdminConfig(),
    getCustomBuildRequestsAdmin(),
    searchParams,
  ]);
  const stats = [
    ["Services", overview.services],
    ["Requests", overview.requests],
    ["Quotes", overview.quotes],
    ["Attachments", overview.attachments],
  ] as const;
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <CustomBuildAdminHero
        title="Custom Builds Centre"
        description="Configure desired-account build rules, review submitted requests and send versioned quotes without creating orders or payments."
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map(([label, value]) => (
          <Card key={label}>
            <CardHeader>
              <p className="text-text-secondary text-sm font-semibold">
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
        <CustomBuildConfigSummary config={config} />
      </section>
      <section className="mt-10">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
          <h2 className="display-type text-3xl">Recent requests</h2>
          <Button asChild size="sm" variant="secondary">
            <Link href="/admin/custom-builds/requests">View all</Link>
          </Button>
        </div>
        <CustomBuildRequestsTable requests={requests.slice(0, 6)} />
      </section>
    </main>
  );
}
