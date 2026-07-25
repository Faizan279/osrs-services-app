import Link from "next/link";

import { fieldClass, labelClass } from "@/components/catalogue-admin";
import { Button } from "@/components/ui/button";
import { requireCapability } from "@/lib/auth/guards";
import {
  getPricingAdminOptions,
  getPricingPreview,
} from "@/lib/pricing/queries";
import { formatCents } from "@/lib/pricing/engine";

export const metadata = { title: "Pricing preview" };
export const dynamic = "force-dynamic";

type PreviewParams = {
  serviceId?: string;
  baseSubtotalCents?: string;
  previewAt?: string;
};

function parsePreviewDate(value?: string) {
  if (!value) return new Date();
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

export default async function PricingPreviewPage({
  searchParams,
}: {
  searchParams: Promise<PreviewParams>;
}) {
  await requireCapability("pricing.view", "/admin/pricing/preview");
  const filters = await searchParams;
  const baseSubtotalCents = Math.max(
    0,
    Number.parseInt(filters.baseSubtotalCents ?? "10000", 10) || 10_000,
  );
  const previewAt = parsePreviewDate(filters.previewAt);
  const [options, preview] = await Promise.all([
    getPricingAdminOptions(),
    getPricingPreview({
      serviceId: filters.serviceId,
      baseSubtotalCents,
      previewAt,
    }),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-5 py-8 sm:px-8 lg:py-12">
      <div className="flex flex-wrap items-end justify-between gap-5">
        <div>
          <p className="text-gold kicker-type">Pricing center</p>
          <h1 className="display-type mt-3 text-4xl">Preview</h1>
          <p className="text-text-secondary mt-3">
            Run draft global pricing against a service subtotal before
            publishing.
          </p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/admin/pricing">Overview</Link>
        </Button>
      </div>
      <form className="border-border bg-surface-1 mt-8 grid gap-4 rounded-2xl border p-5 md:grid-cols-3">
        <label className={labelClass}>
          Service
          <select
            className={fieldClass}
            name="serviceId"
            defaultValue={filters.serviceId ?? ""}
          >
            <option value="">First service</option>
            {options.services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name}
              </option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          Base subtotal cents
          <input
            className={fieldClass}
            name="baseSubtotalCents"
            type="number"
            min="0"
            max="100000000"
            defaultValue={baseSubtotalCents}
          />
        </label>
        <label className={labelClass}>
          Preview time
          <input
            className={fieldClass}
            name="previewAt"
            type="datetime-local"
            defaultValue={previewAt.toISOString().slice(0, 16)}
          />
        </label>
        <div className="md:col-span-3">
          <Button type="submit">Run preview</Button>
        </div>
      </form>
      <section className="border-border bg-surface-1 mt-8 rounded-2xl border p-6">
        <h2 className="display-type text-3xl">Pricing result</h2>
        {preview ? (
          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <div className="overflow-x-auto">
              <table className="w-full min-w-lg text-left text-sm">
                <thead className="text-text-muted">
                  <tr>
                    <th className="py-2 pr-4">Line</th>
                    <th className="py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {preview.lineItems.map((line, index) => (
                    <tr key={`${line.label}-${index}`}>
                      <td className="py-3 pr-4">{line.label}</td>
                      <td className="py-3 text-right font-bold">
                        {formatCents(line.amountCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <aside className="bg-surface-2 rounded-xl p-5">
              <p className="text-text-muted text-sm">Final estimated total</p>
              <p className="display-type mt-2 text-4xl">
                {preview.estimatedTotal}
              </p>
              <p className="text-text-muted mt-4 text-sm">
                Revision preview #
                {preview.pricingRevision?.revisionNumber ?? "draft"}
              </p>
            </aside>
          </div>
        ) : (
          <p className="text-warning mt-5 text-sm font-semibold">
            Add catalogue seed data and a draft pricing rule set before
            previewing.
          </p>
        )}
      </section>
    </main>
  );
}
