import { notFound } from "next/navigation";

import { CustomBuildEngine } from "@/components/custom-build-engine";
import { requireCapability } from "@/lib/auth/guards";
import { getPublicCustomBuildService } from "@/lib/custom-build/server";

export const metadata = { title: "Custom Build Preview" };
export const dynamic = "force-dynamic";

export default async function CustomBuildPreviewPage() {
  await requireCapability("custom_builds.view", "/admin/custom-builds/preview");
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
