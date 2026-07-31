import {
  Boxes,
  GalleryHorizontal,
  History,
  PackagePlus,
  Settings,
  Tags,
} from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
  fieldClass,
  labelClass,
  StatusBadge,
} from "@/components/catalogue-admin";
import { ConfirmSubmitButton } from "@/components/confirm-submit-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  productAvailabilityStates,
  productImageTypes,
  productInventoryEntryTypes,
  productPriceModeLabels,
  productPriceModes,
  productStockModeLabels,
  productStockModes,
  productTypeLabels,
  productTypes,
  productVariantStatuses,
} from "@/lib/products/constants";
import type {
  getProductAdminCategories,
  getProductAdminProduct,
  getProductAdminProducts,
  getProductMarketplaceAdmin,
} from "@/lib/products/admin";
import { formatEnumLabel } from "@/lib/catalogue/constants";
import { formatCents } from "@/lib/pricing/engine";

type ServerAction = (formData: FormData) => void | Promise<void>;
type Marketplace = NonNullable<
  Awaited<ReturnType<typeof getProductMarketplaceAdmin>>
>;
type Category = Awaited<ReturnType<typeof getProductAdminCategories>>[number];
type ProductRow = Awaited<ReturnType<typeof getProductAdminProducts>>[number];
type ProductDetail = NonNullable<
  Awaited<ReturnType<typeof getProductAdminProduct>>
>;

export function ProductAdminHero({
  title,
  description,
  icon = "settings",
}: {
  title: string;
  description: string;
  icon?: "settings" | "products" | "inventory" | "history";
}) {
  const Icon =
    icon === "products"
      ? PackagePlus
      : icon === "inventory"
        ? Boxes
        : icon === "history"
          ? History
          : Settings;
  return (
    <>
      <Badge variant="success">Task 012</Badge>
      <div className="mt-5 flex flex-wrap items-end justify-between gap-5">
        <div>
          <div className="flex items-center gap-3">
            <Icon className="text-primary size-7" aria-hidden="true" />
            <h1 className="display-type text-4xl sm:text-5xl">{title}</h1>
          </div>
          <p className="text-text-secondary mt-3 max-w-3xl leading-7">
            {description}
          </p>
        </div>
      </div>
      <ProductAdminTabs />
    </>
  );
}

export function ProductAdminTabs() {
  const tabs = [
    ["Overview", "/admin/products"],
    ["Categories", "/admin/products/categories"],
    ["New product", "/admin/products/new"],
    ["Preview", "/admin/products/preview"],
  ] as const;
  return (
    <nav
      aria-label="Product admin sections"
      className="mt-6 flex flex-wrap gap-2"
    >
      {tabs.map(([label, href]) => (
        <Button asChild key={href} size="sm" variant="secondary">
          <Link href={href}>{label}</Link>
        </Button>
      ))}
    </nav>
  );
}

export function ProductDetailTabs({ productId }: { productId: string }) {
  const tabs = [
    ["Editor", `/admin/products/${productId}`],
    ["Variants", `/admin/products/${productId}/variants`],
    ["Pricing", `/admin/products/${productId}/pricing`],
    ["Media", `/admin/products/${productId}/media`],
    ["Inventory", `/admin/products/${productId}/inventory`],
    ["Reservations", `/admin/products/${productId}/reservations`],
    ["History", `/admin/products/${productId}/history`],
  ] as const;
  return (
    <nav aria-label="Product sections" className="mt-6 flex flex-wrap gap-2">
      {tabs.map(([label, href]) => (
        <Button asChild key={href} size="sm" variant="secondary">
          <Link href={href}>{label}</Link>
        </Button>
      ))}
    </nav>
  );
}

