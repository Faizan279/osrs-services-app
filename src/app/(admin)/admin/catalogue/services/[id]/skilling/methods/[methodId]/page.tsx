import Link from "next/link";
import { notFound } from "next/navigation";

import { CatalogueNotice } from "@/components/catalogue-admin";
import { SkillingMethodForm } from "@/components/skilling-admin";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireCapability } from "@/lib/auth/guards";
import { getAdminService } from "@/lib/catalogue/queries";
import { saveSkillingMethodAction } from "../../../../../actions";

export const metadata = { title: "Edit skilling method" };
export const dynamic = "force-dynamic";

export default async function EditSkillingMethodPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; methodId: string }>;
  searchParams: Promise<{ state?: string; message?: string }>;
}) {
  const { id, methodId } = await params;
  await requireCapability(
    "products.view",
    `/admin/catalogue/services/${id}/skilling/methods/${methodId}`,
  );
  const [service, notice] = await Promise.all([
    getAdminService(id),
    searchParams,
  ]);
  if (!service || service.engineType !== "SKILLING_CALCULATOR") notFound();
  const owner = service.skillingSkills.find((skill) =>
    skill.methods.some((method) => method.id === methodId),
  );
  const method = owner?.methods.find((item) => item.id === methodId);
  if (!owner || !method) notFound();
  return (
    <main className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Skilling calculator engine</p>
          <h1 className="display-type mt-3 text-4xl">{method.name}</h1>
          <p className="text-text-muted mt-3">Current skill: {owner.name}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href={`/admin/catalogue/services/${id}/skilling`}>
            Back to skilling
          </Link>
        </Button>
      </div>
      <div className="mt-8">
        <CatalogueNotice {...notice} />
      </div>
      <Card className="mt-6">
        <CardHeader>
          <h2 className="font-bold">Method editor</h2>
        </CardHeader>
        <CardContent>
          <SkillingMethodForm
            serviceId={id}
            version={service.version}
            skills={service.skillingSkills}
            method={method}
            methodSkillId={owner.id}
            action={saveSkillingMethodAction}
          />
        </CardContent>
      </Card>
    </main>
  );
}
