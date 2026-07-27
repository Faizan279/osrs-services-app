import {
  ArrowUpDown,
  BadgeCheck,
  Clock3,
  Filter,
  ImageIcon,
  Search,
  ShieldCheck,
  Swords,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  accountAvailabilityLabels,
  accountGameModeLabels,
  accountSortLabels,
  accountSortOptions,
} from "@/lib/accounts/constants";
import type { getPublicAccountMarketplace } from "@/lib/accounts/server";
import { formatCents } from "@/lib/pricing/engine";

type MarketplaceData = NonNullable<
  Awaited<ReturnType<typeof getPublicAccountMarketplace>>
>;
type Listing = MarketplaceData["listings"][number];

export function AccountMarketplacePage({
  data,
  filters,
  requestHref,
}: {
  data: MarketplaceData;
  filters: Record<string, string>;
  requestHref: string;
}) {
  const marketplace = data.marketplace;
  return (
    <main id="main-content" className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant="info">Account marketplace</Badge>
            <Badge variant={data.featureEnabled ? "success" : "warning"}>
              {data.featureEnabled ? "Published listings" : "Review mode"}
            </Badge>
          </div>
          <p className="text-gold kicker-type mt-8">
            {marketplace.service.category.name}
          </p>
          <h1 className="display-type mt-4 max-w-4xl text-4xl sm:text-6xl">
            {marketplace.publicName}
          </h1>
          <p className="text-text-secondary mt-5 max-w-3xl text-lg leading-8">
            {marketplace.description}
          </p>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[19rem_minmax(0,1fr)] lg:py-14">
        <AccountFilters
          filters={filters}
          facets={data.facets}
          total={data.total}
        />
        <section aria-labelledby="account-results-heading">
          {!data.featureEnabled ? (
            <ReviewMode requestHref={requestHref} />
          ) : (
            <>
              {data.featuredListings.length > 0 && (
                <div className="mb-8">
                  <p className="text-primary kicker-type">Featured</p>
                  <div className="mt-4 grid gap-5 md:grid-cols-3">
                    {data.featuredListings.map((listing) => (
                      <AccountListingCard
                        key={listing.stableKey}
                        listing={listing}
                        compact
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2
                    id="account-results-heading"
                    className="display-type text-3xl"
                  >
                    Account listings
                  </h2>
                  <p
                    className="text-text-muted mt-1 text-sm"
                    aria-live="polite"
                  >
                    {data.total} result{data.total === 1 ? "" : "s"}
                  </p>
                </div>
                <Badge variant="info">
                  Page {data.page} of {data.pages}
                </Badge>
              </div>
              {data.listings.length ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {data.listings.map((listing) => (
                    <AccountListingCard
                      key={listing.stableKey}
                      listing={listing}
                    />
                  ))}
                </div>
              ) : (
                <div className="border-border bg-surface-1 rounded-2xl border p-8">
                  <h3 className="display-type text-2xl">No listings found</h3>
                  <p className="text-text-secondary mt-3">
                    Adjust the filters or request support review for current
                    account availability.
                  </p>
                  <Button asChild className="mt-5" variant="secondary">
                    <a href={requestHref}>Contact support</a>
                  </Button>
                </div>
              )}
              <Pagination
                page={data.page}
                pages={data.pages}
                filters={filters}
              />
            </>
          )}
        </section>
      </div>
    </main>
  );
}

export function AccountListingDetailPage({
  listing,
  requestHref,
}: {
  listing: Listing;
  requestHref: string;
}) {
  const revision = listing.revision;
  const cover =
    revision.images.find((image) => image.imageType === "COVER") ??
    revision.images[0];
  return (
    <main id="main-content" className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-10 sm:py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_23rem]">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">
                {accountGameModeLabels[revision.listing.gameMode]}
              </Badge>
              <Badge
                variant={
                  listing.availability === "AVAILABLE" ? "success" : "warning"
                }
              >
                {accountAvailabilityLabels[listing.availability]}
              </Badge>
              {revision.listing.publicBadgeText && (
                <Badge variant="warning">
                  {revision.listing.publicBadgeText}
                </Badge>
              )}
            </div>
            <h1 className="display-type mt-5 max-w-4xl text-4xl sm:text-6xl">
              {revision.listing.publicTitle}
            </h1>
            <p className="text-text-secondary mt-5 max-w-3xl text-lg leading-8">
              {revision.listing.shortDescription}
            </p>
          </div>
          <aside className="border-gold/25 bg-gold/5 h-fit rounded-2xl border p-6">
            <p className="text-gold kicker-type">Server price</p>
            <h2 className="display-type mt-2 text-4xl">
              {formatCents(revision.listing.basePriceCents)}
            </h2>
            <p className="text-text-secondary mt-3 text-sm leading-6">
              Global pricing may be appended by the server when enabled.
              Availability is rechecked before any future checkout step.
            </p>
            <Button asChild className="mt-6 w-full">
              <a href={requestHref}>Check availability</a>
            </Button>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:py-14">
        <div className="space-y-10">
          <section>
            <h2 className="display-type text-3xl">Gallery</h2>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {(cover ? revision.images : []).map((image) => (
                <figure
                  key={image.stableKey}
                  className="border-border bg-surface-1 overflow-hidden rounded-2xl border"
                >
                  <div className="relative aspect-[16/10]">
                    <Image
                      src={image.assetPath}
                      alt={image.altText}
                      fill
                      sizes="(min-width: 1024px) 40vw, 100vw"
                      className="object-cover"
                    />
                  </div>
                  {image.caption && (
                    <figcaption className="text-text-secondary p-4 text-sm">
                      {image.caption}
                    </figcaption>
                  )}
                </figure>
              ))}
            </div>
          </section>
          <section>
            <h2 className="display-type text-3xl">Public description</h2>
            <div className="text-text-secondary mt-4 space-y-4 leading-7">
              {revision.listing.fullDescription.split(/\n{2,}/).map((item) => (
                <p key={item}>{item}</p>
              ))}
            </div>
          </section>
          <section>
            <h2 className="display-type text-3xl">Stats</h2>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {revision.stats.map((stat) => (
                <div
                  className="border-border bg-surface-1 rounded-2xl border p-5"
                  key={stat.stableKey}
                >
                  <p className="text-text-muted text-xs font-bold uppercase">
                    {stat.statGroup}
                  </p>
                  <p className="mt-2 font-bold">{stat.publicLabel}</p>
                  <p className="display-type mt-1 text-3xl">
                    {stat.value}
                    {stat.maximumValue ? (
                      <span className="text-text-muted text-base">
                        /{stat.maximumValue}
                      </span>
                    ) : null}
                  </p>
                </div>
              ))}
            </div>
          </section>
          <TagSection
            title="Unlocks"
            items={revision.unlocks.map((unlock) => ({
              key: unlock.stableKey,
              label: unlock.publicLabel,
              description: unlock.description,
            }))}
          />
          <TagSection
            title="Features"
            items={revision.features.map((feature) => ({
              key: feature.stableKey,
              label: feature.publicLabel,
              description: feature.description,
            }))}
          />
        </div>
        <aside className="space-y-5">
          <InfoPanel
            icon="shield"
            title="Secure handover"
            body={revision.listing.secureHandoverLabel}
          />
          <InfoPanel
            icon="clock"
            title="Availability"
            body={accountAvailabilityLabels[listing.availability]}
          />
          <InfoPanel
            icon="swords"
            title="Account mode"
            body={accountGameModeLabels[revision.listing.gameMode]}
          />
          <div className="border-border bg-surface-1 rounded-2xl border p-5">
            <h2 className="font-bold">Important boundary</h2>
            <p className="text-text-secondary mt-3 text-sm leading-6">
              This listing does not include checkout, payment, reservation,
              ownership transfer or credential handover.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}

function AccountFilters({
  filters,
  facets,
  total,
}: {
  filters: Record<string, string>;
  facets: MarketplaceData["facets"];
  total: number;
}) {
  return (
    <aside className="border-border bg-surface-1 h-fit rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        <Filter className="text-primary size-4" aria-hidden="true" />
        <h2 className="font-bold">Filters</h2>
      </div>
      <form className="mt-5 grid gap-4" action="/accounts">
        <label className="grid gap-2 text-sm font-semibold">
          Search
          <span className="relative">
            <Search
              className="text-text-muted absolute top-3 left-3 size-4"
              aria-hidden="true"
            />
            <input
              className="border-border bg-background min-h-11 w-full rounded-xl border pr-3 pl-10"
              name="q"
              defaultValue={filters.q ?? ""}
              placeholder="Search public listing text"
            />
          </span>
        </label>
        <Select name="mode" label="Game mode" value={filters.mode ?? ""}>
          <option value="">All modes</option>
          {Object.entries(accountGameModeLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          name="availability"
          label="Availability"
          value={filters.availability ?? ""}
        >
          <option value="">Visible listings</option>
          {Object.entries(accountAvailabilityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="sort" label="Sort" value={filters.sort ?? "featured"}>
          {accountSortOptions.map((value) => (
            <option key={value} value={value}>
              {accountSortLabels[value]}
            </option>
          ))}
        </Select>
        <RangeFields
          label="Price cents"
          min="minPrice"
          max="maxPrice"
          filters={filters}
        />
        <RangeFields
          label="Combat level"
          min="minCombat"
          max="maxCombat"
          filters={filters}
        />
        <RangeFields
          label="Total level"
          min="minTotal"
          max="maxTotal"
          filters={filters}
        />
        {facets.features.length > 0 && (
          <CheckboxGroup
            name="feature"
            label="Features"
            values={(filters.feature ?? "").split(",").filter(Boolean)}
            items={facets.features}
          />
        )}
        {facets.unlocks.length > 0 && (
          <CheckboxGroup
            name="unlock"
            label="Unlocks"
            values={(filters.unlock ?? "").split(",").filter(Boolean)}
            items={facets.unlocks}
          />
        )}
        <Button type="submit">
          <ArrowUpDown className="mr-2 size-4" aria-hidden="true" />
          Apply filters
        </Button>
        <p className="text-text-muted text-xs" aria-live="polite">
          {total} result{total === 1 ? "" : "s"} after filtering.
        </p>
      </form>
    </aside>
  );
}

function AccountListingCard({
  listing,
  compact = false,
}: {
  listing: Listing;
  compact?: boolean;
}) {
  return (
    <article className="border-border bg-surface-1 overflow-hidden rounded-2xl border">
      <Link href={`/accounts/${listing.slug}`} className="block">
        <div className="relative aspect-[16/10] bg-black/30">
          {listing.coverImage ? (
            <Image
              src={listing.coverImage.assetPath}
              alt={listing.coverImage.altText}
              fill
              sizes="(min-width: 1024px) 28vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon
                className="text-text-muted size-8"
                aria-hidden="true"
              />
            </div>
          )}
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                listing.availability === "AVAILABLE" ? "success" : "warning"
              }
            >
              {accountAvailabilityLabels[listing.availability]}
            </Badge>
            <Badge variant="info">
              {
                accountGameModeLabels[
                  listing.gameMode as keyof typeof accountGameModeLabels
                ]
              }
            </Badge>
          </div>
          <h3 className="mt-4 text-lg font-bold">{listing.title}</h3>
          {!compact && (
            <p className="text-text-secondary mt-2 line-clamp-3 text-sm leading-6">
              {listing.shortDescription}
            </p>
          )}
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-text-muted text-xs font-bold uppercase">
                Price
              </p>
              <p className="display-type text-2xl">{listing.price}</p>
            </div>
            <span className="text-primary text-sm font-bold">View details</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

function ReviewMode({ requestHref }: { requestHref: string }) {
  return (
    <div className="border-warning/30 bg-warning/10 rounded-2xl border p-8">
      <h2 className="display-type text-3xl">Marketplace review mode</h2>
      <p className="text-text-secondary mt-3 max-w-2xl leading-7">
        Account listings are being prepared. Admins can configure listings,
        approvals and handover readiness, but public browsing is paused until
        the feature flag is enabled.
      </p>
      <Button asChild className="mt-6" variant="secondary">
        <a href={requestHref}>Contact support</a>
      </Button>
    </div>
  );
}

function Select({
  name,
  label,
  value,
  children,
}: {
  name: string;
  label: string;
  value: string;
  children: ReactNode;
}) {
  return (
    <label className="grid gap-2 text-sm font-semibold">
      {label}
      <select
        className="border-border bg-background min-h-11 rounded-xl border px-3"
        name={name}
        defaultValue={value}
      >
        {children}
      </select>
    </label>
  );
}

function RangeFields({
  label,
  min,
  max,
  filters,
}: {
  label: string;
  min: string;
  max: string;
  filters: Record<string, string>;
}) {
  return (
    <fieldset className="grid gap-2 border-0 p-0">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="grid grid-cols-2 gap-2">
        <input
          className="border-border bg-background min-h-11 rounded-xl border px-3"
          name={min}
          type="number"
          min="0"
          placeholder="Min"
          defaultValue={filters[min] ?? ""}
        />
        <input
          className="border-border bg-background min-h-11 rounded-xl border px-3"
          name={max}
          type="number"
          min="0"
          placeholder="Max"
          defaultValue={filters[max] ?? ""}
        />
      </div>
    </fieldset>
  );
}

function CheckboxGroup({
  name,
  label,
  values,
  items,
}: {
  name: string;
  label: string;
  values: string[];
  items: Array<{ key: string; label: string }>;
}) {
  const selected = new Set(values);
  return (
    <fieldset className="grid gap-2 border-0 p-0">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="grid gap-2">
        {items.map((item) => (
          <label
            className="text-text-secondary flex items-center gap-2 text-sm"
            key={item.key}
          >
            <input
              type="checkbox"
              name={name}
              value={item.key}
              defaultChecked={selected.has(item.key)}
            />
            {item.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Pagination({
  page,
  pages,
  filters,
}: {
  page: number;
  pages: number;
  filters: Record<string, string>;
}) {
  if (pages <= 1) return null;
  const previous = new URLSearchParams(filters);
  previous.set("page", String(Math.max(1, page - 1)));
  const next = new URLSearchParams(filters);
  next.set("page", String(Math.min(pages, page + 1)));
  return (
    <nav
      aria-label="Account listing pagination"
      className="mt-8 flex flex-wrap gap-3"
    >
      <Button asChild variant="secondary" aria-disabled={page <= 1}>
        <Link href={`/accounts?${previous.toString()}`}>Previous</Link>
      </Button>
      <Button asChild variant="secondary" aria-disabled={page >= pages}>
        <Link href={`/accounts?${next.toString()}`}>Next</Link>
      </Button>
    </nav>
  );
}

function TagSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; label: string; description?: string | null }>;
}) {
  if (!items.length) return null;
  return (
    <section>
      <h2 className="display-type text-3xl">{title}</h2>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <div
            className="border-border bg-surface-1 rounded-2xl border p-5"
            key={item.key}
          >
            <div className="flex items-center gap-2">
              <BadgeCheck className="text-primary size-4" aria-hidden="true" />
              <h3 className="font-bold">{item.label}</h3>
            </div>
            {item.description && (
              <p className="text-text-secondary mt-2 text-sm leading-6">
                {item.description}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function InfoPanel({
  icon,
  title,
  body,
}: {
  icon: "shield" | "clock" | "swords";
  title: string;
  body: string;
}) {
  const Icon =
    icon === "shield" ? ShieldCheck : icon === "clock" ? Clock3 : Swords;
  return (
    <div className="border-border bg-surface-1 rounded-2xl border p-5">
      <div className="flex items-center gap-2">
        <Icon className="text-primary size-4" aria-hidden="true" />
        <h2 className="font-bold">{title}</h2>
      </div>
      <p className="text-text-secondary mt-3 text-sm leading-6">{body}</p>
    </div>
  );
}
