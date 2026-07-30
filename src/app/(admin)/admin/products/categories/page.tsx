import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { CategoryManager, ProductAdminHero } from "@/components/product-admin";
import { requireCapability } from "@/lib/auth/guards";
import {
  getProductAdminCategories,
  getProductMarketplaceAdmin,
} from "@/lib/products/admin";
import { saveProductCategoryAction } from "../actions";

export const metadata = { title: "Product categories" };
export const dynamic = "force-dynamic";

export default async function ProductCategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("products.view", "/admin/products/categories");
  const [marketplace, categories, notice] = await Promise.all([
    getProductMarketplaceAdmin(),
    getProductAdminCategories(),
    searchParams,
  ]);
  if (!marketplace) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <ProductAdminHero
        title="Product Categories"
        description="Manage customer-safe item, bond and outfit categories. Disable categories instead of deleting referenced product groups."
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <CategoryManager
          marketplace={marketplace}
          categories={categories}
          action={saveProductCategoryAction}
        />
      </section>
    </main>
  );
}
