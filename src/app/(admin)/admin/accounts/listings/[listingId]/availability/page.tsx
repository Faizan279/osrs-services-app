import { notFound } from "next/navigation";

import {
  AccountAvailabilityPanel,
  AccountListingTabs,
} from "@/components/account-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getAccountListingAdmin } from "@/lib/accounts/admin";
import {
  changeAccountAvailabilityAction,
  createAccountHoldAction,
  expireAccountHoldsAction,
  markAccountListingSoldAction,
  releaseAccountHoldAction,
  reopenAccountListingAction,
} from "../../../actions";

export const metadata = { title: "Account availability" };
export const dynamic = "force-dynamic";

export default async function AccountAvailabilityPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { listingId } = await params;
  await requireCapability(
    "accounts.view",
    `/admin/accounts/listings/${listingId}/availability`,
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
        <AccountAvailabilityPanel
          listing={listing}
          availabilityAction={changeAccountAvailabilityAction}
          holdAction={createAccountHoldAction}
          releaseAction={releaseAccountHoldAction}
          expireAction={expireAccountHoldsAction}
          soldAction={markAccountListingSoldAction}
          reopenAction={reopenAccountListingAction}
        />
      </section>
    </main>
  );
}
