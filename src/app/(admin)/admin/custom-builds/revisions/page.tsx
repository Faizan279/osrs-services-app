import { notFound } from "next/navigation";

import {
  CustomBuildAdminHero,
  CustomBuildRevisionHistory,
} from "@/components/custom-build-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getCustomBuildAdminConfig } from "@/lib/custom-build/admin";
import {
  discardCustomBuildDraftAction,
  publishCustomBuildAction,
  restoreCustomBuildRevisionAction,
} from "../actions";

export const metadata = { title: "Custom Build Revisions" };
export const dynamic = "force-dynamic";

export default async function CustomBuildRevisionsPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability(
    "custom_builds.publish",
    "/admin/custom-builds/revisions",
  );
  const [config, notice] = await Promise.all([
    getCustomBuildAdminConfig(),
    searchParams,
  ]);
  if (!config) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <CustomBuildAdminHero
        title="Published Revisions"
        description="Publish immutable custom-build configuration snapshots, discard draft changes or restore an old revision into a new draft."
        icon="history"
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <CustomBuildRevisionHistory
          config={config}
          publishAction={publishCustomBuildAction}
          discardAction={discardCustomBuildDraftAction}
          restoreAction={restoreCustomBuildRevisionAction}
        />
      </section>
    </main>
  );
}
