"use client";

import {
  Calculator,
  CheckCircle2,
  Clock3,
  FileWarning,
  LockKeyhole,
  Send,
  ShieldAlert,
} from "lucide-react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  customBuildEstimateLabels,
  customBuildGameModeLabels,
  customBuildSkillLabels,
} from "@/lib/custom-build/constants";
import type { PublishedCustomBuildRevisionSnapshotV1 } from "@/lib/custom-build/estimate";
import { formatCents } from "@/lib/pricing/engine";

type EstimatePayload = {
  state: keyof typeof customBuildEstimateLabels;
  currency: string;
  estimateLines: Array<{ label: string; amountCents: number }>;
  automaticSubtotalCents: number | null;
  estimatedTotalCents: number | null;
  estimatedTotal: string | null;
  manualReviewReasons: Array<{ code: string; message: string }>;
  finalPriceNote: string;
};

type RequestResult = {
  created: boolean;
  publicRequestNumber: string;
  trackingUrl: string | null;
};

export function CustomBuildEngine({
  service,
  revision,
  featureEnabled,
}: {
  service: {
    slug: string;
    publicName: string;
    publicDescription: string;
    publicInstructions: string;
    attachmentPolicy: string;
    customerNoteMaxLength: number;
  };
  revision: PublishedCustomBuildRevisionSnapshotV1 | null;
  featureEnabled: boolean;
}) {
  const availableSkills = useMemo(
    () =>
      [
        ...new Set(
          (revision?.skillRules ?? [])
            .filter((rule) => rule.enabled)
            .map((rule) => rule.skillKey),
        ),
      ].slice(0, 8),
    [revision],
  );
  const [skillKey, setSkillKey] = useState<string>(
    availableSkills[0] ?? "ATTACK",
  );
  const [gameMode, setGameMode] = useState("NORMAL");
  const [valueMode, setValueMode] = useState("LEVEL");
  const [currentLevel, setCurrentLevel] = useState("1");
  const [targetLevel, setTargetLevel] = useState("50");
  const [selectedObjectives, setSelectedObjectives] = useState<string[]>([]);
  const [estimate, setEstimate] = useState<EstimatePayload | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [requestResult, setRequestResult] = useState<RequestResult | null>(
    null,
  );

  async function calculateEstimate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setSubmitting(true);
    const response = await fetch("/api/custom-build/estimate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceSlug: service.slug,
        gameMode,
        skills: [
          {
            skillKey,
            valueMode,
            currentLevel:
              valueMode === "UNKNOWN_CURRENT" ? null : Number(currentLevel),
            targetLevel: Number(targetLevel),
            freshStart: valueMode === "FRESH_ACCOUNT",
          },
        ],
        objectives: selectedObjectives.map((stableKey) => ({
          stableKey,
          customerAlreadyCompleted: false,
        })),
      }),
    });
    const payload = (await response.json()) as
      { ok: true; estimate: EstimatePayload } | { ok: false; message: string };
    setSubmitting(false);
    if (!payload.ok) {
      setMessage(payload.message);
      setEstimate(null);
      return;
    }
    setEstimate(payload.estimate);
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!estimate) return;
    setMessage("");
    setSubmitting(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/custom-build/requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        serviceSlug: service.slug,
        gameMode,
        skills: [
          {
            skillKey,
            valueMode,
            currentLevel:
              valueMode === "UNKNOWN_CURRENT" ? null : Number(currentLevel),
            targetLevel: Number(targetLevel),
            freshStart: valueMode === "FRESH_ACCOUNT",
          },
        ],
        objectives: selectedObjectives.map((stableKey) => ({
          stableKey,
          customerAlreadyCompleted: false,
        })),
        displayName: form.get("displayName"),
        email: form.get("email"),
        discordUsername: form.get("discordUsername"),
        rsn: form.get("rsn"),
        customerNotes: form.get("customerNotes"),
        consentAccepted: form.get("consentAccepted") === "on",
        idempotencyKey: crypto.randomUUID(),
      }),
    });
    const payload = (await response.json()) as
      { ok: true; request: RequestResult } | { ok: false; message: string };
    setSubmitting(false);
    if (!payload.ok) {
      setMessage(payload.message);
      return;
    }
    setRequestResult(payload.request);
  }

  if (!revision) {
    return (
      <main id="main-content" className="min-h-[70vh]">
        <UnavailablePanel title="Configuration review required">
          A published custom-build configuration is required before customers
          can request account-build quotes.
        </UnavailablePanel>
      </main>
    );
  }

  return (
    <main id="main-content" className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-10 sm:py-14">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <div className="flex flex-wrap gap-2">
            <Badge variant={featureEnabled ? "success" : "warning"}>
              {featureEnabled ? "Request intake enabled" : "Review mode"}
            </Badge>
            <Badge variant="info">Custom account build</Badge>
          </div>
          <h1 className="display-type mt-5 max-w-4xl text-4xl sm:text-6xl">
            {service.publicName}
          </h1>
          <p className="text-text-secondary mt-5 max-w-3xl text-lg leading-8">
            {service.publicDescription}
          </p>
        </div>
      </section>

      {!featureEnabled && (
        <div className="mx-auto max-w-7xl px-5 pt-8 sm:px-8">
          <UnavailablePanel title="Request intake is paused">
            Admins can configure the engine, but public request submission is
            disabled until `custom_account_build_enabled` is approved.
          </UnavailablePanel>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <section className="space-y-8">
          <form
            className="border-border bg-surface-1 rounded-2xl border p-5 sm:p-6"
            onSubmit={calculateEstimate}
          >
            <div className="flex items-center gap-3">
              <Calculator className="text-primary size-5" aria-hidden="true" />
              <h2 className="display-type text-3xl">Build targets</h2>
            </div>
            <p className="text-text-secondary mt-3 text-sm leading-6">
              {service.publicInstructions}
            </p>
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              <Select
                label="Game mode"
                value={gameMode}
                onChange={setGameMode}
                options={Object.entries(customBuildGameModeLabels)}
              />
              <Select
                label="Skill"
                value={skillKey}
                onChange={setSkillKey}
                options={availableSkills.map((skill) => [
                  skill,
                  customBuildSkillLabels[skill],
                ])}
              />
              <Select
                label="Current state"
                value={valueMode}
                onChange={setValueMode}
                options={[
                  ["LEVEL", "Current and target levels"],
                  ["FRESH_ACCOUNT", "Fresh account selected"],
                  ["UNKNOWN_CURRENT", "Current state unknown"],
                ]}
              />
              <label className="text-text-secondary grid gap-2 text-sm font-semibold">
                Target level
                <input
                  className="border-border bg-background min-h-11 rounded-xl border px-3"
                  type="number"
                  min="2"
                  max="99"
                  value={targetLevel}
                  onChange={(event) => setTargetLevel(event.target.value)}
                />
              </label>
              {valueMode === "LEVEL" && (
                <label className="text-text-secondary grid gap-2 text-sm font-semibold">
                  Current level
                  <input
                    className="border-border bg-background min-h-11 rounded-xl border px-3"
                    type="number"
                    min="1"
                    max="98"
                    value={currentLevel}
                    onChange={(event) => setCurrentLevel(event.target.value)}
                  />
                </label>
              )}
            </div>
            <fieldset className="mt-6 grid gap-3 border-0 p-0">
              <legend className="font-bold">Objectives</legend>
              <div className="grid gap-3 md:grid-cols-2">
                {revision.objectives.map((objective) => (
                  <label
                    className="border-border bg-background/40 flex min-h-12 items-start gap-3 rounded-xl border p-3 text-sm"
                    key={objective.stableKey}
                  >
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={selectedObjectives.includes(objective.stableKey)}
                      onChange={(event) => {
                        setSelectedObjectives((current) =>
                          event.target.checked
                            ? [...current, objective.stableKey]
                            : current.filter(
                                (item) => item !== objective.stableKey,
                              ),
                        );
                      }}
                    />
                    <span>
                      <strong>{objective.publicName}</strong>
                      <span className="text-text-muted mt-1 block">
                        {objective.objectiveGroup ?? objective.objectiveType}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <Button className="mt-6" disabled={submitting} type="submit">
              Calculate estimate
            </Button>
          </form>

          {estimate && (
            <section
              className="border-border bg-surface-1 rounded-2xl border p-5 sm:p-6"
              aria-live="polite"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <CheckCircle2
                    className="text-primary size-5"
                    aria-hidden="true"
                  />
                  <h2 className="display-type text-3xl">
                    {customBuildEstimateLabels[estimate.state]}
                  </h2>
                </div>
                {estimate.estimatedTotal ? (
                  <Badge variant="success">{estimate.estimatedTotal}</Badge>
                ) : (
                  <Badge variant="warning">Support review</Badge>
                )}
              </div>
              <div className="mt-5 overflow-x-auto">
                <table className="w-full min-w-xl text-left text-sm">
                  <thead className="text-text-muted">
                    <tr>
                      <th className="py-2">Line</th>
                      <th className="py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {estimate.estimateLines.map((line) => (
                      <tr key={`${line.label}:${line.amountCents}`}>
                        <td className="py-3">{line.label}</td>
                        <td className="py-3 text-right font-bold">
                          {formatCents(line.amountCents, estimate.currency)}
                        </td>
                      </tr>
                    ))}
                    {!estimate.estimateLines.length && (
                      <tr>
                        <td className="text-text-muted py-3" colSpan={2}>
                          No automatic line items are available.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {estimate.manualReviewReasons.length > 0 && (
                <ul className="mt-5 grid gap-2">
                  {estimate.manualReviewReasons.map((reason) => (
                    <li
                      className="text-warning flex gap-2 text-sm"
                      key={reason.code}
                    >
                      <ShieldAlert className="mt-0.5 size-4" aria-hidden />
                      {reason.message}
                    </li>
                  ))}
                </ul>
              )}
              <p className="text-text-secondary mt-5 text-sm leading-6">
                {estimate.finalPriceNote}
              </p>
            </section>
          )}

          {estimate && featureEnabled && (
            <form
              className="border-border bg-surface-1 rounded-2xl border p-5 sm:p-6"
              onSubmit={submitRequest}
            >
              <div className="flex items-center gap-3">
                <Send className="text-primary size-5" aria-hidden="true" />
                <h2 className="display-type text-3xl">Request quote review</h2>
              </div>
              <div className="mt-6 grid gap-5 md:grid-cols-2">
                <TextField name="displayName" label="Display name" />
                <TextField name="email" label="Email address" type="email" />
                <TextField
                  name="discordUsername"
                  label="Discord username"
                  required={false}
                />
                <TextField
                  name="rsn"
                  label="RSN or public character name"
                  required={false}
                />
              </div>
              <label className="text-text-secondary mt-5 grid gap-2 text-sm font-semibold">
                Private requirements notes
                <textarea
                  className="border-border bg-background min-h-32 rounded-xl border px-3 py-3"
                  maxLength={service.customerNoteMaxLength}
                  name="customerNotes"
                />
              </label>
              <div className="border-warning/30 bg-warning/10 mt-5 rounded-xl border p-4 text-sm leading-6">
                <FileWarning
                  className="text-warning mb-2 size-5"
                  aria-hidden="true"
                />
                {service.attachmentPolicy}
              </div>
              <label className="text-text-secondary mt-5 flex items-start gap-3 text-sm">
                <input
                  className="mt-1"
                  name="consentAccepted"
                  type="checkbox"
                />
                I consent to OSRS Services storing these request details for
                support follow-up. I understand this does not create an account,
                marketing subscription, order or payment.
              </label>
              <Button className="mt-6" disabled={submitting} type="submit">
                Submit request
              </Button>
            </form>
          )}

          {message && (
            <p className="border-danger/30 bg-danger/10 text-danger rounded-xl border p-4 text-sm">
              {message}
            </p>
          )}
          {requestResult && (
            <section className="border-success/30 bg-success/10 rounded-2xl border p-5">
              <h2 className="display-type text-2xl">Request received</h2>
              <p className="text-text-secondary mt-2 text-sm">
                Request number {requestResult.publicRequestNumber}. Save the
                tracking link shown now; the raw token is not stored.
              </p>
              {requestResult.trackingUrl && (
                <Button asChild className="mt-5">
                  <a href={requestResult.trackingUrl}>Open tracking page</a>
                </Button>
              )}
            </section>
          )}
        </section>

        <aside className="space-y-5">
          <InfoPanel
            icon="lock"
            title="Credential boundary"
            body="We never ask for an account password during the quote stage. Do not upload screenshots containing credentials or private account information."
          />
          <InfoPanel
            icon="clock"
            title="Quote-only workflow"
            body="Accepted quotes remain quotes only. This task creates no cart, checkout, order, order item, payment or handover."
          />
        </aside>
      </div>
    </main>
  );
}

export function CustomBuildTrackingView({
  data,
  token,
}: {
  data: {
    publicRequestNumber: string;
    publicStatusLabel: string;
    status: string;
    quote: {
      id: string;
      publicQuoteNumber: string;
      status: string;
      expiresAt: Date | null;
      latestRevision: {
        revisionNumber: number;
        finalTotalCents: number;
        estimatedDeliveryText: string;
        includedWorkSummary: string;
        customerSafeTerms: string;
        lines: Array<{
          id: string;
          publicDescription: string;
          quantity: number;
          lineTotalCents: number;
        }>;
      } | null;
    } | null;
  };
  token: string;
}) {
  const [message, setMessage] = useState("");
  async function decide(decision: "ACCEPTED" | "DECLINED") {
    if (!data.quote?.latestRevision) return;
    const response = await fetch(
      `/api/custom-build/quotes/${data.quote.id}/decision`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          revisionNumber: data.quote.latestRevision.revisionNumber,
          decision,
        }),
      },
    );
    const payload = (await response.json()) as
      { ok: true; status: string } | { ok: false; message: string };
    setMessage(
      payload.ok ? `Quote ${payload.status.toLowerCase()}.` : payload.message,
    );
  }
  return (
    <main id="main-content" className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-10 sm:py-14">
        <div className="mx-auto max-w-5xl px-5 sm:px-8">
          <Badge variant="info">Secure tracking</Badge>
          <h1 className="display-type mt-5 text-4xl sm:text-5xl">
            {data.publicRequestNumber}
          </h1>
          <p className="text-text-secondary mt-4">{data.publicStatusLabel}</p>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-5 py-10 sm:px-8">
        {data.quote?.latestRevision ? (
          <section className="border-border bg-surface-1 rounded-2xl border p-5 sm:p-6">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <Badge variant="success">{data.quote.status}</Badge>
                <h2 className="display-type mt-4 text-3xl">
                  {data.quote.publicQuoteNumber}
                </h2>
              </div>
              <p className="display-type text-3xl">
                {formatCents(data.quote.latestRevision.finalTotalCents)}
              </p>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-xl text-left text-sm">
                <tbody className="divide-border divide-y">
                  {data.quote.latestRevision.lines.map((line) => (
                    <tr key={line.id}>
                      <td className="py-3">
                        {line.publicDescription} x {line.quantity}
                      </td>
                      <td className="py-3 text-right font-bold">
                        {formatCents(line.lineTotalCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-text-secondary mt-5 leading-7">
              {data.quote.latestRevision.includedWorkSummary}
            </p>
            <p className="text-text-muted mt-3 text-sm">
              Estimated delivery:{" "}
              {data.quote.latestRevision.estimatedDeliveryText}
            </p>
            <p className="text-text-muted mt-3 text-sm">
              {data.quote.latestRevision.customerSafeTerms}
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={() => decide("ACCEPTED")}>Accept quote</Button>
              <Button onClick={() => decide("DECLINED")} variant="danger">
                Decline quote
              </Button>
            </div>
            {message && (
              <p className="text-text-secondary mt-4 text-sm">{message}</p>
            )}
          </section>
        ) : (
          <UnavailablePanel title="No sent quote yet">
            Support can review the request and send a versioned quote here.
          </UnavailablePanel>
        )}
      </div>
    </main>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: Array<[string, string]>;
}) {
  return (
    <label className="text-text-secondary grid gap-2 text-sm font-semibold">
      {label}
      <select
        className="border-border bg-background min-h-11 rounded-xl border px-3"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
    </label>
  );
}

function TextField({
  name,
  label,
  type = "text",
  required = true,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="text-text-secondary grid gap-2 text-sm font-semibold">
      {label}
      <input
        className="border-border bg-background min-h-11 rounded-xl border px-3"
        name={name}
        required={required}
        type={type}
      />
    </label>
  );
}

function InfoPanel({
  icon,
  title,
  body,
}: {
  icon: "lock" | "clock";
  title: string;
  body: string;
}) {
  const Icon = icon === "lock" ? LockKeyhole : Clock3;
  return (
    <section className="border-border bg-surface-1 rounded-2xl border p-5">
      <Icon className="text-primary size-5" aria-hidden="true" />
      <h2 className="mt-3 font-bold">{title}</h2>
      <p className="text-text-secondary mt-2 text-sm leading-6">{body}</p>
    </section>
  );
}

function UnavailablePanel({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="border-warning/30 bg-warning/10 rounded-2xl border p-6">
      <h2 className="display-type text-3xl">{title}</h2>
      <p className="text-text-secondary mt-3 leading-7">{children}</p>
    </section>
  );
}
