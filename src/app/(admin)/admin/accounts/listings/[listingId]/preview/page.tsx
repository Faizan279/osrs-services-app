import { notFound } from "next/navigation";

import {
  AccountDraftPreview,
  AccountListingTabs,
} from "@/components/account-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getAccountListingAdmin } from "@/lib/accounts/admin";

export const metadata = { title: "Account listing preview" };
export const dynamic = "force-dynamic";

export default async function AccountPreviewPage({
  params,
}: {
  params: Promise<{ listingId: string }>;
}) {
  const { listingId } = await params;
  await requireCapability(
    "accounts.view",
    `/admin/accounts/listings/${listingId}/preview`,
  );
  const listing = await getAccountListingAdmin(listingId);
  if (!listing) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <h1 className="display-type text-4xl sm:text-5xl">
        Draft preview: {listing.publicTitle}
      </h1>
      <AccountListingTabs listingId={listing.id} />
      <section className="mt-8">
        <AccountDraftPreview listing={listing} />
      </section>
    </main>
  );
}
