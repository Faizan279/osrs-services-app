import { notFound } from "next/navigation";

import { AccountListingForm } from "@/components/account-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getAccountMarketplaceAdmin } from "@/lib/accounts/admin";
import { saveAccountListingAction } from "../../actions";

export const metadata = { title: "Create account listing" };
export const dynamic = "force-dynamic";

export default async function NewAccountListingPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("accounts.edit", "/admin/accounts/listings/new");
  const [marketplace, notice] = await Promise.all([
    getAccountMarketplaceAdmin(),
    searchParams,
  ]);
  if (!marketplace) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <h1 className="display-type text-4xl sm:text-5xl">
        Create account listing
      </h1>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <Card className="mt-8">
        <CardHeader>
          <h2 className="display-type text-3xl">Listing draft</h2>
          <p className="text-text-muted text-sm">
            Public-safe account details only. Never enter login credentials,
            recovery data, bank PINs or authenticator material.
          </p>
        </CardHeader>
        <CardContent>
          <AccountListingForm
            marketplace={marketplace}
            action={saveAccountListingAction}
          />
        </CardContent>
      </Card>
    </main>
  );
}
