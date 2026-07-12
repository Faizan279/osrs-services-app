import Link from "next/link";
import { notFound } from "next/navigation";

import { BossingMethodForm } from "@/components/bossing-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import { saveBossingMethodAction } from "../../../../../actions";

export const metadata = { title: "Edit bossing method" };

export default async function EditBossingMethodPage({
  params,
}: {
  params: Promise<{ id: string; methodId: string }>;
}) {
  const { id, methodId } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/bossing/methods/${methodId}`,
  );
  const service = await getAdminService(id);
  if (!service || service.engineType !== "BOSSING_ENGINE") notFound();
  const owner = service.bossingBosses.find((boss) =>
    boss.methods.some((method) => method.id === methodId),
  );
  const method = owner?.methods.find((item) => item.id === methodId);
  if (!owner || !method) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-gold kicker-type">Bossing calculator engine</p>
          <h1 className="display-type mt-3 text-4xl">{method.name}</h1>
          <p className="text-text-secondary mt-3">Boss: {owner.name}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/catalogue/services/${id}/bossing`}>
            Back to bossing
          </Link>
        </Button>
      </div>
      <div className="border-border bg-surface-1 rounded-2xl border p-6">
        <BossingMethodForm
          serviceId={service.id}
          version={service.version}
          bosses={service.bossingBosses}
          method={method}
          methodBossId={owner.id}
          action={saveBossingMethodAction}
        />
      </div>
    </div>
  );
}
