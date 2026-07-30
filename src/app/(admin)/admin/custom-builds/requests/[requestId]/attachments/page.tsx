import { notFound } from "next/navigation";

import {
  CustomBuildAdminHero,
  CustomBuildAttachmentsPanel,
} from "@/components/custom-build-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getCustomBuildRequestAdmin } from "@/lib/custom-build/admin";
import { reviewCustomBuildAttachmentAction } from "../../../actions";

export const metadata = { title: "Custom Build Attachments" };
export const dynamic = "force-dynamic";

export default async function CustomBuildRequestAttachmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { requestId } = await params;
  await requireCapability(
    "custom_builds.attachments.review",
    `/admin/custom-builds/requests/${requestId}/attachments`,
  );
  const [request, notice] = await Promise.all([
    getCustomBuildRequestAdmin(requestId),
    searchParams,
  ]);
  if (!request) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <CustomBuildAdminHero
        title="Attachment Metadata"
        description="Review private quarantined attachment metadata. Private uploaded bytes are not public and must not be included in review packs."
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <CustomBuildAttachmentsPanel
          request={request}
          action={reviewCustomBuildAttachmentAction}
        />
      </section>
    </main>
  );
}
