import Link from "next/link";
import { notFound } from "next/navigation";

import { PremiumOptionForm } from "@/components/premium-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import { savePremiumOptionAction } from "../../../../../actions";

export const metadata = { title: "Edit premium option" };

export default async function EditPremiumOptionPage({
  params,
}: {
  params: Promise<{ id: string; optionId: string }>;
}) {
  const { id, optionId } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/premium/options/${optionId}`,
  );
  const service = await getAdminService(id);
  if (!service || service.engineType !== "PREMIUM_SERVICE_CONFIGURATOR") {
    notFound();
  }
  const option = service.premiumOptions.find((item) => item.id === optionId);
  if (!option) notFound();

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-gold kicker-type">Premium configurator engine</p>
          <h1 className="display-type mt-3 text-4xl">{option.name}</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/catalogue/services/${id}/premium`}>
            Back to premium
          </Link>
        </Button>
      </div>
      <div className="border-border bg-surface-1 rounded-2xl border p-6">
        <PremiumOptionForm
          serviceId={service.id}
          version={service.version}
          packages={service.premiumPackages}
          option={option}
          action={savePremiumOptionAction}
        />
      </div>
    </div>
  );
}
