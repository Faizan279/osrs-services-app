import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { OfferingForm } from "@/components/offering-admin";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import { saveOfferingAction } from "../../../../actions";

export default async function NewOfferingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/offerings/new`,
  );
  const [service, notice] = await Promise.all([
    getAdminService(id),
    searchParams,
  ]);
  if (!service) notFound();
  return (
    <main className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
      <Link
        className="text-primary text-sm font-bold"
        href={`/admin/catalogue/services/${id}/offerings`}
      >
        ← Offerings
      </Link>
      <h1 className="display-type mt-5 text-4xl">New offering</h1>
      <p className="text-text-muted mt-3">
        For {service.name}. Published services keep this private until
        republish.
      </p>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
        <OfferingForm
          action={saveOfferingAction}
          serviceId={id}
          version={service.version}
          parentModes={service.gameModes.map(({ gameMode }) => gameMode)}
        />
      </div>
    </main>
  );
}
