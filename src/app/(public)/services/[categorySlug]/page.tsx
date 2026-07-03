import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  CatalogueBreadcrumbs,
  ServiceCard,
} from "@/components/catalogue-public";
import { getPublicCategory } from "@/lib/catalogue/queries";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}): Promise<Metadata> {
  const { categorySlug } = await params;
  const category = await getPublicCategory(categorySlug);
  if (!category) return { title: "Service category not found" };
  return {
    title: category.seoTitle ?? category.name,
    description: category.seoDescription ?? category.shortDescription,
    alternates: { canonical: `/services/${category.slug}` },
    openGraph: {
      title: category.seoTitle ?? category.name,
      description: category.seoDescription ?? category.shortDescription,
      url: `/services/${category.slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
}: {
  params: Promise<{ categorySlug: string }>;
}) {
  const { categorySlug } = await params;
  const category = await getPublicCategory(categorySlug);
  if (!category) notFound();
  return (
    <main id="main-content" className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <CatalogueBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Services", href: "/services" },
              { label: category.name },
            ]}
          />
          <p className="text-gold kicker-type mt-8">Service category</p>
          <h1 className="display-type mt-4 text-4xl sm:text-6xl">
            {category.name}
          </h1>
          <p className="text-text-secondary mt-5 max-w-2xl leading-7">
            {category.description ?? category.shortDescription}
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="flex items-center justify-between">
          <h2 className="display-type text-2xl">Services in this category</h2>
          <span className="text-text-muted text-sm">
            {category.services.length} result
            {category.services.length === 1 ? "" : "s"}
          </span>
        </div>
        {category.services.length ? (
          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {category.services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        ) : (
          <div className="border-border bg-surface-1 mt-6 rounded-2xl border p-8">
            <p className="text-text-secondary">
              No services are currently available in this category.
            </p>
          </div>
        )}
      </section>
    </main>
  );
}
