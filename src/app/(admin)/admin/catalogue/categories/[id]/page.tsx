import { notFound } from "next/navigation";

import { CatalogueNotice, CategoryForm } from "@/components/catalogue-admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminCategory } from "@/lib/catalogue/queries";
import { saveCategoryAction } from "../../actions";

export const metadata = { title: "Edit catalogue category" };
export const dynamic = "force-dynamic";

export default async function EditCategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { id } = await params;
  await requireCapability("products.view", `/admin/catalogue/categories/${id}`);
  const [category, notice] = await Promise.all([
    getAdminCategory(id),
    searchParams,
  ]);
  if (!category) notFound();
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
      <p className="text-gold kicker-type">Catalogue taxonomy</p>
      <h1 className="display-type mt-3 text-4xl">{category.name}</h1>
      <p className="text-text-muted mt-2 text-sm">
        {category._count.services} linked services
      </p>
      <Card className="mt-8">
        <CardHeader>
          <CatalogueNotice {...notice} />
          <h2 className="text-lg font-bold">Category details</h2>
        </CardHeader>
        <CardContent>
          <form action={saveCategoryAction}>
            <CategoryForm category={category} />
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
