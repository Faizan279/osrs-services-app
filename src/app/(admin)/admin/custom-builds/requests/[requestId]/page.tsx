import { notFound } from "next/navigation";

import {
  CustomBuildAdminHero,
  CustomBuildRequestDetail,
} from "@/components/custom-build-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getCustomBuildRequestAdmin } from "@/lib/custom-build/admin";
import { transitionCustomBuildRequestAction } from "../../actions";
import Link from "next/link";

export const metadata = { title: "Custom Build Request" };
export const dynamic = "force-dynamic";

export default async function CustomBuildRequestDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { requestId } = await params;
  await requireCapability(
    "custom_builds.requests.review",
    `/admin/custom-builds/requests/${requestId}`,
  );
  const [request, notice] = await Promise.all([
    getCustomBuildRequestAdmin(requestId),
    searchParams,
  ]);
  if (!request) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <CustomBuildAdminHero
        title="Request Detail"
        description="Review private request context. Do not copy contact details into public quote snapshots or audit metadata."
        icon="requests"
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button asChild variant="secondary">
          <Link
            href={`/admin/custom-builds/requests/${request.id}/attachments`}
          >
            Attachments
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/admin/custom-builds/requests/${request.id}/quote`}>
            Quote
          </Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/admin/custom-builds/requests/${request.id}/history`}>
            History
          </Link>
        </Button>
      </div>
      <section className="mt-8">
        <CustomBuildRequestDetail
          request={request}
          statusAction={transitionCustomBuildRequestAction}
        />
      </section>
    </main>
  );
}
