import Link from "next/link";
import { notFound } from "next/navigation";

import { BossingBossForm } from "@/components/bossing-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import { saveBossingBossAction } from "../../../../../actions";

export const metadata = { title: "New bossing boss" };

export default async function NewBossingBossPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/bossing/bosses/new`,
  );
  const service = await getAdminService(id);
  if (!service || service.engineType !== "BOSSING_ENGINE") notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-gold kicker-type">Bossing calculator engine</p>
          <h1 className="display-type mt-3 text-4xl">New boss</h1>
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
          action={saveBossingBossAction}
        />
      </div>
    </div>
  );
}