export function ProductMarketplaceSummary({
  marketplace,
}: {
  marketplace: Marketplace | null;
}) {
  if (!marketplace) {
    return (
      <Panel title="Marketplace configuration missing">
        Run the Task 012 seed on a migrated database to create the product
        marketplace service.
      </Panel>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <SummaryStat label="Marketplace" value={marketplace.publicName} />
      <SummaryStat
        label="Availability"
        value={formatEnumLabel(marketplace.availabilityState)}
      />
      <SummaryStat label="Currency" value={marketplace.currencyCode} />
      <SummaryStat label="Service" value={marketplace.service.name} />
    </div>
  );
}

export function ProductTable({ products }: { products: ProductRow[] }) {
  if (!products.length) {
    return (
      <Panel title="No products yet">Create the first product draft.</Panel>
    );
  }
  return (
    <div className="border-border bg-surface-1 overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-5xl text-left text-sm">
        <thead className="bg-surface-2 text-text-muted">
          <tr>
            <th className="p-4">Product</th>
            <th className="p-4">Type</th>
            <th className="p-4">Publication</th>
            <th className="p-4">Availability</th>
            <th className="p-4">Variants</th>
            <th className="p-4">Updated</th>
            <th className="p-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {products.map((product) => (
            <tr key={product.id}>
              <td className="p-4">
                <p className="font-bold">{product.publicTitle}</p>
                <p className="text-text-muted mt-1">{product.slug}</p>
                {product.needsClientReview && (
                  <Badge className="mt-2" variant="warning">
                    Needs client review
                  </Badge>
                )}
              </td>
              <td className="p-4">
                {productTypeLabels[product.productType]}
                <p className="text-text-muted mt-1">
                  {product.category.publicName}
                </p>
              </td>
              <td className="p-4">
                <StatusBadge status={product.publicationStatus} />
              </td>
              <td className="p-4">
                <StatusBadge status={product.availabilityState} />
              </td>
              <td className="p-4">{product.variants.length}</td>
              <td className="text-text-secondary p-4">
                {product.updatedAt.toLocaleString()}
              </td>
              <td className="p-4">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/admin/products/${product.id}`}>Open</Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function CategoryManager({
  marketplace,
  categories,
  action,
}: {
  marketplace: Marketplace;
  categories: Category[];
  action: ServerAction;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="space-y-4">
        {categories.map((category) => (
          <details
            className="border-border bg-surface-1 rounded-2xl border p-5"
            key={category.id}
          >
            <summary className="cursor-pointer font-bold">
              {category.publicName}{" "}
              <StatusBadge status={category.productType} />
            </summary>
            <CategoryForm
              marketplace={marketplace}
              category={category}
              action={action}
            />
          </details>
        ))}
      </section>
      <aside className="border-border bg-surface-1 h-fit rounded-2xl border p-5">
        <h2 className="font-bold">Add category</h2>
        <div className="mt-5">
          <CategoryForm marketplace={marketplace} action={action} />
        </div>
      </aside>
    </div>
  );
}

function CategoryForm({
  marketplace,
  category,
  action,
}: {
  marketplace: Marketplace;
  category?: Category;
  action: ServerAction;
}) {
  return (
    <form action={action} className="mt-5 grid gap-4">
      <input type="hidden" name="marketplaceId" value={marketplace.id} />
      {category && (
        <>
          <input type="hidden" name="categoryId" value={category.id} />
          <input type="hidden" name="stableKey" value={category.stableKey} />
          <input
            type="hidden"
            name="expectedVersion"
            value={category.concurrencyVersion}
          />
        </>
      )}
      <TextField
        name="publicName"
        label="Public name"
        defaultValue={category?.publicName ?? ""}
      />
      <TextField name="slug" label="Slug" defaultValue={category?.slug ?? ""} />
      <SelectField
        name="productType"
        label="Product type"
        values={productTypes}
        defaultValue={category?.productType ?? "ITEM"}
      />
      <label className={labelClass}>
        Public description
        <textarea
          className={`${fieldClass} min-h-24`}
          name="publicDescription"
          defaultValue={category?.publicDescription ?? ""}
        />
      </label>
      <NumberField
        name="sortOrder"
        label="Sort order"
        defaultValue={category?.sortOrder ?? 10}
      />
      <BooleanToggles
        values={[
          ["enabled", "Enabled", category?.enabled ?? true],
          [
            "needsClientReview",
            "Needs client review",
            category?.needsClientReview ?? true,
          ],
        ]}
      />
      <Button className="w-fit" type="submit">
        Save category
      </Button>
    </form>
  );
}

export function ProductForm({
  marketplace,
  categories,
  product,
  action,
  publishAction,
}: {
  marketplace: Marketplace;
  categories: Category[];
  product?: ProductDetail;
  action: ServerAction;
  publishAction?: ServerAction;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <form action={action} className="grid gap-6">
        <input type="hidden" name="marketplaceId" value={marketplace.id} />
        <input type="hidden" name="currencyCode" value="USD" />
        {product && (
          <>
            <input type="hidden" name="productId" value={product.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={product.concurrencyVersion}
            />
          </>
        )}
        <fieldset className="grid gap-5 border-0 p-0 lg:grid-cols-2">
          <legend className="display-type mb-4 text-2xl">Public content</legend>
          <TextField
            name="publicTitle"
            label="Public title"
            defaultValue={product?.publicTitle ?? ""}
          />
          <TextField
            name="slug"
            label="Slug"
            defaultValue={product?.slug ?? ""}
          />
          <label className={labelClass}>
            Category
            <select
              className={fieldClass}
              name="categoryId"
              defaultValue={product?.categoryId ?? categories[0]?.id}
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.publicName}
                </option>
              ))}
            </select>
          </label>
          <SelectField
            name="productType"
            label="Product type"
            values={productTypes}
            defaultValue={product?.productType ?? "ITEM"}
          />
          <label className={`${labelClass} lg:col-span-2`}>
            Short description
            <textarea
              className={`${fieldClass} min-h-24`}
              name="shortDescription"
              required
              defaultValue={product?.shortDescription ?? ""}
            />
          </label>
          <label className={`${labelClass} lg:col-span-2`}>
            Full public description
            <textarea
              className={`${fieldClass} min-h-44`}
              name="fullDescription"
              required
              defaultValue={product?.fullDescription ?? ""}
            />
          </label>
        </fieldset>
        <fieldset className="grid gap-5 border-0 p-0 lg:grid-cols-3">
          <legend className="display-type mb-4 text-2xl">Operations</legend>
          <TextField
            name="internalReferenceCode"
            label="Internal reference"
            defaultValue={product?.internalReferenceCode ?? "PROD-REVIEW"}
          />
          <SelectField
            name="availabilityState"
            label="Availability"
            values={productAvailabilityStates}
            defaultValue={product?.availabilityState ?? "PAUSED"}
          />
          <NumberField
            name="sortOrder"
            label="Sort order"
            defaultValue={product?.sortOrder ?? 10}
          />
          <TextField
            name="publicBadgeText"
            label="Public badge"
            defaultValue={product?.publicBadgeText ?? ""}
            required={false}
          />
          <BooleanToggles
            values={[
              ["isFeatured", "Featured", product?.isFeatured ?? false],
              [
                "needsClientReview",
                "Needs client review",
                product?.needsClientReview ?? true,
              ],
            ]}
          />
        </fieldset>
        <Button className="w-fit" type="submit">
          {product ? "Save product" : "Create product"}
        </Button>
      </form>
      {product && publishAction && (
        <aside className="space-y-5">
          <Panel title="Publication">
            <div className="flex flex-wrap gap-2">
              <StatusBadge status={product.publicationStatus} />
              <StatusBadge status={product.availabilityState} />
            </div>
            <form action={publishAction} className="mt-5">
              <input type="hidden" name="productId" value={product.id} />
              <input
                type="hidden"
                name="expectedVersion"
                value={product.concurrencyVersion}
              />
              <ConfirmSubmitButton confirmation="Publish an immutable product revision?">
                Publish
              </ConfirmSubmitButton>
            </form>
          </Panel>
        </aside>
      )}
    </div>
  );
}

export function ProductVariantsEditor({
  product,
  action,
}: {
  product: ProductDetail;
  action: ServerAction;
}) {
  return (
    <Collection title="Variants">
      {product.variants.map((variant) => (
        <details
          className="border-border bg-surface-1 rounded-2xl border p-5"
          key={variant.id}
        >
          <summary className="cursor-pointer font-bold">
            {variant.publicName} <StatusBadge status={variant.stockMode} />
          </summary>
          <VariantForm
            productId={product.id}
            variant={variant}
            action={action}
          />
        </details>
      ))}
      <Panel title="Add variant">
        <VariantForm productId={product.id} action={action} />
      </Panel>
    </Collection>
  );
}

function VariantForm({
  productId,
  variant,
  action,
}: {
  productId: string;
  variant?: ProductDetail["variants"][number];
  action: ServerAction;
}) {
  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <input type="hidden" name="productId" value={productId} />
      {variant && (
        <>
          <input type="hidden" name="variantId" value={variant.id} />
          <input type="hidden" name="stableKey" value={variant.stableKey} />
          <input
            type="hidden"
            name="expectedVersion"
            value={variant.concurrencyVersion}
          />
        </>
      )}
      <TextField
        name="publicName"
        label="Public name"
        defaultValue={variant?.publicName ?? ""}
      />
      <TextField
        name="publicSku"
        label="Public SKU"
        defaultValue={variant?.publicSku ?? ""}
        required={false}
      />
      <TextField
        name="internalSku"
        label="Internal SKU"
        defaultValue={variant?.internalSku ?? "PROD-INTERNAL-REVIEW"}
      />
      <TextField
        name="unitLabel"
        label="Unit label"
        defaultValue={variant?.unitLabel ?? "unit"}
      />
      <SelectField
        name="priceMode"
        label="Price mode"
        values={productPriceModes}
        defaultValue={variant?.priceMode ?? "FIXED_UNIT"}
        labels={productPriceModeLabels}
      />
      <NumberField
        name="baseUnitPriceCents"
        label="Base unit cents"
        defaultValue={variant?.baseUnitPriceCents ?? 0}
      />
      <TextField
        name="minimumQuantity"
        label="Minimum quantity"
        defaultValue={variant?.minimumQuantity.toString() ?? "1"}
      />
      <TextField
        name="maximumQuantity"
        label="Maximum quantity"
        defaultValue={variant?.maximumQuantity.toString() ?? "1"}
      />
      <TextField
        name="quantityIncrement"
        label="Quantity increment"
        defaultValue={variant?.quantityIncrement.toString() ?? "1"}
      />
      <SelectField
        name="stockMode"
        label="Stock mode"
        values={productStockModes}
        defaultValue={variant?.stockMode ?? "TRACKED"}
        labels={productStockModeLabels}
      />
      <SelectField
        name="availabilityState"
        label="Availability"
        values={productAvailabilityStates}
        defaultValue={variant?.availabilityState ?? "PAUSED"}
      />
      <SelectField
        name="status"
        label="Status"
        values={productVariantStatuses}
        defaultValue={variant?.status ?? "AVAILABLE"}
      />
      <TextField
        name="lowStockThreshold"
        label="Low-stock threshold"
        defaultValue={variant?.lowStockThreshold.toString() ?? "0"}
      />
      <NumberField
        name="sortOrder"
        label="Sort order"
        defaultValue={variant?.sortOrder ?? 10}
      />
      <BooleanToggles
        values={[
          ["enabled", "Enabled", variant?.enabled ?? true],
          [
            "needsClientReview",
            "Needs client review",
            variant?.needsClientReview ?? true,
          ],
        ]}
      />
      <Button className="w-fit" type="submit">
        Save variant
      </Button>
    </form>
  );
}

export function ProductPricingEditor({
  product,
  action,
}: {
  product: ProductDetail;
  action: ServerAction;
}) {
  return (
    <Collection title="Quantity tiers">
      {product.variants.map((variant) => (
        <section
          className="border-border bg-surface-1 rounded-2xl border p-5"
          key={variant.id}
        >
          <h2 className="font-bold">{variant.publicName}</h2>
          <div className="mt-4 grid gap-4">
            {variant.priceTiers.map((tier) => (
              <details
                className="border-border bg-background/40 rounded-xl border p-4"
                key={tier.id}
              >
                <summary className="cursor-pointer font-semibold">
                  {tier.minimumQuantity.toString()} to{" "}
                  {tier.maximumQuantity?.toString() ?? "open"} at{" "}
                  {formatCents(tier.unitPriceCents)}
                </summary>
                <TierForm
                  productId={product.id}
                  variantId={variant.id}
                  tier={tier}
                  action={action}
                />
              </details>
            ))}
            <Panel title="Add tier">
              <TierForm
                productId={product.id}
                variantId={variant.id}
                action={action}
              />
            </Panel>
          </div>
        </section>
      ))}
    </Collection>
  );
}

function TierForm({
  productId,
  variantId,
  tier,
  action,
}: {
  productId: string;
  variantId: string;
  tier?: ProductDetail["variants"][number]["priceTiers"][number];
  action: ServerAction;
}) {
  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="variantId" value={variantId} />
      {tier && (
        <>
          <input type="hidden" name="tierId" value={tier.id} />
          <input type="hidden" name="stableKey" value={tier.stableKey} />
          <input
            type="hidden"
            name="expectedVersion"
            value={tier.concurrencyVersion}
          />
        </>
      )}
      <TextField
        name="minimumQuantity"
        label="Minimum quantity"
        defaultValue={tier?.minimumQuantity.toString() ?? "1"}
      />
      <TextField
        name="maximumQuantity"
        label="Maximum quantity"
        defaultValue={tier?.maximumQuantity?.toString() ?? ""}
        required={false}
      />
      <NumberField
        name="unitPriceCents"
        label="Unit price cents"
        defaultValue={tier?.unitPriceCents ?? 0}
      />
      <NumberField
        name="sortOrder"
        label="Sort order"
        defaultValue={tier?.sortOrder ?? 10}
      />
      <BooleanToggles
        values={[
          ["enabled", "Enabled", tier?.enabled ?? true],
          [
            "needsClientReview",
            "Needs client review",
            tier?.needsClientReview ?? true,
          ],
        ]}
      />
      <Button className="w-fit" type="submit">
        Save tier
      </Button>
    </form>
  );
}

export function ProductMediaEditor({
  product,
  action,
}: {
  product: ProductDetail;
  action: ServerAction;
}) {
  return (
    <Collection title="Media">
      {product.images.map((image) => (
        <details
          className="border-border bg-surface-1 rounded-2xl border p-5"
          key={image.id}
        >
          <summary className="cursor-pointer font-bold">
            {image.altText} <StatusBadge status={image.imageType} />
          </summary>
          <ImageForm productId={product.id} image={image} action={action} />
        </details>
      ))}
      <Panel title="Add image">
        <ImageForm productId={product.id} action={action} />
      </Panel>
    </Collection>
  );
}

function ImageForm({
  productId,
  image,
  action,
}: {
  productId: string;
  image?: ProductDetail["images"][number];
  action: ServerAction;
}) {
  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <input type="hidden" name="productId" value={productId} />
      {image && (
        <>
          <input type="hidden" name="imageId" value={image.id} />
          <input type="hidden" name="stableKey" value={image.stableKey} />
          <input
            type="hidden"
            name="expectedVersion"
            value={image.concurrencyVersion}
          />
        </>
      )}
      <SelectField
        name="imageType"
        label="Image type"
        values={productImageTypes}
        defaultValue={image?.imageType ?? "GALLERY"}
      />
      <TextField
        name="assetPath"
        label="Asset path"
        defaultValue={image?.assetPath ?? "/artwork/portal-hero-desktop.webp"}
      />
      <TextField
        name="altText"
        label="Alt text"
        defaultValue={image?.altText ?? ""}
      />
      <TextField
        name="caption"
        label="Caption"
        defaultValue={image?.caption ?? ""}
        required={false}
      />
      <NumberField
        name="sortOrder"
        label="Sort order"
        defaultValue={image?.sortOrder ?? 10}
      />
      <BooleanToggles
        values={[
          ["isPublic", "Public", image?.isPublic ?? true],
          [
            "needsClientReview",
            "Needs client review",
            image?.needsClientReview ?? true,
          ],
        ]}
      />
      <Button className="w-fit" type="submit">
        Save image
      </Button>
    </form>
  );
}

export function ProductInventoryPanel({
  product,
  action,
}: {
  product: ProductDetail;
  action: ServerAction;
}) {
  return (
    <div className="grid gap-6">
      {product.variants.map((variant) => (
        <section
          className="border-border bg-surface-1 rounded-2xl border p-5"
          key={variant.id}
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-bold">{variant.publicName}</h2>
              <p className="text-text-muted mt-1 text-sm">
                {productStockModeLabels[variant.stockMode]} / on hand{" "}
                {variant.onHandQuantity.toString()} / low at{" "}
                {variant.lowStockThreshold.toString()}
              </p>
            </div>
            <StatusBadge status={variant.availabilityState} />
          </div>
          <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="variantId" value={variant.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={variant.concurrencyVersion}
            />
            <SelectField
              name="entryType"
              label="Entry type"
              values={productInventoryEntryTypes}
              defaultValue="STOCK_IN"
            />
            <TextField name="quantity" label="Quantity" defaultValue="1" />
            <TextField name="reason" label="Safe reason" defaultValue="" />
            <TextField
              name="referenceKey"
              label="Idempotency reference"
              defaultValue=""
              required={false}
            />
            <label className={`${labelClass} md:col-span-2`}>
              Internal note
              <textarea
                className={`${fieldClass} min-h-20`}
                name="internalNote"
              />
            </label>
            <ConfirmSubmitButton
              className="w-fit"
              confirmation="Append this inventory adjustment?"
            >
              Adjust stock
            </ConfirmSubmitButton>
          </form>
          <LedgerTable entries={variant.ledgerEntries} />
        </section>
      ))}
    </div>
  );
}

function LedgerTable({
  entries,
}: {
  entries: ProductDetail["variants"][number]["ledgerEntries"];
}) {
  return (
    <div className="border-border mt-5 overflow-x-auto rounded-xl border">
      <table className="w-full min-w-3xl text-left text-sm">
        <thead className="bg-surface-2 text-text-muted">
          <tr>
            <th className="p-3">Type</th>
            <th className="p-3">Quantity</th>
            <th className="p-3">Balance</th>
            <th className="p-3">Reason</th>
            <th className="p-3">Created</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td className="p-3">{formatEnumLabel(entry.entryType)}</td>
              <td className="p-3">{entry.quantity.toString()}</td>
              <td className="p-3">
                {entry.resultingOnHandQuantity.toString()}
              </td>
              <td className="p-3">{entry.reason}</td>
              <td className="text-text-muted p-3">
                {entry.createdAt.toLocaleString()}
              </td>
            </tr>
          ))}
          {!entries.length && (
            <tr>
              <td className="text-text-muted p-3" colSpan={5}>
                No ledger entries yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ProductReservationsPanel({
  product,
  createAction,
  releaseAction,
  expireAction,
}: {
  product: ProductDetail;
  createAction: ServerAction;
  releaseAction: ServerAction;
  expireAction: ServerAction;
}) {
  return (
    <div className="grid gap-6">
      <Panel title="Expire stale reservations">
        <form action={expireAction}>
          <input type="hidden" name="productId" value={product.id} />
          <Button type="submit" variant="secondary">
            Expire stale reservations
          </Button>
        </form>
      </Panel>
      {product.variants.map((variant) => (
        <section
          className="border-border bg-surface-1 rounded-2xl border p-5"
          key={variant.id}
        >
          <h2 className="font-bold">{variant.publicName}</h2>
          <form
            action={createAction}
            className="mt-5 grid gap-4 md:grid-cols-2"
          >
            <input type="hidden" name="productId" value={product.id} />
            <input type="hidden" name="variantId" value={variant.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={variant.concurrencyVersion}
            />
            <TextField name="quantity" label="Quantity" defaultValue="1" />
            <label className={labelClass}>
              Expires at
              <input
                className={fieldClass}
                name="expiresAt"
                type="datetime-local"
                defaultValue="2030-01-01T00:00"
              />
            </label>
            <TextField
              name="safeInternalPurpose"
              label="Safe purpose"
              defaultValue=""
            />
            <TextField
              name="idempotencyKey"
              label="Idempotency key"
              defaultValue=""
              required={false}
            />
            <TextField
              name="futureExternalRef"
              label="Future external ref"
              defaultValue=""
              required={false}
            />
            <ConfirmSubmitButton
              className="w-fit"
              confirmation="Create an internal stock reservation?"
            >
              Create reservation
            </ConfirmSubmitButton>
          </form>
          <ReservationTable
            productId={product.id}
            reservations={variant.reservations}
            releaseAction={releaseAction}
          />
        </section>
      ))}
    </div>
  );
}

function ReservationTable({
  productId,
  reservations,
  releaseAction,
}: {
  productId: string;
  reservations: ProductDetail["variants"][number]["reservations"];
  releaseAction: ServerAction;
}) {
  return (
    <div className="border-border mt-5 overflow-x-auto rounded-xl border">
      <table className="w-full min-w-4xl text-left text-sm">
        <thead className="bg-surface-2 text-text-muted">
          <tr>
            <th className="p-3">Status</th>
            <th className="p-3">Quantity</th>
            <th className="p-3">Expires</th>
            <th className="p-3">Events</th>
            <th className="p-3">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {reservations.map((reservation) => (
            <tr key={reservation.id}>
              <td className="p-3">
                <StatusBadge status={reservation.status} />
              </td>
              <td className="p-3">{reservation.quantity.toString()}</td>
              <td className="text-text-muted p-3">
                {reservation.expiresAt.toLocaleString()}
              </td>
              <td className="p-3">{reservation.events.length}</td>
              <td className="p-3">
                {reservation.status === "ACTIVE" && (
                  <form action={releaseAction}>
                    <input type="hidden" name="productId" value={productId} />
                    <input
                      type="hidden"
                      name="reservationId"
                      value={reservation.id}
                    />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={reservation.concurrencyVersion}
                    />
                    <ConfirmSubmitButton
                      size="sm"
                      variant="secondary"
                      confirmation="Release this reservation?"
                    >
                      Release
                    </ConfirmSubmitButton>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {!reservations.length && (
            <tr>
              <td className="text-text-muted p-3" colSpan={5}>
                No reservations yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export function ProductRevisionHistory({
  product,
  discardAction,
  restoreAction,
}: {
  product: ProductDetail;
  discardAction: ServerAction;
  restoreAction: ServerAction;
}) {
  return (
    <div className="space-y-6">
      <Panel title="Draft controls">
        <form action={discardAction} className="mt-4">
          <input type="hidden" name="productId" value={product.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={product.concurrencyVersion}
          />
          <ConfirmSubmitButton
            variant="secondary"
            confirmation="Discard draft changes and restore the latest published revision?"
          >
            Discard draft
          </ConfirmSubmitButton>
        </form>
      </Panel>
      <div className="border-border bg-surface-1 overflow-x-auto rounded-2xl border">
        <table className="w-full min-w-3xl text-left text-sm">
          <thead className="bg-surface-2 text-text-muted">
            <tr>
              <th className="p-4">Revision</th>
              <th className="p-4">Published</th>
              <th className="p-4">Publisher</th>
              <th className="p-4">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-border divide-y">
            {product.revisions.map((revision) => (
              <tr key={revision.id}>
                <td className="p-4 font-bold">#{revision.revisionNumber}</td>
                <td className="text-text-secondary p-4">
                  {revision.publishedAt.toLocaleString()}
                </td>
                <td className="text-text-secondary p-4">
                  {revision.publishedBy?.name ??
                    revision.publishedBy?.email ??
                    "system"}
                </td>
                <td className="p-4">
                  <form action={restoreAction}>
                    <input type="hidden" name="productId" value={product.id} />
                    <input
                      type="hidden"
                      name="revisionId"
                      value={revision.id}
                    />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={product.concurrencyVersion}
                    />
                    <ConfirmSubmitButton
                      size="sm"
                      variant="secondary"
                      confirmation={`Restore revision #${revision.revisionNumber}?`}
                    >
                      Restore
                    </ConfirmSubmitButton>
                  </form>
                </td>
              </tr>
            ))}
            {!product.revisions.length && (
              <tr>
                <td className="text-text-muted p-4" colSpan={4}>
                  No published revisions yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ProductDraftPreview({ product }: { product: ProductDetail }) {
  const panels = [
    [PackagePlus, "Variants", String(product.variants.length)],
    [Tags, "Tags", String(product.tags.length)],
    [GalleryHorizontal, "Images", String(product.images.length)],
    [History, "Revisions", String(product.revisions.length)],
  ] as const;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="border-border bg-surface-1 rounded-2xl border p-6">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={product.publicationStatus} />
          <StatusBadge status={product.availabilityState} />
          <Badge variant="info">{productTypeLabels[product.productType]}</Badge>
        </div>
        <h2 className="display-type mt-5 text-4xl">{product.publicTitle}</h2>
        <p className="text-text-secondary mt-3 text-lg leading-8">
          {product.shortDescription}
        </p>
        <div className="text-text-secondary mt-6 space-y-4 leading-7">
          {product.fullDescription.split(/\n{2,}/).map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </section>
      <aside className="grid gap-4">
        {panels.map(([Icon, label, value]) => (
          <div
            className="border-border bg-surface-1 rounded-2xl border p-5"
            key={label}
          >
            <Icon className="text-primary size-5" aria-hidden="true" />
            <p className="text-text-muted mt-3 text-sm font-semibold">
              {label}
            </p>
            <p className="display-type mt-2 text-2xl">{value}</p>
          </div>
        ))}
      </aside>
    </div>
  );
}

function Collection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-4">
      <h2 className="display-type text-3xl">{title}</h2>
      {children}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-border bg-surface-1 rounded-2xl border p-5">
      <h2 className="font-bold">{title}</h2>
      <div className="text-text-secondary mt-3 text-sm leading-6">
        {children}
      </div>
    </section>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-border bg-surface-1 rounded-2xl border p-5">
      <p className="text-text-muted text-sm font-semibold">{label}</p>
      <p className="display-type mt-2 text-2xl">{value}</p>
    </div>
  );
}

