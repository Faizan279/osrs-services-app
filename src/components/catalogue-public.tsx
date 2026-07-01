import { ArrowRight, Clock3, Sparkles } from "lucide-react";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { gameModeLabels } from "@/lib/catalogue/constants";

export type PublicServiceCardData = {
  id: string;
  name: string;
  slug: string;
  shortSummary: string;
  availabilityState: string;
  isFeatured: boolean;
  isQuoteOnly: boolean;
  category: { name: string; slug: string };
  gameModes: { gameMode: keyof typeof gameModeLabels }[];
};

export function ServiceCard({ service }: { service: PublicServiceCardData }) {
  return (
    <article className="border-border bg-surface-1 group hover:border-primary/35 flex h-full flex-col rounded-2xl border p-6 transition hover:-translate-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant={
            service.availabilityState === "AVAILABLE" ? "success" : "warning"
          }
        >
          {service.availabilityState === "AVAILABLE"
            ? "Available"
            : "Quote only"}
        </Badge>
        {service.isFeatured && (
          <Badge variant="warning">
            <Sparkles className="mr-1 size-3" aria-hidden="true" />
            Featured
          </Badge>
        )}
      </div>
      <p className="text-gold mt-6 text-xs font-bold tracking-wider uppercase">
        {service.category.name}
      </p>
      <h2 className="display-type mt-2 text-2xl">{service.name}</h2>
      <p className="text-text-secondary mt-3 flex-1 text-sm leading-6">
        {service.shortSummary}
      </p>
      <ul
        aria-label="Supported game modes"
        className="mt-5 flex flex-wrap gap-2"
      >
        {service.gameModes.map(({ gameMode }) => (
          <li
            key={gameMode}
            className="bg-surface-2 text-text-muted rounded-lg px-2.5 py-1.5 text-xs font-semibold"
          >
            {gameModeLabels[gameMode]}
          </li>
        ))}
      </ul>
      <div className="border-border mt-6 flex items-center justify-between gap-4 border-t pt-5">
        <span className="text-text-muted flex items-center gap-2 text-xs">
          <Clock3 className="size-3.5" aria-hidden="true" />
          Final scope confirmed by quote
        </span>
        <Link
          aria-label={`View ${service.name}`}
          className="text-primary rounded-lg p-2 font-bold focus-visible:ring-2 focus-visible:outline-none"
          href={`/services/${service.category.slug}/${service.slug}`}
        >
          <ArrowRight
            className="size-4 transition group-hover:translate-x-1"
            aria-hidden="true"
          />
        </Link>
      </div>
    </article>
  );
}

export function CatalogueBreadcrumbs({
  items,
}: {
  items: { label: string; href?: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb">
      <ol className="text-text-muted flex flex-wrap items-center gap-2 text-xs">
        {items.map((item, index) => (
          <li key={item.label} className="flex items-center gap-2">
            {index > 0 && <span aria-hidden="true">/</span>}
            {item.href ? (
              <Link className="hover:text-primary" href={item.href}>
                {item.label}
              </Link>
            ) : (
              <span aria-current="page">{item.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
