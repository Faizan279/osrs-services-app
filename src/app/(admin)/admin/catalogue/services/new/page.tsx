import { ServiceForm } from "@/components/catalogue-admin";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminCategories } from "@/lib/catalogue/queries";
import { saveServiceAction } from "../../actions";

export const metadata = { title: "New catalogue service" };
export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  await requireCapability("products.view", "/admin/catalogue/services/new");
  const categories = await getAdminCategories();
  return (
    <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8 lg:py-12">
      <p className="text-gold kicker-type">Catalogue management</p>
      <h1 className="display-type mt-3 text-4xl">New service</h1>
      <p className="text-text-secondary mt-3">
        New records start as drafts and remain private until explicitly
        published.
      </p>
      <Card className="mt-8">
        <CardHeader>
          <h2 className="text-lg font-bold">Service editor</h2>
        </CardHeader>
        <CardContent>
          <form action={saveServiceAction}>
            <ServiceForm categories={categories} />
          </form>
        </CardContent>
      </Card>
    </main>
  );
}
