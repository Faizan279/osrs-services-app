import Link from "next/link";
import { notFound } from "next/navigation";

import { BossingMethodForm } from "@/components/bossing-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import { saveBossingMethodAction } from "../../../../../actions";

export const metadata = { title: "New bossing method" };

export default async function NewBossingMethodPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/bossing/methods/new`,
  );
  const service = await getAdminService(id);
  if (!service || service.engineType !== "BOSSING_ENGINE") notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-gold kicker-type">Bossing calculator engine</p>
          <h1 className="display-type mt-3 text-4xl">New method</h1>
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
          action={saveBossingMethodAction}
        />
      </div>
    </div>
  );
}
