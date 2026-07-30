import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import {
  ProductDetailTabs,
  ProductMediaEditor,
} from "@/components/product-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getProductAdminProduct } from "@/lib/products/admin";
import { saveProductImageAction } from "../../actions";

export const metadata = { title: "Product media" };
export const dynamic = "force-dynamic";

export default async function ProductMediaPage({
  params,
  searchParams,
}: {
  params: Promise<{ productId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { productId } = await params;
  await requireCapability(
    "products.view",
    `/admin/products/${productId}/media`,
  );
  const [product, notice] = await Promise.all([
    getProductAdminProduct(productId),
    searchParams,
  ]);
  if (!product) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <h1 className="display-type text-4xl sm:text-5xl">
        {product.publicTitle}
      </h1>
      <ProductDetailTabs productId={product.id} />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <ProductMediaEditor product={product} action={saveProductImageAction} />
      </section>
    </main>
  );
}
