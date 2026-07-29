import { notFound } from "next/navigation";

import {
  CustomBuildAdminHero,
  CustomBuildObjectivesEditor,
} from "@/components/custom-build-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getCustomBuildAdminConfig } from "@/lib/custom-build/admin";
import { saveCustomBuildObjectiveAction } from "../actions";

export const metadata = { title: "Custom Build Objectives" };
export const dynamic = "force-dynamic";

export default async function CustomBuildObjectivesPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability(
    "custom_builds.view",
    "/admin/custom-builds/objectives",
  );
  const [config, notice] = await Promise.all([
    getCustomBuildAdminConfig(),
    searchParams,
  ]);
  if (!config) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <CustomBuildAdminHero
        title="Build Objectives"
        description="Manage quests, diaries, unlocks and other customer-selectable objectives without inferring hidden account state."
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <CustomBuildObjectivesEditor
          config={config}
          action={saveCustomBuildObjectiveAction}
        />
      </section>
    </main>
  );
}
