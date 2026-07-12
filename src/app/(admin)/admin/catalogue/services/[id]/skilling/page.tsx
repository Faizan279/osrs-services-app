import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import {
  AdminSkillingPreview,
  SkillingRuleForm,
  SkillingSkillCard,
} from "@/components/skilling-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { gameModeLabels } from "@/lib/catalogue/constants";
import { getAdminService } from "@/lib/catalogue/queries";
import { calculateSkillingEstimate } from "@/lib/skilling/estimate";
import { calculateLevelProgress } from "@/lib/skilling/xp";
import {
  saveSkillingRuleAction,
  saveSkillingSkillAction,
} from "../../../actions";

export const metadata = { title: "Skilling calculator management" };
export const dynamic = "force-dynamic";

export default async function AdminSkillingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/skilling`,
  );
  const [service, notice] = await Promise.all([
    getAdminService(id),
    searchParams,
  ]);
  if (!service || service.engineType !== "SKILLING_CALCULATOR") notFound();
  const skills = service.skillingSkills;
  const preview = previewEstimate(service);
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Skilling calculator engine</p>
          <h1 className="display-type mt-3 text-4xl">{service.name}</h1>
          <p className="text-text-muted mt-3">
            {service.hasPendingChanges
              ? "Showing staged skilling configuration."
              : "Showing current saved skilling configuration."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href={`/admin/catalogue/services/${id}`}>
              Service workspace
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/catalogue/services/${id}/skilling/methods/new`}>
              New method
            </Link>
          </Button>
        </div>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader>
            <h2 className="display-type text-2xl">Skilling rules</h2>
            <p className="text-text-muted text-sm">
              Account mode, Discord Stream and delivery adjustments for this
              service only.
            </p>
          </CardHeader>
          <CardContent>
            <SkillingRuleForm
              serviceId={id}
              version={service.version}
              rule={service.skillingRule}
              action={saveSkillingRuleAction}
            />
          </CardContent>
        </Card>
        <aside className="space-y-5">
          <AdminSkillingPreview estimate={preview} />
          <div className="border-border bg-surface-1 rounded-2xl border p-5">
            <h2 className="font-bold">Supported modes</h2>
            <ul className="text-text-secondary mt-3 space-y-2 text-sm">
              {service.gameModes.map(({ gameMode }) => (
                <li key={gameMode}>{gameModeLabels[gameMode]}</li>
              ))}
            </ul>
          </div>
        </aside>
      </div>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-primary kicker-type">Skills</p>
            <h2 className="display-type mt-3 text-3xl">Skill availability</h2>
          </div>
          <span className="text-text-muted text-sm">
            {skills.filter((skill) => skill.enabled).length} enabled /{" "}
            {skills.length} configured
          </span>
        </div>
        <div className="mt-5 grid gap-4">
          {skills.map((skill) => (
            <SkillingSkillCard
              key={skill.id}
              serviceId={id}
              version={service.version}
              skill={skill}
              action={saveSkillingSkillAction}
            />
          ))}
        </div>
      </section>

      <section className="mt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-primary kicker-type">Training methods</p>
            <h2 className="display-type mt-3 text-3xl">Method management</h2>
          </div>
          <Button asChild>
            <Link href={`/admin/catalogue/services/${id}/skilling/methods/new`}>
              New method
            </Link>
          </Button>
        </div>
        <div className="mt-5 grid gap-4">
          {skills.flatMap((skill) =>
            skill.methods.map((method) => (
              <article
                key={method.id}
                className="border-border bg-surface-1 grid gap-4 rounded-2xl border p-5 md:grid-cols-[1fr_auto] md:items-center"
              >
                <div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span
                      className={
                        method.enabled ? "text-success" : "text-warning"
                      }
                    >
                      {method.enabled ? "Active" : "Inactive"}
                    </span>
                    <span className="text-gold">{skill.name}</span>
                    {method.needsClientReview && (
                      <span className="text-warning">Needs client review</span>
                    )}
                  </div>
                  <h3 className="mt-2 text-lg font-bold">{method.name}</h3>
                  <p className="text-text-secondary mt-2 text-sm leading-6">
                    {method.shortDescription}
                  </p>
                  <p className="text-text-muted mt-2 text-xs">
                    Levels {method.minimumLevel}-{method.maximumLevel} -{" "}
                    {method.basePriceCentsPerMillionXp} cents per 1m XP
                  </p>
                </div>
                <Button asChild variant="secondary">
                  <Link
                    href={`/admin/catalogue/services/${id}/skilling/methods/${method.id}`}
                  >
                    Edit
                  </Link>
                </Button>
              </article>
            )),
          )}
          {!skills.some((skill) => skill.methods.length > 0) && (
            <div className="border-border text-text-muted rounded-2xl border border-dashed p-10 text-center">
              No skilling methods configured yet.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function previewEstimate(
  service: NonNullable<Awaited<ReturnType<typeof getAdminService>>>,
) {
  const rule = service.skillingRule;
  const skill = service.skillingSkills.find(
    (candidate) =>
      candidate.enabled && candidate.methods.some((method) => method.enabled),
  );
  const method = skill?.methods.find((candidate) => candidate.enabled);
  const gameMode = service.gameModes[0]?.gameMode;
  if (!rule || !skill || !method || !gameMode) return null;
  try {
    const progress = calculateLevelProgress({
      currentLevel: method.minimumLevel,
      targetLevel: Math.min(99, Math.max(method.minimumLevel + 1, 30)),
    });
    const estimate = calculateSkillingEstimate({
      progress,
      method,
      rule,
      gameMode,
      includeSupplies: false,
      includeDiscordStream: false,
      deliverySpeed: "STANDARD",
    });
    return {
      skillName: skill.name,
      methodName: method.name,
      total: estimate.estimatedTotal,
      xpRequired: estimate.xpRequired,
    };
  } catch {
    return null;
  }
}
