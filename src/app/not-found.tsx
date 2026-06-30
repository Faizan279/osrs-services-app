import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5">
      <p className="text-primary text-sm font-bold tracking-[0.2em] uppercase">
        404
      </p>
      <h1 className="display-type mt-4 text-5xl font-black uppercase">
        This route does not exist.
      </h1>
      <p className="text-text-secondary mt-4">
        The requested foundation screen could not be found.
      </p>
      <Button asChild className="mt-8 self-start">
        <Link href="/">Return home</Link>
      </Button>
    </main>
  );
}
