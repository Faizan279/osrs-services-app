import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProductDetailPage } from "@/components/product-marketplace";
import { getDiscordHref } from "@/config/public-navigation";
import { getPublicProductDetail } from "@/lib/products/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ productSlug: string }>;
}): Promise<Metadata> {
  const { productSlug } = await params;
  const data = await getPublicProductDetail(productSlug);
  if (!data) return { title: "Product not found" };
  const product = data.product.revision.product;
  const cover =
    data.product.revision.images.find((image) => image.imageType === "COVER") ??
    data.product.revision.images[0];
  return {
    title: product.publicTitle,
    description: product.shortDescription,
    alternates: { canonical: `/products/${product.slug}` },
    openGraph: {
      title: product.publicTitle,
      description: product.shortDescription,
      url: `/products/${product.slug}`,
      ...(cover
        ? { images: [{ url: cover.assetPath, alt: cover.altText }] }
        : {}),
    },
  };
}

export default async function ProductPage({
  params,
}: {
  params: Promise<{ productSlug: string }>;
}) {
  const { productSlug } = await params;
  const data = await getPublicProductDetail(productSlug);
  if (!data) notFound();
  return (
    <ProductDetailPage product={data.product} requestHref={getDiscordHref()} />
  );
}
