import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/guards";

export const metadata = { title: "Customer account" };

export default async function AccountPage() {
  const session = await requireUser("/account");
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 py-8 sm:px-8">
      <BrandLogo priority className="w-44" />
      <Card className="mt-12">
        <CardHeader>
          <p className="text-primary text-sm font-bold tracking-[0.18em] uppercase">
            Customer workspace
          </p>
          <h1 className="display-type text-4xl font-black uppercase">
            Account foundation
          </h1>
        </CardHeader>
        <CardContent className="text-text-secondary space-y-5">
          <p>
            Signed in as {session.user.email}. Dashboard modules are
            intentionally deferred beyond Task 001.
          </p>
          <Button asChild variant="secondary">
            <Link href="/">Return home</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
