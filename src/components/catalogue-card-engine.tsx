"use client";

import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useState, useTransition } from "react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { gameModeLabels, formatEnumLabel } from "@/lib/catalogue/constants";

type Requirement = {
  id: string;
  title: string;
  description: string;
  isRequired: boolean;
  verificationMode: string;
  customerGuidance: string | null;
  recommendedService: {
    name: string;
    slug: string;
    publicationStatus: string;
    publishAt?: Date | string | null;
    unpublishAt?: Date | string | null;
    category: { slug: string; isActive?: boolean | null };
  } | null;
};

type Offering = {
  id: string;
  slug: string;
  name: string;
  shortSummary: string;
  description: string | null;
  isFeatured: boolean;
  groupLabel: string | null;
  tierLabel: string | null;
  quantityEnabled: boolean;
  quantityUnit: string | null;
  minimumQuantity: number | null;
  maximumQuantity: number | null;
  effectiveGameModes: Array<{ gameMode: keyof typeof gameModeLabels }>;
  facets: Array<{ id: string; label: string }>;
  requirements: Requirement[];
};

type EligibilityResponse = {
  ok: boolean;
  message?: string;
  profile?: { displayName: string; fetchedAt: string; cached: boolean };
  offering?: { name: string } | null;
  results?: Array<{
    id: string;
    title: string;
    status:
      | "MET"
      | "NOT_MET"
      | "CUSTOMER_CONFIRMATION_REQUIRED"
      | "SUPPORT_VERIFICATION_REQUIRED";
    actualValue: number | null;
    requiredValue: number | null;
    customerGuidance: string | null;
    recommendation: { name: string; href: string } | null;
  }>;
};

function dateValue(value: Date | string | null | undefined) {
  if (!value) return null;
  return value instanceof Date ? value : new Date(value);
}

function isReachableRecommendation(
  service: NonNullable<Requirement["recommendedService"]>,
) {
  const now = new Date();
  const publishAt = dateValue(service.publishAt);
  const unpublishAt = dateValue(service.unpublishAt);
  return (
    service.publicationStatus === "PUBLISHED" &&
    service.category.isActive !== false &&
    (!publishAt || publishAt <= now) &&
    (!unpublishAt || unpublishAt > now)
  );
}

