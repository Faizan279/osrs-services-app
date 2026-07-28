import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AccountListingForm,
  AccountListingTabs,
  AccountReviewControls,
} from "@/components/account-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getAccountListingAdmin } from "@/lib/accounts/admin";
import {
  approveAccountListingAction,
  publishAccountListingAction,
  rejectAccountListingAction,
  saveAccountListingAction,
} from "../../actions";

export const metadata = { title: "Account listing" };
export const dynamic = "force-dynamic";

export default async function AccountListingPage({
  params,
  searchParams,
}: {
  params: Promise<{ listingId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { listingId } = await params;
  await requireCapability(
    "accounts.view",
    `/admin/accounts/listings/${listingId}`,
  );
  const [listing, notice] = await Promise.all([
    getAccountListingAdmin(listingId),
    searchParams,
  ]);
  if (!listing) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Account listing</Badge>
            {listing.needsClientReview && (
              <Badge variant="warning">Needs client review</Badge>
            )}
          </div>
          <h1 className="display-type mt-4 text-4xl sm:text-5xl">
            {listing.publicTitle}
          </h1>
          <p className="text-text-secondary mt-3 max-w-3xl leading-7">
            Connected to {listing.marketplace.publicName}. Public pages use the
            latest immutable published revision and operational availability is
            checked separately.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href="/admin/accounts/listings">Listings</Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/accounts/listings/${listing.id}/preview`}>
              Preview
            </Link>
          </Button>
        </div>
      </div>
      <AccountListingTabs listingId={listing.id} />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <Card>
          <CardHeader>
            <h2 className="display-type text-3xl">Listing editor</h2>
          </CardHeader>
          <CardContent>
            <AccountListingForm
              marketplace={listing.marketplace}
              listing={listing}
              action={saveAccountListingAction}
            />
          </CardContent>
        </Card>
        <aside>
          <AccountReviewControls
            listing={listing}
            approveAction={approveAccountListingAction}
            rejectAction={rejectAccountListingAction}
            publishAction={publishAccountListingAction}
          />
        </aside>
      </section>
    </main>
  );
}