function TextField({
  name,
  label,
  defaultValue,
  required = true,
}: {
  name: string;
  label: string;
  defaultValue: string;
  required?: boolean;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        className={fieldClass}
        name={name}
        required={required}
        defaultValue={defaultValue}
      />
    </label>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
}: {
  name: string;
  label: string;
  defaultValue: number | string;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        className={fieldClass}
        name={name}
        type="number"
        min="0"
        defaultValue={defaultValue}
      />
    </label>
  );
}

function SelectField<T extends string>({
  name,
  label,
  values,
  defaultValue,
  labels,
}: {
  name: string;
  label: string;
  values: readonly T[];
  defaultValue: T;
  labels?: Partial<Record<T, string>>;
}) {
  return (
    <label className={labelClass}>
      {label}
      <select className={fieldClass} name={name} defaultValue={defaultValue}>
        {values.map((value) => (
          <option key={value} value={value}>
            {labels?.[value] ?? formatEnumLabel(value)}
          </option>
        ))}
      </select>
    </label>
  );
}

function BooleanToggles({
  values,
}: {
  values: Array<readonly [string, string, boolean]>;
}) {
  return (
    <div className="flex flex-wrap gap-4 md:col-span-2">
      {values.map(([name, label, enabled]) => (
        <label
          className="text-text-secondary flex items-center gap-2 text-sm font-semibold"
          key={name}
        >
          <input type="checkbox" name={name} defaultChecked={enabled} />
          {label}
        </label>
      ))}
    </div>
  );
}
