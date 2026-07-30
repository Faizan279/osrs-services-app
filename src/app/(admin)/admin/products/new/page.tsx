import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { ProductAdminHero, ProductForm } from "@/components/product-admin";
import { requireCapability } from "@/lib/auth/guards";
import {
  getProductAdminCategories,
  getProductMarketplaceAdmin,
} from "@/lib/products/admin";
import { saveProductAction } from "../actions";

export const metadata = { title: "New product" };
export const dynamic = "force-dynamic";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("products.view", "/admin/products/new");
  const [marketplace, categories, notice] = await Promise.all([
    getProductMarketplaceAdmin(),
    getProductAdminCategories(),
    searchParams,
  ]);
  if (!marketplace) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <ProductAdminHero
        title="Create Product"
        description="Create a private draft product. Public pages use only an explicit immutable published revision."
        icon="products"
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <ProductForm
          marketplace={marketplace}
          categories={categories}
          action={saveProductAction}
        />
      </section>
    </main>
  );
}
