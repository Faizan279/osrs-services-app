import { notFound } from "next/navigation";

import {
  CustomBuildAdminHero,
  CustomBuildRulesEditor,
} from "@/components/custom-build-admin";
import { CatalogueNotice } from "@/components/catalogue-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getCustomBuildAdminConfig } from "@/lib/custom-build/admin";
import {
  saveCustomBuildObjectiveRuleAction,
  saveCustomBuildSkillRuleAction,
} from "../actions";

export const metadata = { title: "Custom Build Rules" };
export const dynamic = "force-dynamic";

export default async function CustomBuildRulesPage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  await requireCapability("custom_builds.view", "/admin/custom-builds/rules");
  const [config, notice] = await Promise.all([
    getCustomBuildAdminConfig(),
    searchParams,
  ]);
  if (!config) notFound();
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <CustomBuildAdminHero
        title="Skill And Objective Rules"
        description="Configure server-authoritative integer-cent pricing rules. Draft rules never affect public estimates until published."
      />
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <section className="mt-8">
        <CustomBuildRulesEditor
          config={config}
          skillAction={saveCustomBuildSkillRuleAction}
          objectiveRuleAction={saveCustomBuildObjectiveRuleAction}
        />
      </section>
    </main>
  );
}
