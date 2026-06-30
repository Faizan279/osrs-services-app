import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <main className="mx-auto max-w-5xl space-y-6 px-5 py-16">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-16 w-3/4" />
      <Skeleton className="h-48 w-full" />
    </main>
  );
}
