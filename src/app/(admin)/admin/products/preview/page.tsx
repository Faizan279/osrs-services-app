import { ProductMarketplacePage } from "@/components/product-marketplace";
import { getDiscordHref } from "@/config/public-navigation";
import { requireCapability } from "@/lib/auth/guards";
import { getPublicProductMarketplace } from "@/lib/products/server";

export const metadata = { title: "Product marketplace preview" };
export const dynamic = "force-dynamic";

export default async function ProductPreviewPage() {
  await requireCapability("products.view", "/admin/products/preview");
  const data = await getPublicProductMarketplace({ pageSize: 12 });
  if (!data) {
    return (
      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
        Product marketplace configuration is missing.
      </main>
    );
  }
  return (
    <ProductMarketplacePage
      data={data}
      filters={{}}
      requestHref={getDiscordHref()}
    />
  );
}
