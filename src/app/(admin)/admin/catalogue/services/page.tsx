import Link from "next/link";

import { StatusBadge, fieldClass } from "@/components/catalogue-admin";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import {
  catalogueAvailabilityStates,
  catalogueEngineTypes,
  cataloguePublicationStatuses,
  engineTypeLabels,
  formatEnumLabel,
} from "@/lib/catalogue/constants";
import { getAdminCategories, getAdminServices } from "@/lib/catalogue/queries";
import {
  archiveServiceAction,
  duplicateServiceAction,
  publishServiceAction,
} from "../actions";

export const metadata = { title: "Catalogue services" };
export const dynamic = "force-dynamic";

type Filters = {
  q?: string;
  category?: string;
  status?: string;
  availability?: string;
  engine?: string;
  featured?: string;
  sort?: string;
  page?: string;
};

export default async function ServicesPage({
  searchParams,
}: {
  searchParams: Promise<Filters>;
}) {
  await requireCapability("products.view", "/admin/catalogue/services");
  const filters = await searchParams;
  const [categories, result] = await Promise.all([
    getAdminCategories(),
    getAdminServices({
      search: filters.q,
      category: filters.category,
      status: filters.status,
      availability: filters.availability,
      engine: filters.engine,
      featured: filters.featured,
      sort: filters.sort,
      page: Math.max(1, Number(filters.page) || 1),
    }),
  ]);
  const pageHref = (page: number) => {
    const params = new URLSearchParams(
      Object.entries(filters).filter((entry): entry is [string, string] =>
        Boolean(entry[1]),
      ),
    );
    params.set("page", String(page));
    return `?${params}`;
  };
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Catalogue management</p>
          <h1 className="display-type mt-3 text-4xl">Services</h1>
          <p className="text-text-secondary mt-3">
            Search, filter, preview and publish reusable catalogue records.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/catalogue/services/new">New service</Link>
        </Button>
      </div>
      <form className="border-border bg-surface-1 mt-8 grid gap-3 rounded-2xl border p-4 md:grid-cols-3 xl:grid-cols-6">
        <label className="sr-only" htmlFor="service-search">
          Search services
        </label>
        <input
          id="service-search"
          className={`${fieldClass} md:col-span-2`}
          name="q"
          defaultValue={filters.q}
          placeholder="Search services"
        />
        <select
          aria-label="Category"
          className={fieldClass}
          name="category"
          defaultValue={filters.category ?? ""}
        >
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Publication status"
          className={fieldClass}
          name="status"
          defaultValue={filters.status ?? ""}
        >
          <option value="">All statuses</option>
          {cataloguePublicationStatuses.map((value) => (
            <option key={value} value={value}>
              {formatEnumLabel(value)}
            </option>
          ))}
        </select>
        <select
          aria-label="Availability"
          className={fieldClass}
          name="availability"
          defaultValue={filters.availability ?? ""}
        >
          <option value="">All availability</option>
          {catalogueAvailabilityStates.map((value) => (
            <option key={value} value={value}>
              {formatEnumLabel(value)}
            </option>
          ))}
        </select>
        <select
          aria-label="Engine"
          className={fieldClass}
          name="engine"
          defaultValue={filters.engine ?? ""}
        >
          <option value="">All engines</option>
          {catalogueEngineTypes.map((value) => (
            <option key={value} value={value}>
              {engineTypeLabels[value]}
            </option>
          ))}
        </select>
        <select
          aria-label="Featured"
          className={fieldClass}
          name="featured"
          defaultValue={filters.featured ?? ""}
        >
          <option value="">Featured or standard</option>
          <option value="true">Featured only</option>
          <option value="false">Standard only</option>
        </select>
        <select
          aria-label="Sort services"
          className={fieldClass}
          name="sort"
          defaultValue={filters.sort ?? "updated"}
        >
          <option value="updated">Recently updated</option>
          <option value="name">Name</option>
          <option value="order">Display order</option>
        </select>
        <Button type="submit" variant="secondary">
          Apply filters
        </Button>
        <Button asChild variant="ghost">
          <Link href="/admin/catalogue/services">Clear</Link>
        </Button>
      </form>
      <p className="text-text-muted mt-5 text-sm">
        {result.total} matching service{result.total === 1 ? "" : "s"}
      </p>
      <div className="border-border bg-surface-1 mt-4 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-4xl text-left text-sm">
          <thead className="bg-surface-2 text-text-muted">
            <tr>
              <th className="p-4">Service</th>
              <th className="p-4">Category</th>
              <th className="p-4">Status</th>
              <th className="p-4">Availability</th>
              <th className="p-4">Engine</th>
              <th className="p-4">Updated</th>
              <th className="p-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {result.items.map((service) => (
              <tr key={service.id}>
                <td className="p-4">
                  <strong>{service.name}</strong>
                  <span className="text-text-muted mt-1 block">
                    /{service.category.slug}/{service.slug}
                  </span>
                  {service.stage && (
                    <span className="text-warning mt-2 block text-xs font-bold">
                      Pending unpublished changes
                    </span>
                  )}
                </td>
                <td className="p-4">{service.category.name}</td>
                <td className="p-4">
                  <StatusBadge status={service.publicationStatus} />
                </td>
                <td className="p-4">
                  <StatusBadge status={service.availabilityState} />
                </td>
                <td className="p-4">{engineTypeLabels[service.engineType]}</td>
                <td className="text-text-muted p-4">
                  {service.updatedAt.toLocaleDateString()}
                </td>
                <td className="p-4">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      className="text-primary rounded-lg px-2 py-2 font-bold"
                      href={`/admin/catalogue/services/${service.id}`}
                    >
                      Edit
                    </Link>
                    <Link
                      className="text-text-secondary rounded-lg px-2 py-2 font-bold"
                      href={`/admin/catalogue/services/${service.id}/preview`}
                    >
                      Preview
                    </Link>
                    <form action={duplicateServiceAction}>
                      <input type="hidden" name="id" value={service.id} />
                      <ConfirmSubmitButton
                        size="sm"
                        variant="ghost"
                        confirmation="Create a private draft copy of this service?"
                      >
                        Duplicate
                      </ConfirmSubmitButton>
                    </form>
                    {service.publicationStatus === "PUBLISHED" &&
                    !service.stage ? (
                      <form action={archiveServiceAction}>
                        <input type="hidden" name="id" value={service.id} />
                        <ConfirmSubmitButton
                          size="sm"
                          variant="ghost"
                          confirmation="Archive this service and remove it from public discovery?"
                        >
                          Archive
                        </ConfirmSubmitButton>
                      </form>
                    ) : service.publicationStatus !== "PUBLISHED" ||
                      service.stage ? (
                      <form action={publishServiceAction}>
                        <input type="hidden" name="id" value={service.id} />
                        <ConfirmSubmitButton
                          size="sm"
                          variant="ghost"
                          confirmation="Publish this saved service?"
                        >
                          {service.stage ? "Republish" : "Publish"}
                        </ConfirmSubmitButton>
                      </form>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <nav
        aria-label="Pagination"
        className="mt-6 flex items-center justify-between"
      >
        <Button
          asChild={result.page > 1}
          disabled={result.page <= 1}
          variant="secondary"
        >
          {result.page > 1 ? (
            <Link href={pageHref(result.page - 1)}>Previous</Link>
          ) : (
            <span>Previous</span>
          )}
        </Button>
        <span className="text-text-muted text-sm">
          Page {result.page} of {result.pages}
        </span>
        <Button
          asChild={result.page < result.pages}
          disabled={result.page >= result.pages}
          variant="secondary"
        >
          {result.page < result.pages ? (
            <Link href={pageHref(result.page + 1)}>Next</Link>
          ) : (
            <span>Next</span>
          )}
        </Button>
      </nav>
    </main>
  );
}
