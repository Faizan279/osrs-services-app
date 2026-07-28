import {
  Clock3,
  GalleryHorizontal,
  History,
  ListChecks,
  ShieldCheck,
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
  accountApprovalLabels,
  accountAvailabilityLabels,
  accountHandoverReadinessStates,
  accountImageTypes,
  accountListingAvailabilities,
  accountStatTypes,
  accountUnlockTypes,
  accountPublicationLabels,
} from "@/lib/accounts/constants";
import type {
  getAccountAdminListings,
  getAccountListingAdmin,
  getAccountMarketplaceAdmin,
} from "@/lib/accounts/admin";
import { catalogueGameModes, formatEnumLabel } from "@/lib/catalogue/constants";
import { formatCents } from "@/lib/pricing/engine";

type Listing = NonNullable<Awaited<ReturnType<typeof getAccountListingAdmin>>>;
type ListingRow = Awaited<ReturnType<typeof getAccountAdminListings>>[number];
type Marketplace = NonNullable<
  Awaited<ReturnType<typeof getAccountMarketplaceAdmin>>
>;

type ServerAction = (formData: FormData) => void | Promise<void>;

export function AccountMarketplaceSummary({
  marketplace,
}: {
  marketplace: Marketplace | null;
}) {
  if (!marketplace) {
    return (
      <div className="border-border bg-surface-1 rounded-2xl border p-6">
        <h2 className="font-bold">Marketplace configuration missing</h2>
        <p className="text-text-secondary mt-2 text-sm leading-6">
          Run the Task 010 seed on a migrated database to create the account
          marketplace service and editable configuration.
        </p>
      </div>
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

export function AccountListingTable({ listings }: { listings: ListingRow[] }) {
  if (!listings.length) {
    return (
      <div className="border-border bg-surface-1 rounded-2xl border p-6">
        <h2 className="font-bold">No listings yet</h2>
        <p className="text-text-secondary mt-2 text-sm">
          Create the first draft listing from the Accounts Centre.
        </p>
      </div>
    );
  }
  return (
    <div className="border-border bg-surface-1 overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-5xl text-left text-sm">
        <thead className="bg-surface-2 text-text-muted">
          <tr>
            <th className="p-4">Listing</th>
            <th className="p-4">Price</th>
            <th className="p-4">Approval</th>
            <th className="p-4">Publication</th>
            <th className="p-4">Availability</th>
            <th className="p-4">Updated</th>
            <th className="p-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {listings.map((listing) => (
            <tr key={listing.id}>
              <td className="p-4">
                <p className="font-bold">{listing.publicTitle}</p>
                <p className="text-text-muted mt-1">{listing.slug}</p>
                {listing.needsClientReview && (
                  <Badge className="mt-2" variant="warning">
                    Needs client review
                  </Badge>
                )}
              </td>
              <td className="p-4 font-bold">
                {formatCents(listing.basePriceCents, listing.currencyCode)}
              </td>
              <td className="p-4">
                <StatusBadge status={listing.approvalStatus} />
              </td>
              <td className="p-4">
                <StatusBadge status={listing.publicationStatus} />
              </td>
              <td className="p-4">
                <StatusBadge status={listing.availability} />
                {listing.holds[0] && (
                  <p className="text-text-muted mt-2 text-xs">
                    Hold expires {listing.holds[0].expiresAt.toLocaleString()}
                  </p>
                )}
              </td>
              <td className="text-text-secondary p-4">
                {listing.updatedAt.toLocaleString()}
              </td>
              <td className="p-4">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/admin/accounts/listings/${listing.id}`}>
                    Open
                  </Link>
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AccountListingTabs({ listingId }: { listingId: string }) {
  const tabs = [
    ["Overview", `/admin/accounts/listings/${listingId}`],
    ["Stats", `/admin/accounts/listings/${listingId}/stats`],
    ["Unlocks", `/admin/accounts/listings/${listingId}/unlocks`],
    ["Features", `/admin/accounts/listings/${listingId}/features`],
    ["Media", `/admin/accounts/listings/${listingId}/media`],
    ["Availability", `/admin/accounts/listings/${listingId}/availability`],
    ["Handover", `/admin/accounts/listings/${listingId}/handover`],
    ["History", `/admin/accounts/listings/${listingId}/history`],
    ["Preview", `/admin/accounts/listings/${listingId}/preview`],
  ] as const;
  return (
    <nav
      aria-label="Account listing sections"
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

export function AccountListingForm({
  marketplace,
  listing,
  action,
}: {
  marketplace: Marketplace;
  listing?: Listing;
  action: ServerAction;
}) {
  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="marketplaceId" value={marketplace.id} />
      <input type="hidden" name="currencyCode" value="USD" />
      {listing && (
        <>
          <input type="hidden" name="listingId" value={listing.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={listing.concurrencyVersion}
          />
        </>
      )}
      <fieldset className="grid gap-5 border-0 p-0 lg:grid-cols-2">
        <legend className="display-type mb-4 text-2xl">Public content</legend>
        <TextField
          name="publicTitle"
          label="Public title"
          defaultValue={listing?.publicTitle ?? ""}
        />
        <TextField
          name="slug"
          label="Public slug"
          defaultValue={listing?.slug ?? ""}
        />
        <label className={`${labelClass} lg:col-span-2`}>
          Short description
          <textarea
            className={`${fieldClass} min-h-24`}
            name="shortDescription"
            required
            defaultValue={listing?.shortDescription ?? ""}
          />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Full public description
          <textarea
            className={`${fieldClass} min-h-44`}
            name="fullDescription"
            required
            defaultValue={listing?.fullDescription ?? ""}
          />
        </label>
      </fieldset>
      <fieldset className="grid gap-5 border-0 p-0 lg:grid-cols-3">
        <legend className="display-type mb-4 text-2xl">Pricing and mode</legend>
        <NumberField
          name="basePriceCents"
          label="Base price in cents"
          defaultValue={listing?.basePriceCents ?? 0}
          min={1}
        />
        <label className={labelClass}>
          Game mode
          <select
            className={fieldClass}
            name="gameMode"
            defaultValue={listing?.gameMode ?? "NORMAL"}
          >
            {catalogueGameModes.map((mode) => (
              <option key={mode} value={mode}>
                {formatEnumLabel(mode)}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Availability
          <select
            className={fieldClass}
            name="availability"
            defaultValue={listing?.availability ?? "PAUSED"}
          >
            {accountListingAvailabilities.map((state) => (
              <option key={state} value={state}>
                {accountAvailabilityLabels[state]}
              </option>
            ))}
          </select>
        </label>
        <NumberField
          name="combatLevel"
          label="Combat level"
          defaultValue={listing?.combatLevel ?? ""}
        />
        <NumberField
          name="totalLevel"
          label="Total level"
          defaultValue={listing?.totalLevel ?? ""}
        />
        <NumberField
          name="questPoints"
          label="Quest points"
          defaultValue={listing?.questPoints ?? ""}
        />
        <TextField
          name="accountAgeLabel"
          label="Account age label"
          defaultValue={listing?.accountAgeLabel ?? ""}
          required={false}
        />
        <TextField
          name="membershipStateLabel"
          label="Membership state"
          defaultValue={listing?.membershipStateLabel ?? ""}
          required={false}
        />
        <TextField
          name="publicBadgeText"
          label="Public badge"
          defaultValue={listing?.publicBadgeText ?? ""}
          required={false}
        />
      </fieldset>
      <fieldset className="grid gap-5 border-0 p-0 lg:grid-cols-2">
        <legend className="display-type mb-4 text-2xl">
          Internal reference
        </legend>
        <TextField
          name="internalReferenceCode"
          label="Internal reference code"
          defaultValue={listing?.internalReferenceCode ?? "acct-safe-reference"}
        />
        <NumberField
          name="sortOrder"
          label="Sort order"
          defaultValue={listing?.sortOrder ?? 10}
        />
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="isFeatured"
            defaultChecked={listing?.isFeatured ?? false}
          />
          Featured publicly
        </label>
        <label className="text-text-secondary flex items-center gap-3 text-sm font-semibold">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={listing?.needsClientReview ?? true}
          />
          Needs client review
        </label>
      </fieldset>
      <Button className="w-fit" type="submit">
        {listing ? "Save listing" : "Create listing"}
      </Button>
    </form>
  );
}

export function AccountReviewControls({
  listing,
  approveAction,
  rejectAction,
  publishAction,
}: {
  listing: Listing;
  approveAction: ServerAction;
  rejectAction: ServerAction;
  publishAction: ServerAction;
}) {
  return (
    <div className="border-border bg-surface-1 rounded-2xl border p-5">
      <div className="flex flex-wrap gap-2">
        <Badge variant="info">
          {accountApprovalLabels[listing.approvalStatus]}
        </Badge>
        <Badge variant="info">
          {accountPublicationLabels[listing.publicationStatus]}
        </Badge>
      </div>
      <div className="mt-5 flex flex-wrap gap-3">
        <form action={approveAction}>
          <input type="hidden" name="listingId" value={listing.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={listing.concurrencyVersion}
          />
          <ConfirmSubmitButton confirmation="Approve this account listing?">
            Approve
          </ConfirmSubmitButton>
        </form>
        <form action={publishAction}>
          <input type="hidden" name="listingId" value={listing.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={listing.concurrencyVersion}
          />
          <ConfirmSubmitButton
            variant="secondary"
            confirmation="Publish an immutable public account listing revision?"
          >
            Publish
          </ConfirmSubmitButton>
        </form>
      </div>
      <form action={rejectAction} className="mt-5 grid gap-3">
        <input type="hidden" name="listingId" value={listing.id} />
        <input
          type="hidden"
          name="expectedVersion"
          value={listing.concurrencyVersion}
        />
        <label className={labelClass}>
          Private rejection reason
          <textarea className={`${fieldClass} min-h-20`} name="reason" />
        </label>
        <ConfirmSubmitButton
          className="w-fit"
          variant="danger"
          confirmation="Reject this listing with a private reason?"
        >
          Reject
        </ConfirmSubmitButton>
      </form>
    </div>
  );
}

export function AccountStatsEditor({
  listing,
  action,
}: {
  listing: Listing;
  action: ServerAction;
}) {
  return (
    <CollectionEditor
      title="Stats"
      empty="No public stats configured."
      items={listing.stats.map((stat) => ({
        id: stat.id,
        title: stat.publicLabel,
        detail: `${formatEnumLabel(stat.statType)} / ${stat.value}`,
        version: stat.concurrencyVersion,
        form: <StatForm listingId={listing.id} stat={stat} action={action} />,
      }))}
      create={<StatForm listingId={listing.id} action={action} />}
    />
  );
}

export function AccountUnlocksEditor({
  listing,
  action,
}: {
  listing: Listing;
  action: ServerAction;
}) {
  return (
    <CollectionEditor
      title="Unlocks"
      empty="No public unlocks configured."
      items={listing.unlocks.map((unlock) => ({
        id: unlock.id,
        title: unlock.publicLabel,
        detail: formatEnumLabel(unlock.unlockType),
        version: unlock.concurrencyVersion,
        form: (
          <UnlockForm listingId={listing.id} unlock={unlock} action={action} />
        ),
      }))}
      create={<UnlockForm listingId={listing.id} action={action} />}
    />
  );
}

export function AccountFeaturesEditor({
  listing,
  action,
}: {
  listing: Listing;
  action: ServerAction;
}) {
  return (
    <CollectionEditor
      title="Features"
      empty="No public features configured."
      items={listing.features.map((feature) => ({
        id: feature.id,
        title: feature.publicLabel,
        detail: feature.featureKey,
        version: feature.concurrencyVersion,
        form: (
          <FeatureForm
            listingId={listing.id}
            feature={feature}
            action={action}
          />
        ),
      }))}
      create={<FeatureForm listingId={listing.id} action={action} />}
    />
  );
}

export function AccountImagesEditor({
  listing,
  action,
}: {
  listing: Listing;
  action: ServerAction;
}) {
  return (
    <CollectionEditor
      title="Media"
      empty="No public media configured."
      items={listing.images.map((image) => ({
        id: image.id,
        title: image.altText,
        detail: `${formatEnumLabel(image.imageType)} / ${image.assetPath}`,
        version: image.concurrencyVersion,
        form: (
          <ImageForm listingId={listing.id} image={image} action={action} />
        ),
      }))}
      create={<ImageForm listingId={listing.id} action={action} />}
    />
  );
}

export function AccountAvailabilityPanel({
  listing,
  availabilityAction,
  holdAction,
  releaseAction,
  expireAction,
  soldAction,
  reopenAction,
}: {
  listing: Listing;
  availabilityAction: ServerAction;
  holdAction: ServerAction;
  releaseAction: ServerAction;
  expireAction: ServerAction;
  soldAction: ServerAction;
  reopenAction: ServerAction;
}) {
  const activeHold = listing.holds.find((hold) => hold.status === "ACTIVE");
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="border-border bg-surface-1 rounded-2xl border p-5">
        <h2 className="display-type text-2xl">Availability</h2>
        <form action={availabilityAction} className="mt-5 grid gap-4">
          <input type="hidden" name="listingId" value={listing.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={listing.concurrencyVersion}
          />
          <label className={labelClass}>
            State
            <select
              className={fieldClass}
              name="availability"
              defaultValue={listing.availability}
            >
              {accountListingAvailabilities.map((state) => (
                <option key={state} value={state}>
                  {accountAvailabilityLabels[state]}
                </option>
              ))}
            </select>
          </label>
          <TextField name="reason" label="Audit reason" defaultValue="" />
          <Button className="w-fit" type="submit">
            Save availability
          </Button>
        </form>
      </section>
      <aside className="space-y-5">
        <section className="border-border bg-surface-1 rounded-2xl border p-5">
          <h2 className="font-bold">Temporary hold</h2>
          <form action={holdAction} className="mt-4 grid gap-4">
            <input type="hidden" name="listingId" value={listing.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={listing.concurrencyVersion}
            />
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
              name="reason"
              label="Safe internal reason"
              defaultValue=""
            />
            <Button type="submit" variant="secondary">
              Create hold
            </Button>
          </form>
        </section>
        <section className="border-border bg-surface-1 rounded-2xl border p-5">
          <h2 className="font-bold">Sold state</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            <form action={soldAction}>
              <input type="hidden" name="listingId" value={listing.id} />
              <input
                type="hidden"
                name="expectedVersion"
                value={listing.concurrencyVersion}
              />
              <ConfirmSubmitButton
                variant="danger"
                confirmation="Mark this listing sold? No order or payment is created."
              >
                Mark sold
              </ConfirmSubmitButton>
            </form>
            <form action={reopenAction}>
              <input type="hidden" name="listingId" value={listing.id} />
              <input
                type="hidden"
                name="expectedVersion"
                value={listing.concurrencyVersion}
              />
              <ConfirmSubmitButton
                variant="secondary"
                confirmation="Reopen this sold listing as available?"
              >
                Reopen
              </ConfirmSubmitButton>
            </form>
          </div>
        </section>
        <section className="border-border bg-surface-1 rounded-2xl border p-5">
          <h2 className="font-bold">Holds</h2>
          <div className="mt-4 space-y-3">
            {listing.holds.map((hold) => (
              <div
                className="border-border rounded-xl border p-3"
                key={hold.id}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <Badge
                    variant={hold.status === "ACTIVE" ? "warning" : "neutral"}
                  >
                    {formatEnumLabel(hold.status)}
                  </Badge>
                  <span className="text-text-muted text-xs">
                    Expires {hold.expiresAt.toLocaleString()}
                  </span>
                </div>
                {hold.status === "ACTIVE" && (
                  <form action={releaseAction} className="mt-3">
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input type="hidden" name="holdId" value={hold.id} />
                    <input
                      type="hidden"
                      name="expectedHoldVersion"
                      value={hold.concurrencyVersion}
                    />
                    <ConfirmSubmitButton
                      size="sm"
                      variant="secondary"
                      confirmation="Release this account hold?"
                    >
                      Release hold
                    </ConfirmSubmitButton>
                  </form>
                )}
              </div>
            ))}
            {!listing.holds.length && (
              <p className="text-text-muted text-sm">No holds recorded.</p>
            )}
          </div>
          <form action={expireAction} className="mt-4">
            <input type="hidden" name="listingId" value={listing.id} />
            <Button type="submit" size="sm" variant="secondary">
              Expire stale holds
            </Button>
          </form>
        </section>
        {activeHold && (
          <p className="text-warning text-sm">
            Public listings only show the held availability, not the actor or
            internal reason.
          </p>
        )}
      </aside>
    </div>
  );
}

export function AccountHandoverForm({
  listing,
  action,
}: {
  listing: Listing;
  action: ServerAction;
}) {
  const checklist = listing.handoverChecklist;
  if (!checklist) {
    return (
      <div className="border-border bg-surface-1 rounded-2xl border p-6">
        No handover checklist exists for this listing.
      </div>
    );
  }
  const booleanFields = [
    ["listingSecurityReviewed", "Listing security reviewed"],
    ["emailTransferRequired", "Email transfer required"],
    ["recoveryReviewRequired", "Recovery review required"],
    ["authenticatorResetRequired", "Authenticator reset required"],
    ["bankPinResetRequired", "Bank PIN reset required"],
    ["previousSessionsReviewRequired", "Previous sessions review required"],
    ["handoverInstructionsPrepared", "Handover instructions prepared"],
    ["ownershipEvidenceReviewed", "Ownership evidence reviewed"],
    ["readyForFutureHandover", "Ready for future handover"],
    ["finalAdminApprovalRequired", "Final admin approval required"],
  ] as const;
  return (
    <form
      action={action}
      className="border-border bg-surface-1 rounded-2xl border p-5"
    >
      <input type="hidden" name="listingId" value={listing.id} />
      <input
        type="hidden"
        name="expectedVersion"
        value={checklist.concurrencyVersion}
      />
      <h2 className="display-type text-2xl">Secure-handover readiness</h2>
      <p className="text-text-secondary mt-2 text-sm leading-6">
        Store checklist statuses only. Do not enter login details, passwords,
        recovery data, authenticator material or private customer information.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        {booleanFields.map(([name, label]) => (
          <label
            className="border-border bg-background/40 text-text-secondary flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"
            key={name}
          >
            <input
              type="checkbox"
              name={name}
              defaultChecked={Boolean(checklist[name])}
            />
            {label}
          </label>
        ))}
      </div>
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className={labelClass}>
          Readiness
          <select
            className={fieldClass}
            name="readiness"
            defaultValue={checklist.readiness}
          >
            {accountHandoverReadinessStates.map((state) => (
              <option key={state} value={state}>
                {formatEnumLabel(state)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-text-secondary flex items-center gap-3 pt-8 text-sm font-semibold">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={checklist.needsClientReview}
          />
          Needs client review
        </label>
      </div>
      <Button className="mt-5" type="submit">
        Save handover readiness
      </Button>
    </form>
  );
}

export function AccountRevisionHistory({
  listing,
  discardAction,
  restoreAction,
}: {
  listing: Listing;
  discardAction: ServerAction;
  restoreAction: ServerAction;
}) {
  return (
    <div className="space-y-6">
      <section className="border-border bg-surface-1 rounded-2xl border p-5">
        <h2 className="display-type text-2xl">Draft controls</h2>
        <p className="text-text-secondary mt-2 text-sm leading-6">
          Discard restores the latest published revision into the editable
          draft. Revision history remains immutable.
        </p>
        <form action={discardAction} className="mt-4">
          <input type="hidden" name="listingId" value={listing.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={listing.concurrencyVersion}
          />
          <ConfirmSubmitButton
            variant="secondary"
            confirmation="Discard draft changes and restore the latest published revision?"
          >
            Discard draft
          </ConfirmSubmitButton>
        </form>
      </section>
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
            {listing.revisions.map((revision) => (
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
                    <input type="hidden" name="listingId" value={listing.id} />
                    <input
                      type="hidden"
                      name="revisionId"
                      value={revision.id}
                    />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={listing.concurrencyVersion}
                    />
                    <ConfirmSubmitButton
                      size="sm"
                      variant="secondary"
                      confirmation={`Restore revision #${revision.revisionNumber} into the draft?`}
                    >
                      Restore
                    </ConfirmSubmitButton>
                  </form>
                </td>
              </tr>
            ))}
            {!listing.revisions.length && (
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

export function AccountDraftPreview({ listing }: { listing: Listing }) {
  const panels = [
    [
      ListChecks,
      "Stats",
      String(listing.stats.filter((item) => item.isPublic).length),
    ],
    [
      ShieldCheck,
      "Unlocks",
      String(listing.unlocks.filter((item) => item.isPublic).length),
    ],
    [
      Tags,
      "Features",
      String(listing.features.filter((item) => item.isPublic).length),
    ],
    [
      GalleryHorizontal,
      "Images",
      String(listing.images.filter((item) => item.isPublic).length),
    ],
    [Clock3, "Availability", accountAvailabilityLabels[listing.availability]],
    [History, "Revisions", String(listing.revisions.length)],
  ] as const;
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="border-border bg-surface-1 rounded-2xl border p-6">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={listing.approvalStatus} />
          <StatusBadge status={listing.publicationStatus} />
          <StatusBadge status={listing.availability} />
        </div>
        <h2 className="display-type mt-5 text-4xl">{listing.publicTitle}</h2>
        <p className="text-text-secondary mt-3 text-lg leading-8">
          {listing.shortDescription}
        </p>
        <p className="display-type mt-6 text-3xl">
          {formatCents(listing.basePriceCents, listing.currencyCode)}
        </p>
        <div className="text-text-secondary mt-6 space-y-4 leading-7">
          {listing.fullDescription.split(/\n{2,}/).map((paragraph) => (
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

function CollectionEditor({
  title,
  empty,
  items,
  create,
}: {
  title: string;
  empty: string;
  items: Array<{
    id: string;
    title: string;
    detail: string;
    version: number;
    form: ReactNode;
  }>;
  create: ReactNode;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="space-y-4">
        <h2 className="display-type text-3xl">{title}</h2>
        {items.map((item) => (
          <details
            className="border-border bg-surface-1 rounded-2xl border p-5"
            key={item.id}
          >
            <summary className="cursor-pointer font-bold">
              {item.title}
              <span className="text-text-muted ml-2 text-sm font-normal">
                {item.detail}
              </span>
            </summary>
            <div className="mt-5">{item.form}</div>
          </details>
        ))}
        {!items.length && (
          <p className="border-border bg-surface-1 rounded-2xl border p-5 text-sm">
            {empty}
          </p>
        )}
      </section>
      <aside className="border-border bg-surface-1 h-fit rounded-2xl border p-5">
        <h2 className="font-bold">Add {title.toLowerCase().slice(0, -1)}</h2>
        <div className="mt-5">{create}</div>
      </aside>
    </div>
  );
}

function StatForm({
  listingId,
  stat,
  action,
}: {
  listingId: string;
  stat?: Listing["stats"][number];
  action: ServerAction;
}) {
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="listingId" value={listingId} />
      {stat && (
        <>
          <input type="hidden" name="statId" value={stat.id} />
          <input
            type="hidden"
            name="expectedChildVersion"
            value={stat.concurrencyVersion}
          />
        </>
      )}
      <TextField
        name="statKey"
        label="Stat key"
        defaultValue={stat?.statKey ?? ""}
      />
      <TextField
        name="publicLabel"
        label="Public label"
        defaultValue={stat?.publicLabel ?? ""}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <NumberField
          name="value"
          label="Value"
          defaultValue={stat?.value ?? 0}
        />
        <NumberField
          name="maximumValue"
          label="Maximum value"
          defaultValue={stat?.maximumValue ?? ""}
        />
      </div>
      <SelectField
        name="statType"
        label="Stat type"
        values={accountStatTypes}
        defaultValue={stat?.statType ?? "SKILL"}
      />
      <TextField
        name="statGroup"
        label="Stat group"
        defaultValue={stat?.statGroup ?? "Skills"}
      />
      <NumberField
        name="sortOrder"
        label="Sort order"
        defaultValue={stat?.sortOrder ?? 10}
      />
      <BooleanToggles
        values={[
          ["isPublic", "Public", stat?.isPublic ?? true],
          [
            "needsClientReview",
            "Needs client review",
            stat?.needsClientReview ?? true,
          ],
        ]}
      />
      <Button className="w-fit" type="submit">
        Save stat
      </Button>
    </form>
  );
}

function UnlockForm({
  listingId,
  unlock,
  action,
}: {
  listingId: string;
  unlock?: Listing["unlocks"][number];
  action: ServerAction;
}) {
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="listingId" value={listingId} />
      {unlock && (
        <>
          <input type="hidden" name="unlockId" value={unlock.id} />
          <input
            type="hidden"
            name="expectedChildVersion"
            value={unlock.concurrencyVersion}
          />
        </>
      )}
      <TextField
        name="unlockKey"
        label="Unlock key"
        defaultValue={unlock?.unlockKey ?? ""}
      />
      <TextField
        name="publicLabel"
        label="Public label"
        defaultValue={unlock?.publicLabel ?? ""}
      />
      <SelectField
        name="unlockType"
        label="Unlock type"
        values={accountUnlockTypes}
        defaultValue={unlock?.unlockType ?? "QUEST"}
      />
      <label className={labelClass}>
        Description
        <textarea
          className={`${fieldClass} min-h-24`}
          name="description"
          defaultValue={unlock?.description ?? ""}
        />
      </label>
      <NumberField
        name="sortOrder"
        label="Sort order"
        defaultValue={unlock?.sortOrder ?? 10}
      />
      <BooleanToggles
        values={[
          ["isPublic", "Public", unlock?.isPublic ?? true],
          ["filterable", "Filterable", unlock?.filterable ?? true],
          [
            "needsClientReview",
            "Needs client review",
            unlock?.needsClientReview ?? true,
          ],
        ]}
      />
      <Button className="w-fit" type="submit">
        Save unlock
      </Button>
    </form>
  );
}

function FeatureForm({
  listingId,
  feature,
  action,
}: {
  listingId: string;
  feature?: Listing["features"][number];
  action: ServerAction;
}) {
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="listingId" value={listingId} />
      {feature && (
        <>
          <input type="hidden" name="featureId" value={feature.id} />
          <input
            type="hidden"
            name="expectedChildVersion"
            value={feature.concurrencyVersion}
          />
        </>
      )}
      <TextField
        name="featureKey"
        label="Feature key"
        defaultValue={feature?.featureKey ?? ""}
      />
      <TextField
        name="publicLabel"
        label="Public label"
        defaultValue={feature?.publicLabel ?? ""}
      />
      <label className={labelClass}>
        Description
        <textarea
          className={`${fieldClass} min-h-24`}
          name="description"
          defaultValue={feature?.description ?? ""}
        />
      </label>
      <NumberField
        name="sortOrder"
        label="Sort order"
        defaultValue={feature?.sortOrder ?? 10}
      />
      <BooleanToggles
        values={[
          ["isPublic", "Public", feature?.isPublic ?? true],
          ["filterable", "Filterable", feature?.filterable ?? true],
          [
            "needsClientReview",
            "Needs client review",
            feature?.needsClientReview ?? true,
          ],
        ]}
      />
      <Button className="w-fit" type="submit">
        Save feature
      </Button>
    </form>
  );
}

function ImageForm({
  listingId,
  image,
  action,
}: {
  listingId: string;
  image?: Listing["images"][number];
  action: ServerAction;
}) {
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="listingId" value={listingId} />
      {image && (
        <>
          <input type="hidden" name="imageId" value={image.id} />
          <input
            type="hidden"
            name="expectedChildVersion"
            value={image.concurrencyVersion}
          />
        </>
      )}
      <SelectField
        name="imageType"
        label="Image type"
        values={accountImageTypes}
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
        defaultValue={defaultValue}
        required={required}
      />
    </label>
  );
}

function NumberField({
  name,
  label,
  defaultValue,
  min = 0,
}: {
  name: string;
  label: string;
  defaultValue: number | string;
  min?: number;
}) {
  return (
    <label className={labelClass}>
      {label}
      <input
        className={fieldClass}
        name={name}
        type="number"
        min={min}
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
}: {
  name: string;
  label: string;
  values: readonly T[];
  defaultValue: T;
}) {
  return (
    <label className={labelClass}>
      {label}
      <select className={fieldClass} name={name} defaultValue={defaultValue}>
        {values.map((value) => (
          <option key={value} value={value}>
            {formatEnumLabel(value)}
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
    <div className="flex flex-wrap gap-4">
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
