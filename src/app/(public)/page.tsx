import { Construction } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export default function FoundationPlaceholder() {
  return (
    <main className="grid-pattern mx-auto flex min-h-[calc(100vh-5rem)] max-w-7xl items-center px-5 py-20 lg:px-8">
      <section className="max-w-2xl">
        <Badge variant="success">Foundation online</Badge>
        <h1 className="display-type mt-6 text-5xl leading-[0.95] font-black uppercase sm:text-7xl">
          The storefront is <span className="text-primary">coming next.</span>
        </h1>
        <p className="text-text-secondary mt-6 max-w-xl text-base leading-7 sm:text-lg">
          Task 001 establishes secure authentication, data access, protected
          workspaces, and the OSRS Services component foundation. No homepage or
          catalogue work has started.
        </p>
        <div className="text-text-muted mt-8 flex items-center gap-3 text-sm font-medium">
          <Construction aria-hidden="true" className="text-primary size-5" />
          Project foundation placeholder
        </div>
      </section>
    </main>
  );
}
