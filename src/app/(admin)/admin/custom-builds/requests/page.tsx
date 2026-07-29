import {
  CustomBuildAdminHero,
  CustomBuildRequestsTable,
} from "@/components/custom-build-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getCustomBuildRequestsAdmin } from "@/lib/custom-build/admin";
import { expireCustomBuildQuotesAction } from "../actions";

export const metadata = { title: "Custom Build Requests" };
export const dynamic = "force-dynamic";

export default async function CustomBuildRequestsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability(
    "custom_builds.requests.review",
    "/admin/custom-builds/requests",
  );
  const [requests, notice] = await Promise.all([
    getCustomBuildRequestsAdmin(),
    searchParams,
  ]);
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <CustomBuildAdminHero
        title="Request Review"
        description="Review submitted custom-build requests, private contact fields, safe notes, attachment metadata and quote status."
        icon="requests"
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <form action={expireCustomBuildQuotesAction} className="mt-6">
        <Button type="submit" variant="secondary">
          Expire stale quotes
        </Button>
      </form>
      <section className="mt-8">
        <CustomBuildRequestsTable requests={requests} />
      </section>
    </main>
  );
}
