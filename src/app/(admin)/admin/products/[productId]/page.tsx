import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { ProductDetailTabs, ProductForm } from "@/components/product-admin";
import { requireCapability } from "@/lib/auth/guards";
import {
  getProductAdminCategories,
  getProductAdminProduct,
  getProductMarketplaceAdmin,
} from "@/lib/products/admin";
import { publishProductAction, saveProductAction } from "../actions";

export const metadata = { title: "Product editor" };
export const dynamic = "force-dynamic";

export default async function ProductEditorPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { productId } = await params;
  await requireCapability("products.view", `/admin/products/${productId}`);
  const [product, marketplace, categories, notice] = await Promise.all([
    getProductAdminProduct(productId),
    getProductMarketplaceAdmin(),
    getProductAdminCategories(),
    searchParams,
  ]);
  if (!product || !marketplace) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <h1 className="display-type text-4xl sm:text-5xl">
        {product.publicTitle}
      </h1>
      <p className="text-text-secondary mt-3 max-w-3xl leading-7">
        Public product pages use the latest immutable revision; inventory and
        reservation state remain operational and mutable.
      </p>
      <ProductDetailTabs productId={product.id} />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <ProductForm
          marketplace={marketplace}
          categories={categories}
          product={product}
          action={saveProductAction}
          publishAction={publishProductAction}
        />
      </section>
    </main>
  );
}
