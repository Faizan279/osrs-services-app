import {
  ArrowUpDown,
  BadgeCheck,
  Boxes,
  Filter,
  ImageIcon,
  Search,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { ProductEstimatePanel } from "@/components/product-estimate-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  productAvailabilityLabels,
  productSortLabels,
  productSortOptions,
  productTypeLabels,
  productTypes,
} from "@/lib/products/constants";
import type {
  PublicProductListing,
  getPublicProductMarketplace,
} from "@/lib/products/server";

type MarketplaceData = NonNullable<
  Awaited<ReturnType<typeof getPublicProductMarketplace>>
>;

export function ProductMarketplacePage({
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
            <Badge variant="info">Product marketplace</Badge>
            <Badge variant={data.featureEnabled ? "success" : "warning"}>
              {data.featureEnabled ? "Published products" : "Review mode"}
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

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[20rem_minmax(0,1fr)] lg:py-14">
        <div className="lg:hidden">
          <details className="border-border bg-surface-1 rounded-2xl border p-4">
            <summary className="cursor-pointer font-bold">
              Product filters
            </summary>
            <div className="mt-5">
              <ProductFilters
                filters={filters}
                facets={data.facets}
                total={data.total}
              />
            </div>
          </details>
        </div>
        <div className="hidden lg:block">
          <ProductFilters
            filters={filters}
            facets={data.facets}
            total={data.total}
          />
        </div>
        <section aria-labelledby="product-results-heading">
          {!data.featureEnabled ? (
            <ReviewMode requestHref={requestHref} />
          ) : (
            <>
              <ProductTypeNavigation filters={filters} />
              {data.featuredProducts.length > 0 && (
                <div className="mb-8">
                  <p className="text-primary kicker-type">Featured</p>
                  <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
                    {data.featuredProducts.map((product) => (
                      <ProductCard key={product.stableKey} product={product} />
                    ))}
                  </div>
                </div>
              )}
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2
                    id="product-results-heading"
                    className="display-type text-3xl"
                  >
                    Products
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
              {data.products.length ? (
                <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {data.products.map((product) => (
                    <ProductCard key={product.stableKey} product={product} />
                  ))}
                </div>
              ) : (
                <div className="border-border bg-surface-1 rounded-2xl border p-8">
                  <h3 className="display-type text-2xl">No products found</h3>
                  <p className="text-text-secondary mt-3">
                    Adjust filters or contact support for current product
                    availability.
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

export function ProductDetailPage({
  product,
  requestHref,
}: {
  product: PublicProductListing;
  requestHref: string;
}) {
  const revision = product.revision;
  const cover =
    revision.images.find((image) => image.imageType === "COVER") ??
    revision.images[0];
  return (
    <main id="main-content" className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-10 sm:py-14">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div>
            <div className="flex flex-wrap gap-2">
              <Badge variant="info">
                {productTypeLabels[revision.product.productType]}
              </Badge>
              <Badge
                variant={
                  product.availabilityState === "AVAILABLE"
                    ? "success"
                    : product.availabilityState === "OUT_OF_STOCK"
                      ? "danger"
                      : "warning"
                }
              >
                {productAvailabilityLabels[product.availabilityState]}
              </Badge>
              {revision.product.publicBadgeText && (
                <Badge variant="warning">
                  {revision.product.publicBadgeText}
                </Badge>
              )}
            </div>
            <h1 className="display-type mt-5 max-w-4xl text-4xl sm:text-6xl">
              {revision.product.publicTitle}
            </h1>
            <p className="text-text-secondary mt-5 max-w-3xl text-lg leading-8">
              {revision.product.shortDescription}
            </p>
          </div>
          <aside className="border-gold/25 bg-gold/5 h-fit rounded-2xl border p-6">
            <p className="text-gold kicker-type">Starting price</p>
            <h2 className="display-type mt-2 text-4xl">
              {product.startingPrice}
            </h2>
            <p className="text-text-secondary mt-3 text-sm leading-6">
              {product.stockMessage} Estimates do not reserve stock, create a
              cart, create an order or start a payment.
            </p>
            <Button asChild className="mt-6 w-full">
              <a href={requestHref}>Request support review</a>
            </Button>
          </aside>
        </div>
      </section>

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_24rem] lg:py-14">
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
            <h2 className="display-type text-3xl">Product description</h2>
            <div className="text-text-secondary mt-4 space-y-4 leading-7">
              {revision.product.fullDescription
                .split(/\n{2,}/)
                .map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
            </div>
          </section>
          <TagSection
            title="Public tags"
            items={revision.tags.map((tag) => ({
              key: tag.stableKey,
              label: tag.publicLabel,
            }))}
          />
        </div>
        <aside className="space-y-5">
          <ProductEstimatePanel
            productSlug={product.slug}
            variants={revision.variants}
          />
          <InfoPanel
            icon="shield"
            title="Estimate boundary"
            body="Preview estimates are server-authoritative but non-transactional. Stock is rechecked before a future order can exist."
          />
          <InfoPanel
            icon="boxes"
            title="Customer-safe stock"
            body={product.stockMessage}
          />
        </aside>
      </div>
    </main>
  );
}

function ProductFilters({
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
      <form className="mt-5 grid gap-4" action="/products">
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
              placeholder="Search public product text"
            />
          </span>
        </label>
        <Select name="type" label="Product type" value={filters.type ?? ""}>
          <option value="">All types</option>
          {productTypes.map((type) => (
            <option key={type} value={type}>
              {productTypeLabels[type]}
            </option>
          ))}
        </Select>
        <Select name="category" label="Category" value={filters.category ?? ""}>
          <option value="">All categories</option>
          {facets.categories.map((category) => (
            <option key={category.stableKey} value={category.slug}>
              {category.publicName}
            </option>
          ))}
        </Select>
        <Select
          name="availability"
          label="Availability"
          value={filters.availability ?? ""}
        >
          <option value="">All public states</option>
          {Object.entries(productAvailabilityLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select name="sort" label="Sort" value={filters.sort ?? "featured"}>
          {productSortOptions.map((sort) => (
            <option key={sort} value={sort}>
              {productSortLabels[sort]}
            </option>
          ))}
        </Select>
        <RangeFields
          label="Starting price cents"
          min="minPrice"
          max="maxPrice"
          filters={filters}
        />
        <div className="grid gap-2">
          <label className="text-text-secondary flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="inStock"
              value="1"
              defaultChecked={filters.inStock === "1"}
            />
            In stock only
          </label>
          <label className="text-text-secondary flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              name="featured"
              value="1"
              defaultChecked={filters.featured === "1"}
            />
            Featured only
          </label>
        </div>
        {facets.tags.length > 0 && (
          <CheckboxGroup
            name="tag"
            label="Tags"
            values={(filters.tag ?? "").split(",").filter(Boolean)}
            items={facets.tags}
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

function ProductTypeNavigation({
  filters,
}: {
  filters: Record<string, string>;
}) {
  return (
    <nav aria-label="Product types" className="mb-8 flex flex-wrap gap-2">
      <Button
        asChild
        size="sm"
        variant={!filters.type ? "primary" : "secondary"}
      >
        <Link href="/products">All products</Link>
      </Button>
      {productTypes.map((type) => (
        <Button
          asChild
          key={type}
          size="sm"
          variant={filters.type === type ? "primary" : "secondary"}
        >
          <Link href={`/products?type=${type}`}>{productTypeLabels[type]}</Link>
        </Button>
      ))}
    </nav>
  );
}

function ProductCard({ product }: { product: PublicProductListing }) {
  return (
    <article className="border-border bg-surface-1 overflow-hidden rounded-2xl border">
      <Link href={`/products/${product.slug}`} className="block">
        <div className="relative aspect-[16/10] bg-black/30">
          {product.coverImage ? (
            <Image
              src={product.coverImage.assetPath}
              alt={product.coverImage.altText}
              fill
              sizes="(min-width: 1024px) 28vw, 100vw"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <ImageIcon className="text-text-muted size-8" aria-hidden />
            </div>
          )}
        </div>
        <div className="p-5">
          <div className="flex flex-wrap gap-2">
            <Badge
              variant={
                product.availabilityState === "AVAILABLE"
                  ? "success"
                  : product.availabilityState === "OUT_OF_STOCK"
                    ? "danger"
                    : "warning"
              }
            >
              {productAvailabilityLabels[product.availabilityState]}
            </Badge>
            <Badge variant="info">
              {productTypeLabels[product.productType]}
            </Badge>
          </div>
          <h3 className="mt-4 text-lg font-bold">{product.title}</h3>
          <p className="text-text-secondary mt-2 line-clamp-3 text-sm leading-6">
            {product.shortDescription}
          </p>
          <div className="mt-5 flex items-end justify-between gap-4">
            <div>
              <p className="text-text-muted text-xs font-bold uppercase">
                From
              </p>
              <p className="display-type text-2xl">{product.startingPrice}</p>
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
      <h2 className="display-type text-3xl">Product review mode</h2>
      <p className="text-text-secondary mt-3 max-w-2xl leading-7">
        Product marketplace browsing is paused while staff review item, bond and
        outfit data. Admins can configure products, prices, inventory and stock
        controls while the public flag remains disabled.
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
  items: Array<{ slug: string; label: string }>;
}) {
  const selected = new Set(values);
  return (
    <fieldset className="grid gap-2 border-0 p-0">
      <legend className="text-sm font-semibold">{label}</legend>
      <div className="grid gap-2">
        {items.map((item) => (
          <label
            className="text-text-secondary flex items-center gap-2 text-sm"
            key={item.slug}
          >
            <input
              type="checkbox"
              name={name}
              value={item.slug}
              defaultChecked={selected.has(item.slug)}
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
    <nav aria-label="Product pagination" className="mt-8 flex flex-wrap gap-3">
      <Button asChild variant="secondary" aria-disabled={page <= 1}>
        <Link href={`/products?${previous.toString()}`}>Previous</Link>
      </Button>
      <Button asChild variant="secondary" aria-disabled={page >= pages}>
        <Link href={`/products?${next.toString()}`}>Next</Link>
      </Button>
    </nav>
  );
}

function TagSection({
  title,
  items,
}: {
  title: string;
  items: Array<{ key: string; label: string }>;
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
  icon: "shield" | "boxes";
  title: string;
  body: string;
}) {
  const Icon = icon === "shield" ? ShieldCheck : Boxes;
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
