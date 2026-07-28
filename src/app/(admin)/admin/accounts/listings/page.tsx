import Link from "next/link";

import { AccountListingTable } from "@/components/account-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAccountAdminListings } from "@/lib/accounts/admin";

export const metadata = { title: "Account listings" };
export const dynamic = "force-dynamic";

export default async function AccountListingsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("accounts.view", "/admin/accounts/listings");
  const [listings, notice] = await Promise.all([
    getAccountAdminListings(),
    searchParams,
  ]);
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <h1 className="display-type text-4xl sm:text-5xl">
            Account listings
          </h1>
          <p className="text-text-secondary mt-3 max-w-2xl leading-7">
            Draft, approve, publish and operationally manage prebuilt account
            listings without storing credentials.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/accounts/listings/new">Create listing</Link>
        </Button>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <AccountListingTable listings={listings} />
      </section>
    </main>
  );
}
