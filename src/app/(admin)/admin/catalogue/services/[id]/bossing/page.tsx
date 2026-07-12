import Link from "next/link";
import { notFound } from "next/navigation";

import {
  AdminBossingPreview,
  BossingBossCard,
  BossingRuleForm,
} from "@/components/bossing-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import {
  calculateBossingEstimate,
  calculateBossingKillProgress,
} from "@/lib/bossing/estimate";
import { saveBossingRuleAction } from "../../../actions";

export const metadata = { title: "Bossing calculator management" };

export default async function AdminBossingPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/bossing`,
  );
  const service = await getAdminService(id);
  if (!service || service.engineType !== "BOSSING_ENGINE") notFound();
  const preview = previewEstimate(service);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-gold kicker-type">Bossing calculator engine</p>
          <h1 className="display-type mt-3 text-4xl">{service.name}</h1>
          <p className="text-text-secondary mt-3 max-w-3xl">
            {service.hasPendingChanges
              ? "Showing staged bossing configuration."
              : "Showing current saved bossing configuration."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href={`/admin/catalogue/services/${id}`}>
              Back to service
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/catalogue/services/${id}/bossing/bosses/new`}>
              New boss
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/catalogue/services/${id}/bossing/methods/new`}>
              New method
            </Link>
          </Button>
        </div>
      </div>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="border-border bg-surface-1 rounded-2xl border p-6">
          <h2 className="display-type text-2xl">Bossing rules</h2>
          <div className="mt-6">
            <BossingRuleForm
              serviceId={service.id}
              version={service.version}
              rule={service.bossingRule}
              action={saveBossingRuleAction}
            />
          </div>
        </div>
        <AdminBossingPreview estimate={preview} />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="display-type text-3xl">Bosses</h2>
          <Badge variant="info">
            {service.bossingBosses.length} configured
          </Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {service.bossingBosses.map((boss) => (
            <BossingBossCard boss={boss} serviceId={service.id} key={boss.id} />
          ))}
        </div>
        {!service.bossingBosses.length && (
          <div className="border-border bg-surface-1 rounded-2xl border p-6">
            No bossing bosses configured yet.
          </div>
        )}
      </section>

      <section>
        <h2 className="display-type text-3xl">Methods</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="border-border bg-surface-1 min-w-[760px] overflow-hidden rounded-2xl border text-left text-sm">
            <thead className="bg-background/60 text-text-muted">
              <tr>
                <th className="p-4">Method</th>
                <th className="p-4">Boss</th>
                <th className="p-4">Range</th>
                <th className="p-4">State</th>
                <th className="p-4">Review</th>
                <th className="p-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {service.bossingBosses.flatMap((boss) =>
                boss.methods.map((method) => (
                  <tr className="border-border border-t" key={method.id}>
                    <td className="p-4 font-semibold">{method.name}</td>
                    <td className="p-4">{boss.name}</td>
                    <td className="p-4">
                      {method.minimumKillCount.toLocaleString()}-
                      {method.maximumKillCount?.toLocaleString() ?? "unlimited"}
                    </td>
                    <td className="p-4">
                      <Badge variant={method.enabled ? "success" : "warning"}>
                        {method.enabled ? "Public" : "Hidden"}
                      </Badge>
                    </td>
                    <td className="p-4">
                      {method.needsClientReview ? "Needs review" : "Reviewed"}
                    </td>
                    <td className="p-4">
                      <Button asChild variant="ghost">
                        <Link
                          href={`/admin/catalogue/services/${id}/bossing/methods/${method.id}`}
                        >
                          Edit
                        </Link>
                      </Button>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function previewEstimate(
  service: NonNullable<Awaited<ReturnType<typeof getAdminService>>>,
) {
  const rule = service.bossingRule;
  const boss = service.bossingBosses.find((item) => item.enabled);
  const method = boss?.methods.find((item) => item.enabled);
  if (!rule || !boss || !method) return null;
  try {
    const progress = calculateBossingKillProgress({
      mode: "DIRECT",
      killQuantity: Math.max(25, method.minimumKillCount),
    });
    const estimate = calculateBossingEstimate({
      progress,
      method,
      rule,
      gameMode: service.gameModes[0]?.gameMode ?? "NORMAL",
      customerGearConfirmed: true,
      includeSupplies: false,
      includeDiscordStream: false,
      deliverySpeed: "STANDARD",
    });
    return {
      bossName: boss.name,
      methodName: method.name,
      total: estimate.estimatedTotal,
      requestedKills: estimate.requestedKills,
    };
  } catch {
    return null;
  }
}
