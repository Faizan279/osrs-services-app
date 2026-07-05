import Link from "next/link";

import { StatusBadge, fieldClass } from "@/components/catalogue-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminCategories } from "@/lib/catalogue/queries";

export const metadata = { title: "Catalogue categories" };
export const dynamic = "force-dynamic";

export default async function CategoriesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; active?: string }>;
}) {
  await requireCapability("products.view", "/admin/catalogue/categories");
  const { q = "", active = "" } = await searchParams;
  const categories = await getAdminCategories(q, active);
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Catalogue taxonomy</p>
          <h1 className="display-type mt-3 text-4xl">Categories</h1>
          <p className="text-text-secondary mt-3">
            Stable, ordered entry points for public service discovery.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/catalogue/categories/new">New category</Link>
        </Button>
      </div>
      <form className="mt-8 grid max-w-3xl gap-3 sm:grid-cols-[minmax(0,1fr)_12rem_auto]">
        <label className="sr-only" htmlFor="category-search">
          Search categories
        </label>
        <input
          id="category-search"
          className={fieldClass}
          name="q"
          defaultValue={q}
          placeholder="Search category name or slug"
        />
        <select
          aria-label="Visibility"
          className={fieldClass}
          name="active"
          defaultValue={active}
        >
          <option value="">Active and inactive</option>
          <option value="true">Active only</option>
          <option value="false">Inactive only</option>
        </select>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>
      <div className="border-border bg-surface-1 mt-6 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-2xl text-left text-sm">
          <thead className="bg-surface-2 text-text-muted">
            <tr>
              <th className="p-4">Category</th>
              <th className="p-4">Status</th>
              <th className="p-4">Order</th>
              <th className="p-4">Services</th>
              <th className="p-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {categories.map((category) => (
              <tr key={category.id}>
                <td className="p-4">
                  <strong>{category.name}</strong>
                  <span className="text-text-muted mt-1 block">
                    /{category.slug}
                  </span>
                </td>
                <td className="p-4">
                  <StatusBadge
                    status={category.isActive ? "AVAILABLE" : "UNAVAILABLE"}
                  />
                </td>
                <td className="p-4">{category.displayOrder}</td>
                <td className="p-4">{category._count.services}</td>
                <td className="p-4 text-right">
                  <Link
                    className="text-primary font-bold"
                    href={`/admin/catalogue/categories/${category.id}`}
                  >
                    Edit
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
