import {
  ArrowUpDown,
  BadgeCheck,
  Boxes,
  Filter,
  Search,
  ShieldCheck,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";

import { DirectServiceHero } from "@/components/direct-service-hero";
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
  return (
    <main id="main-content" className="service-storefront reference-items-page">
      <DirectServiceHero
        eyebrow="Items marketplace"
        title="OSRS"
        accent="Items"
        description="Find gear and supplies for your account. Choose your quantity and order directly."
        icon={Boxes}
      />
      <div className="reference-order-layout">
        <section className="store-panel">
          <ProductTypeNavigation filters={filters} />
          <form action="/products" className="reference-item-filters">
            <label className="store-search">
              <Search size={18} />
              <input
                name="q"
                aria-label="Search"
                defaultValue={filters.q ?? ""}
                placeholder="Search public product text"
              />
            </label>
            <label className="store-field">
              <span className="sr-only">Category</span>
              <select
                name="category"
                aria-label="Category"
                defaultValue={filters.category ?? ""}
              >
                <option value="">All categories</option>
                {data.facets.categories.map((c) => (
                  <option value={c.slug} key={c.stableKey}>
                    {c.publicName}
                  </option>
                ))}
              </select>
            </label>
            <label className="store-field">
              <span className="sr-only">Sort</span>
              <select
                name="sort"
                aria-label="Sort"
                defaultValue={filters.sort ?? "featured"}
              >
                {productSortOptions.map((sort) => (
                  <option key={sort} value={sort}>
                    {productSortLabels[sort]}
                  </option>
                ))}
              </select>
            </label>
            <input type="hidden" name="type" value={filters.type ?? ""} />
            <Button type="submit">Apply filters</Button>
          </form>
          <details className="store-details">
            <summary>More filters</summary>
            <ProductFilters
              filters={filters}
              facets={data.facets}
              total={data.total}
            />
          </details>
          {!data.featureEnabled ? (
            <ReviewMode requestHref={requestHref} />
          ) : (
            <>
              <table className="reference-item-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Category</th>
                    <th>Starting Price</th>
                    <th>Quantity</th>
                    <th>Total Price</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {data.products.map((product) => {
                    const cover =
                      product.revision.images.find(
                        (i) => i.imageType === "COVER",
                      ) ?? product.revision.images[0];
                    return (
                      <ProductEstimatePanel
                        key={product.stableKey}
                        productSlug={product.slug}
                        variants={product.revision.variants}
                        row={{
                          title: product.revision.product.publicTitle,
                          category:
                            product.revision.product.category.publicName,
                          imagePath: cover?.assetPath,
                          imageAlt: cover?.altText,
                          startingPrice: product.startingPrice,
                        }}
                      />
                    );
                  })}
                </tbody>
              </table>
              {!data.products.length && (
                <p className="store-empty">
                  No products found. Try another search.
                </p>
              )}
              <p className="text-text-muted mt-4 text-xs">
                {data.total} results · Page {data.page} of {data.pages}
              </p>
              <Pagination
                page={data.page}
                pages={data.pages}
                filters={filters}
              />
            </>
          )}
        </section>
        <aside className="reference-order-side">
          <section className="store-panel">
            <h2>Order Summary</h2>
            <p>
              Add items using the table. Your cart shows the confirmed
              selections and combined total.
            </p>
            <Link
              href="/cart"
              prefetch={false}
              className="reference-primary-button mt-5 w-full"
            >
              View Cart
            </Link>
          </section>
          <section className="store-panel">
            <h2>Trading Information</h2>
            <p>{data.marketplace.description}</p>
            <p>
              Availability and prices are checked when you add an item. A price
              preview does not reserve stock.
            </p>
            <p>
              Never share your password, PIN or authenticator code for an item
              trade.
            </p>
          </section>
          <section className="store-panel">
            <h2>Need a Custom Order?</h2>
            <p>Looking for a specific item or a bulk order?</p>
            <a
              href={requestHref}
              className="reference-secondary-button mt-4 w-full"
            >
              Contact Us
            </a>
          </section>
        </aside>
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
