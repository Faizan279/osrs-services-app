import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import {
  AdminPremiumPreview,
  PremiumOptionCard,
  PremiumPackageCard,
  PremiumRuleForm,
} from "@/components/premium-admin";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import { calculatePremiumEstimate } from "@/lib/premium/estimate";
import { savePremiumRuleAction } from "../../../actions";

export const metadata = { title: "Premium configurator management" };
export const dynamic = "force-dynamic";

export default async function AdminPremiumPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/premium`,
  );
  const [service, notice] = await Promise.all([
    getAdminService(id),
    searchParams,
  ]);
  if (!service || service.engineType !== "PREMIUM_SERVICE_CONFIGURATOR") {
    notFound();
  }
  const preview = previewEstimate(service);

  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Premium configurator engine</p>
          <h1 className="display-type mt-3 text-4xl">{service.name}</h1>
          <p className="text-text-muted mt-3">
            {service.hasPendingChanges
              ? "Showing staged premium configuration."
              : "Showing current saved premium configuration."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild variant="secondary">
            <Link href={`/admin/catalogue/services/${id}`}>
              Service workspace
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/catalogue/services/${id}/premium/packages/new`}>
              New package
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/catalogue/services/${id}/premium/options/new`}>
              New option
            </Link>
          </Button>
        </div>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="border-border bg-surface-1 rounded-2xl border p-6">
          <h2 className="display-type text-2xl">Premium rules</h2>
          <div className="mt-6">
            <PremiumRuleForm
              serviceId={service.id}
              version={service.version}
              rule={service.premiumConfig}
              action={savePremiumRuleAction}
            />
          </div>
        </div>
        <AdminPremiumPreview estimate={preview} />
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="display-type text-3xl">Packages</h2>
          <Badge variant="info">
            {service.premiumPackages.length} configured
          </Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {service.premiumPackages.map((premiumPackage) => (
            <PremiumPackageCard
              premiumPackage={premiumPackage}
              serviceId={service.id}
              key={premiumPackage.id}
            />
          ))}
        </div>
        {!service.premiumPackages.length && (
          <div className="border-border bg-surface-1 rounded-2xl border p-6">
            No premium packages configured yet.
          </div>
        )}
      </section>

      <section className="mt-8">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="display-type text-3xl">Options and add-ons</h2>
          <Badge variant="info">
            {service.premiumOptions.length} configured
          </Badge>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          {service.premiumOptions.map((option) => (
            <PremiumOptionCard
              option={option}
              packages={service.premiumPackages}
              serviceId={service.id}
              key={option.id}
            />
          ))}
        </div>
        {!service.premiumOptions.length && (
          <div className="border-border bg-surface-1 rounded-2xl border p-6">
            No premium options configured yet.
          </div>
        )}
      </section>
    </main>
  );
}

function previewEstimate(
  service: NonNullable<Awaited<ReturnType<typeof getAdminService>>>,
) {
  const rule = service.premiumConfig;
  const premiumPackage = service.premiumPackages.find((item) => item.enabled);
  const gameMode = service.gameModes[0]?.gameMode;
  if (!rule || !premiumPackage || !gameMode) return null;
  try {
    const availableOptions = service.premiumOptions.filter(
      (option) => !option.packageId || option.packageId === premiumPackage.id,
    );
    const estimate = calculatePremiumEstimate({
      package: premiumPackage,
      rule,
      availableOptions,
      selectedOptions: [],
      gameMode,
      customerGearConfirmed: true,
      includeDiscordStream: false,
      deliverySpeed: "STANDARD",
    });
    return {
      packageName: premiumPackage.name,
      total: estimate.estimatedTotal,
      optionCount: availableOptions.length,
    };
  } catch {
    return null;
  }
}
