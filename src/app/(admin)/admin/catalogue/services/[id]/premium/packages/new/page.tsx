import Link from "next/link";
import { notFound } from "next/navigation";

import { PremiumPackageForm } from "@/components/premium-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import { savePremiumPackageAction } from "../../../../../actions";

export const metadata = { title: "New premium package" };

export default async function NewPremiumPackagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/premium/packages/new`,
  );
  const service = await getAdminService(id);
  if (!service || service.engineType !== "PREMIUM_SERVICE_CONFIGURATOR") {
    notFound();
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-gold kicker-type">Premium configurator engine</p>
          <h1 className="display-type mt-3 text-4xl">New package</h1>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/catalogue/services/${id}/premium`}>
            Back to premium
          </Link>
        </Button>
      </div>
      <div className="border-border bg-surface-1 rounded-2xl border p-6">
        <PremiumPackageForm
          serviceId={service.id}
          version={service.version}
          action={savePremiumPackageAction}
        />
      </div>
    </div>
  );
}
