"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-5">
      <p className="text-danger text-sm font-bold tracking-[0.2em] uppercase">
        Something went wrong
      </p>
      <h1 className="display-type mt-4 text-5xl font-black uppercase">
        We could not load this screen.
      </h1>
      <p className="text-text-secondary mt-4">
        Try the request again. If it continues, check the application logs
        without exposing sensitive values.
      </p>
      <Button onClick={reset} className="mt-8 self-start">
        Try again
      </Button>
    </main>
  );
}
