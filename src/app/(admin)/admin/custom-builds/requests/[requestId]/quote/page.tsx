import { notFound } from "next/navigation";

import {
  CustomBuildAdminHero,
  CustomBuildQuoteEditor,
  QuoteRevisionList,
} from "@/components/custom-build-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getCustomBuildRequestAdmin } from "@/lib/custom-build/admin";
import {
  createCustomBuildQuoteRevisionAction,
  sendCustomBuildQuoteAction,
  voidCustomBuildQuoteAction,
} from "../../../actions";

export const metadata = { title: "Custom Build Quote" };
export const dynamic = "force-dynamic";

export default async function CustomBuildRequestQuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ requestId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { requestId } = await params;
  await requireCapability(
    "custom_builds.quotes.manage",
    `/admin/custom-builds/requests/${requestId}/quote`,
  );
  const [request, notice] = await Promise.all([
    getCustomBuildRequestAdmin(requestId),
    searchParams,
  ]);
  if (!request) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <CustomBuildAdminHero
        title="Quote Editor"
        description="Create immutable quote revisions, send the current revision, or void the quote. Sending a quote does not create checkout, order or payment records."
        icon="quote"
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <CustomBuildQuoteEditor
          request={request}
          createAction={createCustomBuildQuoteRevisionAction}
          sendAction={sendCustomBuildQuoteAction}
          voidAction={voidCustomBuildQuoteAction}
        />
      </section>
      <section className="mt-10">
        <h2 className="display-type mb-5 text-3xl">Quote history</h2>
        <QuoteRevisionList request={request} />
      </section>
    </main>
  );
}
