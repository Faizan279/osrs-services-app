import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function Forbidden() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5">
      <p className="text-warning text-sm font-bold tracking-[0.2em] uppercase">
        403
      </p>
      <h1 className="display-type mt-4 text-5xl font-black uppercase">
        Capability required.
      </h1>
      <p className="text-text-secondary mt-4">
        Your session is valid, but it does not grant access to this protected
        screen.
      </p>
      <Button asChild variant="secondary" className="mt-8 self-start">
        <Link href="/account">Go to account</Link>
      </Button>
    </main>
  );
}
