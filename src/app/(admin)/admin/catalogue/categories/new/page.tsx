import { CategoryForm } from "@/components/catalogue-admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { saveCategoryAction } from "../../actions";

export const metadata = { title: "New catalogue category" };

export default async function NewCategoryPage() {
  await requireCapability("products.view", "/admin/catalogue/categories/new");
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
      <p className="text-gold kicker-type">Catalogue taxonomy</p>
      <h1 className="display-type mt-3 text-4xl">New category</h1>
      <Card className="mt-8">
        <CardHeader>
          <h2 className="text-lg font-bold">Category details</h2>
        </CardHeader>
        <CardContent>
          <form action={saveCategoryAction}>
            <CategoryForm />
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
