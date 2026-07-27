import { AccountMarketplacePage } from "@/components/account-marketplace";
import { requireCapability } from "@/lib/auth/guards";
import { getDiscordHref } from "@/config/public-navigation";
import { getPublicAccountMarketplace } from "@/lib/accounts/server";

export const metadata = { title: "Account marketplace preview" };
export const dynamic = "force-dynamic";

export default async function AccountsPreviewPage() {
  await requireCapability("accounts.view", "/admin/accounts/preview");
  const data = await getPublicAccountMarketplace({ pageSize: 9 });
  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
        <h1 className="display-type text-4xl sm:text-5xl">
          Marketplace preview
        </h1>
        <p className="text-text-secondary mt-4">
          No account marketplace has been configured yet.
        </p>
      </main>
    );
  }
  return (
    <AccountMarketplacePage
      data={data}
      filters={{}}
      requestHref={getDiscordHref()}
    />
  );
}
