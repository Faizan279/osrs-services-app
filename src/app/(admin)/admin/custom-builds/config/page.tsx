import { notFound } from "next/navigation";

import {
  CustomBuildAdminHero,
  CustomBuildConfigForm,
} from "@/components/custom-build-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getCustomBuildAdminConfig } from "@/lib/custom-build/admin";
import { saveCustomBuildConfigAction } from "../actions";

export const metadata = { title: "Custom Build Configuration" };
export const dynamic = "force-dynamic";

export default async function CustomBuildConfigPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("custom_builds.view", "/admin/custom-builds/config");
  const [config, notice] = await Promise.all([
    getCustomBuildAdminConfig(),
    searchParams,
  ]);
  if (!config) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <CustomBuildAdminHero
        title="Custom Build Config"
        description="Edit public instructions, request intake limits and attachment policy. Draft edits stay private until publication."
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="border-border bg-surface-1 mt-8 rounded-2xl border p-5 sm:p-6">
        <CustomBuildConfigForm
          config={config}
          action={saveCustomBuildConfigAction}
        />
      </section>
    </main>
  );
}
