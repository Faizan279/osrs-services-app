import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CustomBuildEngine } from "@/components/custom-build-engine";
import { getPublicCustomBuildService } from "@/lib/custom-build/server";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Custom OSRS account build quote",
  description:
    "Configure desired OSRS account stats, quests, diaries and unlocks for a secure staff-reviewed quote.",
  robots: { index: true, follow: true },
  alternates: { canonical: "/custom-account-build" },
};

export default async function CustomAccountBuildPage() {
  const data = await getPublicCustomBuildService("custom-account-build");
  if (!data) notFound();
  return (
    <CustomBuildEngine
      service={{
        slug: data.service.slug,
        publicName: data.service.publicName,
        publicDescription: data.service.publicDescription,
        publicInstructions: data.service.publicInstructions,
        attachmentPolicy: data.service.attachmentPolicy,
        customerNoteMaxLength: data.service.customerNoteMaxLength,
      }}
      revision={data.latestRevision}
      featureEnabled={data.featureEnabled}
    />
  );
}
