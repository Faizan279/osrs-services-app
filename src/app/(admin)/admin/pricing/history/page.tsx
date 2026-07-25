import Link from "next/link";

import { CatalogueNotice, StatusBadge } from "@/components/catalogue-admin";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import {
  getAdminPricingOverview,
  getPricingHistory,
} from "@/lib/pricing/queries";
import { restorePricingRevisionAction } from "../actions";

export const metadata = { title: "Pricing history" };
export const dynamic = "force-dynamic";

export default async function PricingHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("pricing.view", "/admin/pricing/history");
  const [history, overview, notice] = await Promise.all([
    getPricingHistory(),
    getAdminPricingOverview(),
    searchParams,
  ]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Pricing center</p>
          <h1 className="display-type mt-3 text-4xl">History</h1>
          <p className="text-text-secondary mt-3">
            Published pricing snapshots are immutable and can be restored into
            the editable draft.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/pricing">Overview</Link>
        </Button>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <div className="border-border bg-surface-1 mt-8 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-3xl text-left text-sm">
          <thead className="bg-surface-2 text-text-muted">
            <tr>
              <th className="p-4">Revision</th>
              <th className="p-4">Published</th>
              <th className="p-4">Publisher</th>
              <th className="p-4">Status</th>
              <th className="p-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {history.map((revision) => (
              <tr key={revision.id}>
                <td className="p-4 font-bold">#{revision.revisionNumber}</td>
                <td className="text-text-secondary p-4">
                  {revision.publishedAt.toLocaleString()}
                </td>
                <td className="text-text-secondary p-4">
                  {revision.publishedBy?.name ??
                    revision.publishedBy?.email ??
                    "system"}
                </td>
                <td className="p-4">
                  {overview.latestRevision?.id === revision.id ? (
                    <StatusBadge status="PUBLISHED" />
                  ) : (
                    <StatusBadge status="ARCHIVED" />
                  )}
                </td>
                <td className="p-4">
                  {overview.draft ? (
                    <form
                      action={restorePricingRevisionAction}
                      className="flex justify-end"
                    >
                      <input
                        type="hidden"
                        name="revisionId"
                        value={revision.id}
                      />
                      <input
                        type="hidden"
                        name="expectedDraftVersion"
                        value={overview.draft.draftVersion}
                      />
                      <ConfirmSubmitButton
                        size="sm"
                        variant="secondary"
                        confirmation={`Restore revision #${revision.revisionNumber} into the draft?`}
                      >
                        Restore to draft
                      </ConfirmSubmitButton>
                    </form>
                  ) : null}
                </td>
              </tr>
            ))}
            {!history.length && (
              <tr>
                <td className="text-text-muted p-6" colSpan={5}>
                  No published pricing revisions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
