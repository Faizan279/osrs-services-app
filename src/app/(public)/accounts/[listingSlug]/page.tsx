import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { AccountListingDetailPage } from "@/components/account-marketplace";
import { getDiscordHref } from "@/config/public-navigation";
import { getPublicAccountListingDetail } from "@/lib/accounts/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ listingSlug: string }>;
}): Promise<Metadata> {
  const { listingSlug } = await params;
  const data = await getPublicAccountListingDetail(listingSlug);
  if (!data) return { title: "Account listing not found" };
  const listing = data.listing.revision.listing;
  const cover =
    data.listing.revision.images.find((image) => image.imageType === "COVER") ??
    data.listing.revision.images[0];
  return {
    title: listing.publicTitle,
    description: listing.shortDescription,
    alternates: { canonical: `/accounts/${listing.slug}` },
    openGraph: {
      title: listing.publicTitle,
      description: listing.shortDescription,
      url: `/accounts/${listing.slug}`,
      ...(cover
        ? { images: [{ url: cover.assetPath, alt: cover.altText }] }
        : {}),
    },
  };
}

export default async function AccountListingPage({
  params,
}: {
  params: Promise<{ listingSlug: string }>;
}) {
  const { listingSlug } = await params;
  const data = await getPublicAccountListingDetail(listingSlug);
  if (!data) notFound();
  return (
    <AccountListingDetailPage
      listing={data.listing}
      requestHref={getDiscordHref()}
    />
  );
}
