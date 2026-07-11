import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import {
  deleteOfferingAction,
  duplicateOfferingAction,
} from "../../../actions";

export const metadata = { title: "Catalogue offerings" };
export const dynamic = "force-dynamic";

export default async function OfferingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { id } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/offerings`,
  );
  const [service, notice] = await Promise.all([
    getAdminService(id),
    searchParams,
  ]);
  if (!service) notFound();
  return (
    <main className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Catalogue card engine</p>
          <h1 className="display-type mt-3 text-4xl">
            Offerings for {service.name}
          </h1>
          <p className="text-text-muted mt-3">
            {service.offerings.length} editable offering
            {service.offerings.length === 1 ? "" : "s"}.{" "}
            {service.hasPendingChanges
              ? "Showing staged changes."
              : "Showing the current aggregate."}
          </p>
        </div>
        <div className="flex gap-3">
          <Button asChild variant="secondary">
            <Link href={`/admin/catalogue/services/${id}`}>
              Service workspace
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/admin/catalogue/services/${id}/offerings/new`}>
              New offering
            </Link>
          </Button>
        </div>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <div className="mt-6 grid gap-4">
        {service.offerings.map((offering) => (
          <article
            className="border-border bg-surface-1 grid gap-4 rounded-2xl border p-5 md:grid-cols-[1fr_auto] md:items-center"
            key={offering.id}
          >
            <div>
              <div className="flex flex-wrap gap-2 text-xs">
                <span
                  className={
                    offering.isActive ? "text-success" : "text-warning"
                  }
                >
                  {offering.isActive ? "Active" : "Inactive"}
                </span>
                {offering.isFeatured && (
                  <span className="text-gold">Featured</span>
                )}
                <span className="text-text-muted">
                  Order {offering.displayOrder}
                </span>
              </div>
              <h2 className="mt-2 text-lg font-bold">{offering.name}</h2>
              <p className="text-text-secondary mt-2 text-sm">
                {offering.shortSummary}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="secondary">
                <Link
                  href={`/admin/catalogue/services/${id}/offerings/${offering.id}`}
                >
                  Edit
                </Link>
              </Button>
              <form action={duplicateOfferingAction}>
                <input type="hidden" name="serviceId" value={id} />
                <input type="hidden" name="offeringId" value={offering.id} />
                <input
                  type="hidden"
                  name="expectedVersion"
                  value={service.version}
                />
                <Button type="submit" variant="secondary">
                  Duplicate
                </Button>
              </form>
              <form action={deleteOfferingAction}>
                <input type="hidden" name="serviceId" value={id} />
                <input type="hidden" name="offeringId" value={offering.id} />
                <input
                  type="hidden"
                  name="expectedVersion"
                  value={service.version}
                />
                <Button type="submit" variant="destructive">
                  Remove
                </Button>
              </form>
            </div>
          </article>
        ))}
        {service.offerings.length === 0 && (
          <div className="border-border text-text-muted rounded-2xl border border-dashed p-10 text-center">
            No offerings yet. Add the first reusable catalogue card.
          </div>
        )}
      </div>
    </main>
  );
}
