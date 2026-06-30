import { ArrowRight, Blocks, Database, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export const metadata = { title: "Admin foundation" };

const foundations = [
  {
    icon: Database,
    title: "Data foundation",
    copy: "Normalized roles, permissions, sessions, flags, and audit records.",
  },
  {
    icon: ShieldCheck,
    title: "Authorization",
    copy: "Server-enforced capability checks protect every admin route.",
  },
  {
    icon: Blocks,
    title: "Design system",
    copy: "Reusable primitives ready for later approved modules.",
  },
];

export default function AdminPage() {
  return (
    <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 lg:py-12">
      <Badge variant="success">Task 001</Badge>
      <h1 className="display-type mt-5 text-4xl font-black uppercase sm:text-5xl">
        Foundation overview
      </h1>
      <p className="text-text-secondary mt-3 max-w-2xl text-base leading-7">
        The operational foundation is online. Business modules remain
        intentionally outside this task.
      </p>
      <section className="mt-10 grid gap-4 md:grid-cols-3">
        {foundations.map(({ icon: Icon, title, copy }) => (
          <Card key={title}>
            <CardHeader>
              <Icon aria-hidden="true" className="text-primary size-6" />
              <h2 className="pt-3 text-lg font-bold">{title}</h2>
            </CardHeader>
            <CardContent>
              <p className="text-text-secondary text-sm leading-6">{copy}</p>
            </CardContent>
          </Card>
        ))}
      </section>
      <Button asChild size="lg" className="mt-8">
        <Link href="/admin/design-system">
          Open component showcase <ArrowRight className="size-4" />
        </Link>
      </Button>
    </main>
  );
}
