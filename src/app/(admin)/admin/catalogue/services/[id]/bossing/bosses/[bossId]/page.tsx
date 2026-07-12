import Link from "next/link";
import { notFound } from "next/navigation";

import { BossingBossForm } from "@/components/bossing-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import { saveBossingBossAction } from "../../../../../actions";

export const metadata = { title: "Edit bossing boss" };

export default async function EditBossingBossPage({
  params,
}: {
  params: Promise<{ id: string; bossId: string }>;
}) {
  const { id, bossId } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/bossing/bosses/${bossId}`,
  );
  const service = await getAdminService(id);
  if (!service || service.engineType !== "BOSSING_ENGINE") notFound();
  const boss = service.bossingBosses.find((item) => item.id === bossId);
  if (!boss) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-gold kicker-type">Bossing calculator engine</p>
          <h1 className="display-type mt-3 text-4xl">{boss.name}</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/catalogue/services/${id}/bossing`}>
            Back to bossing
          </Link>
        </Button>
      </div>
      <div className="border-border bg-surface-1 rounded-2xl border p-6">
        <BossingBossForm
          serviceId={service.id}
          version={service.version}
          boss={boss}
          action={saveBossingBossAction}
        />
      </div>
    </div>
  );
}
