import { notFound } from "next/navigation";

import {
  AccountFeaturesEditor,
  AccountListingTabs,
} from "@/components/account-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getAccountListingAdmin } from "@/lib/accounts/admin";
import { saveAccountFeatureAction } from "../../../actions";

export const metadata = { title: "Account features" };
export const dynamic = "force-dynamic";

export default async function AccountFeaturesPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { listingId } = await params;
  await requireCapability(
    "accounts.view",
    `/admin/accounts/listings/${listingId}/features`,
  );
  const [listing, notice] = await Promise.all([
    getAccountListingAdmin(listingId),
    searchParams,
  ]);
  if (!listing) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <h1 className="display-type text-4xl sm:text-5xl">
        {listing.publicTitle}
      </h1>
      <AccountListingTabs listingId={listing.id} />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <AccountFeaturesEditor
          listing={listing}
          action={saveAccountFeatureAction}
        />
      </section>
    </main>
  );
}