export function CatalogueCardEngine({
  service,
  offerings,
  availableFacets,
  total,
  page,
  pages,
  filters,
  eligibilityEnabled,
  requestHref,
}: {
  service: {
    id: string;
    name: string;
    content: string;
    requirements: Requirement[];
    gameModes: Array<{ gameMode: keyof typeof gameModeLabels }>;
  };
  offerings: Offering[];
  availableFacets: Array<{
    facetKey: string;
    facetValue: string;
    label: string;
  }>;
  total: number;
  page: number;
  pages: number;
  filters: {
    search: string;
    gameMode: string;
    sort: string;
    facets: Record<string, string>;
  };
  eligibilityEnabled: boolean;
  requestHref: string;
}) {
  const facetGroups = Map.groupBy(availableFacets, (facet) => facet.facetKey);
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 lg:py-16">
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="border-border bg-surface-1 rounded-2xl border p-6">
          <h2 className="display-type text-3xl">About this service</h2>
          <div className="text-text-secondary mt-4 space-y-3 leading-7">
            {service.content.split(/\n{2,}/).map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
          <h2 className="display-type mt-8 text-2xl">Requirements</h2>
          <p className="text-text-secondary mt-3 text-sm leading-6">
            Service-wide and offering-specific requirements are shown in each
            offering&apos;s accessible requirements dialog.
          </p>
        </div>
        <aside className="border-gold/25 bg-gold/5 rounded-2xl border p-6">
          <p className="text-gold kicker-type">Service request</p>
          <h2 className="display-type mt-3 text-2xl">
            Request a tailored quote
          </h2>
          <p className="text-text-secondary mt-3 text-sm leading-6">
            Pricing and expected timing are confirmed only after requirements
            are reviewed.
          </p>
          <Button asChild className="mt-6 w-full">
            <a href={requestHref}>Request a quote</a>
          </Button>
        </aside>
      </section>
      <EligibilityChecker
        serviceId={service.id}
        offerings={offerings.map(({ id, name }) => ({ id, name }))}
        enabled={eligibilityEnabled}
      />
      <form
        className="border-border bg-surface-1 mt-10 grid gap-4 rounded-2xl border p-5 lg:grid-cols-[minmax(0,1fr)_14rem_13rem_auto]"
        method="get"
      >
        <label className="text-text-secondary grid gap-2 text-sm font-semibold">
          Search offerings
          <span className="relative">
            <Search
              className="text-text-muted absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              className="border-border bg-background min-h-11 w-full rounded-xl border pr-3 pl-10"
              type="search"
              maxLength={80}
              name="q"
              defaultValue={filters.search}
            />
          </span>
        </label>
        <label className="text-text-secondary grid gap-2 text-sm font-semibold">
          Game mode
          <select
            className="border-border bg-background min-h-11 rounded-xl border px-3"
            name="mode"
            defaultValue={filters.gameMode}
          >
            <option value="">All modes</option>
            {service.gameModes.map(({ gameMode }) => (
              <option value={gameMode} key={gameMode}>
                {gameModeLabels[gameMode]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-text-secondary grid gap-2 text-sm font-semibold">
          Sort
          <select
            className="border-border bg-background min-h-11 rounded-xl border px-3"
            name="sort"
            defaultValue={filters.sort}
          >
            <option value="featured">Featured first</option>
            <option value="name">Name</option>
            <option value="order">Curated order</option>
          </select>
        </label>
        <Button className="self-end" type="submit">
          Apply
        </Button>
        {[...facetGroups].map(([key, options]) => (
          <label
            className="text-text-secondary grid gap-2 text-sm font-semibold"
            key={key}
          >
            {formatEnumLabel(key)}
            <select
              className="border-border bg-background min-h-11 rounded-xl border px-3"
              name={`f_${key}`}
              defaultValue={filters.facets[key] ?? ""}
            >
              <option value="">All</option>
              {options.map((option) => (
                <option value={option.facetValue} key={option.facetValue}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </form>
      <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
        <p className="text-text-secondary" role="status">
          {total} offering{total === 1 ? "" : "s"}
        </p>
        {(filters.search ||
          filters.gameMode ||
          Object.keys(filters.facets).length > 0) && (
          <a className="text-primary text-sm font-bold" href="?">
            Clear filters
          </a>
        )}
      </div>
      {offerings.length > 0 ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {offerings.map((offering) => (
            <article
              className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl border p-5 ${offering.isFeatured ? "border-gold/50 bg-[linear-gradient(145deg,rgba(50,41,25,.65),rgba(8,16,11,.98))]" : "border-border bg-surface-1"}`}
              key={offering.id}
            >
              {offering.isFeatured && (
                <Badge className="mb-4 w-fit" variant="warning">
                  Featured
                </Badge>
              )}
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-gold font-bold">
                  {offering.groupLabel}
                </span>
                <span className="text-text-muted">{offering.tierLabel}</span>
              </div>
              <h2 className="display-type mt-3 text-2xl">{offering.name}</h2>
              <p className="text-text-secondary mt-3 flex-1 text-sm leading-6">
                {offering.shortSummary}
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                {offering.effectiveGameModes.map(({ gameMode }) => (
                  <span
                    className="border-border bg-background/60 rounded-full border px-2.5 py-1 text-xs"
                    key={gameMode}
                  >
                    {gameModeLabels[gameMode]}
                  </span>
                ))}
              </div>
              {offering.quantityEnabled && (
                <label className="text-text-secondary mt-5 grid gap-2 text-xs font-bold">
                  Requested {offering.quantityUnit}
                  <input
                    className="border-border bg-background min-h-11 rounded-xl border px-3 text-sm"
                    type="number"
                    min={offering.minimumQuantity ?? 0}
                    max={offering.maximumQuantity ?? undefined}
                    defaultValue={offering.minimumQuantity ?? 1}
                  />
                </label>
              )}
              <p className="text-text-muted mt-5 text-xs">
                {service.requirements.length + offering.requirements.length}{" "}
                requirement
                {service.requirements.length + offering.requirements.length ===
                1
                  ? ""
                  : "s"}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <RequirementDialog
                  serviceRequirements={service.requirements}
                  offering={offering}
                />
                <Button asChild>
                  <a href={requestHref}>Request review</a>
                </Button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="border-border text-text-muted mt-6 rounded-2xl border border-dashed p-12 text-center">
          <CircleHelp className="mx-auto mb-4 size-7" aria-hidden="true" />
          No active offerings match these filters.
        </div>
      )}
      {pages > 1 && (
        <nav
          aria-label="Offering pages"
          className="mt-8 flex items-center justify-center gap-3"
        >
          <PageLink page={page - 1} disabled={page <= 1} filters={filters}>
            <ChevronLeft className="size-4" /> Previous
          </PageLink>
          <span className="text-text-muted text-sm">
            Page {page} of {pages}
          </span>
          <PageLink page={page + 1} disabled={page >= pages} filters={filters}>
            Next <ChevronRight className="size-4" />
          </PageLink>
        </nav>
      )}
    </div>
  );
}

function RequirementDialog({
  serviceRequirements,
  offering,
}: {
  serviceRequirements: Requirement[];
  offering: Offering;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="secondary">View requirements</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogTitle>{offering.name} requirements</DialogTitle>
        <DialogDescription>
          Review service-wide and option-specific checks before requesting
          support.
        </DialogDescription>
        <RequirementGroup
          title="Service requirements"
          items={serviceRequirements}
        />
        <RequirementGroup
          title="Offering requirements"
          items={offering.requirements}
        />
      </DialogContent>
    </Dialog>
  );
}

function RequirementGroup({
  title,
  items,
}: {
  title: string;
  items: Requirement[];
}) {
  return (
    <section className="mt-6">
      <h3 className="font-bold">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-3">
          {items.map((item) => (
            <li className="border-border rounded-xl border p-4" key={item.id}>
              <div className="flex items-center justify-between gap-3">
                <strong>{item.title}</strong>
                <span className="text-gold text-xs">
                  {item.isRequired ? "Required" : "Optional"}
                </span>
              </div>
              <p className="text-text-secondary mt-2 text-sm leading-6">
                {item.description}
              </p>
              <p className="text-text-muted mt-2 text-xs">
                {verificationLabel(item.verificationMode)}
              </p>
              {item.customerGuidance && (
                <p className="text-text-secondary mt-2 text-xs">
                  {item.customerGuidance}
                </p>
              )}
              {item.recommendedService &&
                isReachableRecommendation(item.recommendedService) && (
                  <a
                    className="text-primary mt-3 inline-block text-xs font-bold"
                    href={`/services/${item.recommendedService.category.slug}/${item.recommendedService.slug}`}
                  >
                    Recommended: {item.recommendedService.name}
                  </a>
                )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-text-muted mt-3 text-sm">
          No additional requirements.
        </p>
      )}
    </section>
  );
}

function verificationLabel(mode: string) {
  if (mode === "AUTOMATIC")
    return "Checked against supported public statistics";
  if (mode === "CUSTOMER_CONFIRMED") return "Customer confirmation required";
  return "Support verification required";
}

function EligibilityChecker({
  serviceId,
  offerings,
  enabled,
}: {
  serviceId: string;
  offerings: Array<{ id: string; name: string }>;
  enabled: boolean;
}) {
  const [result, setResult] = useState<EligibilityResponse | null>(null);
  const [pending, startTransition] = useTransition();
  function submit(formData: FormData) {
    setResult(null);
    startTransition(async () => {
      try {
        const response = await fetch("/api/catalogue/eligibility", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rsn: formData.get("rsn"),
            serviceId,
            offeringId: formData.get("offeringId") || undefined,
          }),
        });
        setResult((await response.json()) as EligibilityResponse);
      } catch {
        setResult({
          ok: false,
          message: "The check could not be completed. Please try again.",
        });
      }
    });
  }
  return (
    <section className="border-primary/25 rounded-3xl border bg-[linear-gradient(135deg,rgba(28,53,24,.75),rgba(5,12,8,.98))] p-6 sm:p-8">
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,30rem)] lg:items-start">
        <div>
          <p className="text-primary kicker-type">Public stats check</p>
          <h2 className="display-type mt-3 text-3xl">
            Check account eligibility
          </h2>
          <p className="text-text-secondary mt-3 max-w-2xl leading-7">
            Only public Old School RuneScape statistics are checked. No password
            is needed, and quest completion, gear, inventory and account
            ownership cannot be verified here.
          </p>
        </div>
        {enabled ? (
          <form action={submit} className="grid gap-3">
            <label className="text-sm font-bold">
              RuneScape name
              <input
                className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                name="rsn"
                maxLength={12}
                autoComplete="off"
                required
              />
            </label>
            <label className="text-sm font-bold">
              Service option
              <select
                className="border-border bg-background mt-2 min-h-11 w-full rounded-xl border px-3"
                name="offeringId"
              >
                <option value="">Service requirements only</option>
                {offerings.map((offering) => (
                  <option value={offering.id} key={offering.id}>
                    {offering.name}
                  </option>
                ))}
              </select>
            </label>
            <Button type="submit" disabled={pending}>
              {pending ? "Checking public stats…" : "Check eligibility"}
            </Button>
          </form>
        ) : (
          <div className="border-warning/30 bg-warning/10 text-text-secondary rounded-2xl border p-5 text-sm">
            Public stats checks are temporarily unavailable. Every requirement
            remains available for manual review.
          </div>
        )}
      </div>
      {result && (
        <EligibilityResults result={result} onReset={() => setResult(null)} />
      )}
    </section>
  );
}

function EligibilityResults({
  result,
  onReset,
}: {
  result: EligibilityResponse;
  onReset: () => void;
}) {
  if (!result.ok)
    return (
      <div
        className="border-danger/30 bg-danger/10 mt-6 rounded-2xl border p-5"
        role="alert"
      >
        <div className="flex gap-3">
          <AlertCircle
            className="text-danger mt-0.5 size-5 shrink-0"
            aria-hidden="true"
          />
          <p>{result.message}</p>
        </div>
        <Button
          className="mt-4"
          variant="secondary"
          type="button"
          onClick={onReset}
        >
          Change name
        </Button>
      </div>
    );
  return (
    <div
      className="border-border bg-background/45 mt-6 rounded-2xl border p-5"
      aria-live="polite"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-bold">
            Results for {result.profile?.displayName}
          </h3>
          <p className="text-text-muted mt-1 text-xs">
            Public statistics checked{" "}
            {result.profile?.cached ? "from a recent secure cache" : "just now"}
            .
          </p>
        </div>
        <Button variant="secondary" size="sm" type="button" onClick={onReset}>
          Change name
        </Button>
      </div>
      <ul className="mt-5 space-y-3">
        {result.results?.map((item) => {
          const met = item.status === "MET";
          const unresolved = item.status.endsWith("REQUIRED");
          const Icon = met
            ? CheckCircle2
            : unresolved
              ? ShieldCheck
              : AlertCircle;
          return (
            <li
              className="border-border grid gap-3 rounded-xl border p-4 sm:grid-cols-[auto_1fr]"
              key={item.id}
            >
              <Icon
                className={
                  met
                    ? "text-success size-5"
                    : unresolved
                      ? "text-warning size-5"
                      : "text-danger size-5"
                }
                aria-hidden="true"
              />
              <div>
                <div className="flex flex-wrap justify-between gap-2">
                  <strong>{item.title}</strong>
                  <span className="text-xs font-bold">
                    {formatEnumLabel(item.status)}
                  </span>
                </div>
                {item.actualValue != null && (
                  <p className="text-text-muted mt-2 text-xs">
                    Public value: {item.actualValue.toLocaleString()} ·
                    Required: {item.requiredValue?.toLocaleString()}
                  </p>
                )}
                {item.customerGuidance && (
                  <p className="text-text-secondary mt-2 text-sm">
                    {item.customerGuidance}
                  </p>
                )}
                {item.recommendation && (
                  <a
                    className="text-primary mt-2 inline-block text-sm font-bold"
                    href={item.recommendation.href}
                  >
                    Recommended: {item.recommendation.name}
                  </a>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function PageLink({
  page,
  disabled,
  filters,
  children,
}: {
  page: number;
  disabled: boolean;
  filters: {
    search: string;
    gameMode: string;
    sort: string;
    facets: Record<string, string>;
  };
  children: React.ReactNode;
}) {
  const query = new URLSearchParams();
  if (filters.search) query.set("q", filters.search);
  if (filters.gameMode) query.set("mode", filters.gameMode);
  if (filters.sort !== "featured") query.set("sort", filters.sort);
  Object.entries(filters.facets).forEach(([key, value]) =>
    query.set(`f_${key}`, value),
  );
  query.set("page", String(page));
  return (
    <a
      aria-disabled={disabled}
      className={`border-border inline-flex min-h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold ${disabled ? "pointer-events-none opacity-40" : "hover:border-primary"}`}
      href={`?${query}`}
    >
      {children}
    </a>
  );
}
