import type { Metadata } from "next";
import Link from "next/link";

import {
  CatalogueBreadcrumbs,
  ServiceCard,
} from "@/components/catalogue-public";
import { Button } from "@/components/ui/button";
import { fieldClass } from "@/components/catalogue-admin";
import {
  getPublicCategories,
  getPublicServices,
} from "@/lib/catalogue/queries";

export const metadata: Metadata = {
  title: "OSRS service catalogue",
  description:
    "Browse development-safe OSRS service listings by category and account mode.",
};
export const dynamic = "force-dynamic";

export default async function ServicesDirectoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q = "", category = "" } = await searchParams;
  const [categories, services] = await Promise.all([
    getPublicCategories(),
    getPublicServices({
      search: q.trim() || undefined,
      categorySlug: category || undefined,
    }),
  ]);
  return (
    <main id="main-content" className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <CatalogueBreadcrumbs
            items={[{ label: "Home", href: "/" }, { label: "Services" }]}
          />
          <p className="text-gold kicker-type mt-8">Public catalogue</p>
          <h1 className="display-type mt-4 max-w-4xl text-4xl sm:text-6xl">
            Find a service path for your next milestone.
          </h1>
          <p className="text-text-secondary mt-5 max-w-2xl text-base leading-7">
            Browse published services without invented pricing or delivery
            claims. Requirements and supported account modes stay visible before
            you request a quote.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
        <form
          role="search"
          className="border-border bg-surface-1 grid gap-3 rounded-2xl border p-4 sm:grid-cols-[minmax(0,1fr)_15rem_auto]"
        >
          <label className="sr-only" htmlFor="catalogue-search">
            Search catalogue
          </label>
          <input
            id="catalogue-search"
            className={fieldClass}
            name="q"
            defaultValue={q}
            placeholder="Search services and descriptions"
          />
          <select
            className={fieldClass}
            aria-label="Filter by category"
            name="category"
            defaultValue={category}
          >
            <option value="">All categories</option>
            {categories
              .filter((item) => item._count.services > 0)
              .map((item) => (
                <option key={item.id} value={item.slug}>
                  {item.name} ({item._count.services})
                </option>
              ))}
          </select>
          <Button type="submit">Search</Button>
        </form>
        <nav
          aria-label="Service categories"
          className="mt-6 flex flex-wrap gap-2"
        >
          <Link
            className={`rounded-full border px-4 py-2 text-xs font-bold ${!category ? "border-primary bg-primary-muted text-primary" : "border-border text-text-secondary"}`}
            href="/services"
          >
            All services
          </Link>
          {categories
            .filter((item) => item._count.services > 0)
            .map((item) => (
              <Link
                key={item.id}
                className={`rounded-full border px-4 py-2 text-xs font-bold ${category === item.slug ? "border-primary bg-primary-muted text-primary" : "border-border text-text-secondary"}`}
                href={`/services?category=${item.slug}`}
              >
                {item.name}
              </Link>
            ))}
        </nav>
        <div className="mt-10 flex items-center justify-between">
          <h2 className="display-type text-2xl">
            {q
              ? `Results for “${q}”`
              : category
                ? (categories.find((item) => item.slug === category)?.name ??
                  "Services")
                : "All services"}
          </h2>
          <span className="text-text-muted text-sm">
            {services.length} result{services.length === 1 ? "" : "s"}
          </span>
        </div>
        {services.length ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <div className="border-border bg-surface-1 mt-6 rounded-2xl border p-10 text-center">
            <h2 className="display-type text-2xl">No matching services</h2>
            <p className="text-text-secondary mt-3">
              Try a broader search or browse all published services.
            </p>
            <Button asChild className="mt-5">
              <Link href="/services">Clear filters</Link>
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
