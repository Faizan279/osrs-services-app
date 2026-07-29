import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomBuildTrackingView } from "@/components/custom-build-engine";
import { getTrackedCustomBuildRequest } from "@/lib/custom-build/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Custom build request tracking",
  robots: { index: false, follow: false, nocache: true },
};

export default async function CustomBuildTrackingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const data = await getTrackedCustomBuildRequest(token);
  if (!data) notFound();
  return <CustomBuildTrackingView data={data} token={token} />;
}
