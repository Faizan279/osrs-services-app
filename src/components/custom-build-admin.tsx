import {
  Download,
  FileWarning,
  History,
  ListChecks,
  Send,
  Settings,
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
  customBuildGameModeLabels,
  customBuildObjectiveTypes,
  customBuildPricingModes,
  customBuildPublicStatusLabels,
  customBuildQuoteStatusLabels,
  customBuildSkillLabels,
} from "@/lib/custom-build/constants";
import type {
  getCustomBuildAdminConfig,
  getCustomBuildRequestAdmin,
  getCustomBuildRequestsAdmin,
} from "@/lib/custom-build/admin";
import { catalogueGameModes, formatEnumLabel } from "@/lib/catalogue/constants";
import { formatCents } from "@/lib/pricing/engine";

type ServerAction = (formData: FormData) => void | Promise<void>;
type Config = NonNullable<
  Awaited<ReturnType<typeof getCustomBuildAdminConfig>>
>;
type RequestRow = Awaited<
  ReturnType<typeof getCustomBuildRequestsAdmin>
>[number];
type RequestDetail = NonNullable<
  Awaited<ReturnType<typeof getCustomBuildRequestAdmin>>
>;

export function CustomBuildAdminTabs() {
  const tabs = [
    ["Overview", "/admin/custom-builds"],
    ["Config", "/admin/custom-builds/config"],
    ["Rules", "/admin/custom-builds/rules"],
    ["Objectives", "/admin/custom-builds/objectives"],
    ["Requests", "/admin/custom-builds/requests"],
    ["Revisions", "/admin/custom-builds/revisions"],
    ["Preview", "/admin/custom-builds/preview"],
  ] as const;
  return (
    <nav
      aria-label="Custom-build sections"
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

export function CustomBuildConfigSummary({
  config,
}: {
  config: Config | null;
}) {
  if (!config) {
    return (
      <Panel title="Configuration missing">
        Run the Task 011 seed on a migrated database to create the custom-build
        service configuration.
      </Panel>
    );
  }
  return (
    <div className="grid gap-4 md:grid-cols-4">
      <SummaryStat label="Service" value={config.publicName} />
      <SummaryStat
        label="Availability"
        value={formatEnumLabel(config.availabilityState)}
      />
      <SummaryStat
        label="Draft rule sets"
        value={String(config.ruleSets.length)}
      />
      <SummaryStat
        label="Published revisions"
        value={String(config.revisions.length)}
      />
    </div>
  );
}

export function CustomBuildConfigForm({
  config,
  action,
}: {
  config: Config;
  action: ServerAction;
}) {
  return (
    <form action={action} className="grid gap-6">
      <input type="hidden" name="serviceConfigId" value={config.id} />
      <input
        type="hidden"
        name="expectedVersion"
        value={config.concurrencyVersion}
      />
      <fieldset className="grid gap-5 border-0 p-0 lg:grid-cols-2">
        <legend className="display-type mb-4 text-2xl">
          Public configuration
        </legend>
        <TextField
          name="publicName"
          label="Public name"
          defaultValue={config.publicName}
        />
        <TextField name="slug" label="Slug" defaultValue={config.slug} />
        <label className={`${labelClass} lg:col-span-2`}>
          Public description
          <textarea
            className={`${fieldClass} min-h-32`}
            name="publicDescription"
            defaultValue={config.publicDescription}
          />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Public instructions
          <textarea
            className={`${fieldClass} min-h-32`}
            name="publicInstructions"
            defaultValue={config.publicInstructions}
          />
        </label>
        <label className={`${labelClass} lg:col-span-2`}>
          Private internal instructions
          <textarea
            className={`${fieldClass} min-h-24`}
            name="privateInternalInstructions"
            defaultValue={config.privateInternalInstructions ?? ""}
          />
        </label>
      </fieldset>
      <fieldset className="grid gap-5 border-0 p-0 lg:grid-cols-3">
        <legend className="display-type mb-4 text-2xl">
          Operational limits
        </legend>
        <SelectField
          name="availabilityState"
          label="Availability"
          values={["AVAILABLE", "PAUSED", "UNAVAILABLE"]}
          defaultValue={config.availabilityState}
        />
        <NumberField
          name="minimumAutomaticEstimateCents"
          label="Minimum automatic cents"
          defaultValue={config.minimumAutomaticEstimateCents}
        />
        <NumberField
          name="maximumAutomaticEstimateCents"
          label="Maximum automatic cents"
          defaultValue={config.maximumAutomaticEstimateCents ?? ""}
        />
        <NumberField
          name="quoteValidityDaysDefault"
          label="Quote validity days"
          defaultValue={config.quoteValidityDaysDefault}
        />
        <NumberField
          name="maxAttachments"
          label="Max attachments"
          defaultValue={config.maxAttachments}
        />
        <NumberField
          name="customerNoteMaxLength"
          label="Note max length"
          defaultValue={config.customerNoteMaxLength}
        />
        <NumberField
          name="maxAttachmentBytes"
          label="Max file bytes"
          defaultValue={config.maxAttachmentBytes}
        />
        <NumberField
          name="maxTotalAttachmentBytes"
          label="Max total bytes"
          defaultValue={config.maxTotalAttachmentBytes}
        />
        <label className="text-text-secondary flex items-center gap-3 pt-8 text-sm font-semibold">
          <input
            type="checkbox"
            name="needsClientReview"
            defaultChecked={config.needsClientReview}
          />
          Needs client review
        </label>
      </fieldset>
      <label className={labelClass}>
        Attachment policy
        <textarea
          className={`${fieldClass} min-h-28`}
          name="attachmentPolicy"
          defaultValue={config.attachmentPolicy}
        />
      </label>
      <Button className="w-fit" type="submit">
        Save configuration
      </Button>
    </form>
  );
}

export function CustomBuildRulesEditor({
  config,
  skillAction,
  objectiveRuleAction,
}: {
  config: Config;
  skillAction: ServerAction;
  objectiveRuleAction: ServerAction;
}) {
  const ruleSet = config.ruleSets.find((item) => item.status === "DRAFT");
  if (!ruleSet) return <Panel title="No draft rule set">Run seed first.</Panel>;
  return (
    <div className="grid gap-8">
      <Collection title="Skill pricing rules">
        {ruleSet.skillRules.map((rule) => (
          <details
            className="border-border bg-surface-1 rounded-2xl border p-5"
            key={rule.id}
          >
            <summary className="cursor-pointer font-bold">
              {customBuildSkillLabels[rule.skillKey]}{" "}
              <StatusBadge status={rule.pricingMode} />
            </summary>
            <SkillRuleForm
              ruleSetId={ruleSet.id}
              rule={rule}
              action={skillAction}
            />
          </details>
        ))}
        <Panel title="Add skill rule">
          <SkillRuleForm ruleSetId={ruleSet.id} action={skillAction} />
        </Panel>
      </Collection>
      <Collection title="Objective pricing rules">
        {ruleSet.objectiveRules.map((rule) => (
          <details
            className="border-border bg-surface-1 rounded-2xl border p-5"
            key={rule.id}
          >
            <summary className="cursor-pointer font-bold">
              {rule.objective.publicName}{" "}
              <StatusBadge status={rule.pricingMode} />
            </summary>
            <ObjectiveRuleForm
              ruleSetId={ruleSet.id}
              objectives={config.objectives}
              rule={rule}
              action={objectiveRuleAction}
            />
          </details>
        ))}
        <Panel title="Add objective rule">
          <ObjectiveRuleForm
            ruleSetId={ruleSet.id}
            objectives={config.objectives}
            action={objectiveRuleAction}
          />
        </Panel>
      </Collection>
    </div>
  );
}

export function CustomBuildObjectivesEditor({
  config,
  action,
}: {
  config: Config;
  action: ServerAction;
}) {
  return (
    <Collection title="Objectives">
      {config.objectives.map((objective) => (
        <details
          className="border-border bg-surface-1 rounded-2xl border p-5"
          key={objective.id}
        >
          <summary className="cursor-pointer font-bold">
            {objective.publicName}{" "}
            <StatusBadge status={objective.objectiveType} />
          </summary>
          <ObjectiveForm
            configId={config.id}
            objective={objective}
            action={action}
          />
        </details>
      ))}
      <Panel title="Add objective">
        <ObjectiveForm configId={config.id} action={action} />
      </Panel>
    </Collection>
  );
}

export function CustomBuildRequestsTable({
  requests,
}: {
  requests: RequestRow[];
}) {
  if (!requests.length)
    return (
      <Panel title="No requests yet">
        Submitted requests will appear here.
      </Panel>
    );
  return (
    <div className="border-border bg-surface-1 overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-5xl text-left text-sm">
        <thead className="bg-surface-2 text-text-muted">
          <tr>
            <th className="p-4">Request</th>
            <th className="p-4">Status</th>
            <th className="p-4">Estimate</th>
            <th className="p-4">Quote</th>
            <th className="p-4">Submitted</th>
            <th className="p-4">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {requests.map((request) => (
            <tr key={request.id}>
              <td className="p-4">
                <p className="font-bold">{request.publicRequestNumber}</p>
                <p className="text-text-muted mt-1">
                  {request.service.publicName}
                </p>
              </td>
              <td className="p-4">
                <StatusBadge status={request.status} />
              </td>
              <td className="p-4">
                {request.estimateState ? (
                  <StatusBadge status={request.estimateState} />
                ) : (
                  "None"
                )}
              </td>
              <td className="p-4">
                {request.quote ? (
                  <>
                    <StatusBadge status={request.quote.status} />
                    <p className="text-text-muted mt-1">
                      {request.quote.publicQuoteNumber}
                    </p>
                  </>
                ) : (
                  "Not started"
                )}
              </td>
              <td className="text-text-secondary p-4">
                {request.submittedAt.toLocaleString()}
              </td>
              <td className="p-4">
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/admin/custom-builds/requests/${request.id}`}>
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

export function CustomBuildRequestDetail({
  request,
  statusAction,
}: {
  request: RequestDetail;
  statusAction: ServerAction;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <section className="border-border bg-surface-1 rounded-2xl border p-5">
        <div className="flex flex-wrap gap-2">
          <StatusBadge status={request.status} />
          {request.estimateState && (
            <StatusBadge status={request.estimateState} />
          )}
        </div>
        <h2 className="display-type mt-5 text-3xl">
          {request.publicRequestNumber}
        </h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <SummaryStat
            label="Display name"
            value={request.displayName}
            sensitive
          />
          <SummaryStat label="Email" value={request.email} sensitive />
          <SummaryStat
            label="Discord"
            value={request.discordUsername ?? "Not provided"}
            sensitive
          />
          <SummaryStat
            label="RSN"
            value={request.rsn ?? "Not provided"}
            sensitive
          />
        </div>
        <section className="mt-6">
          <h3 className="font-bold">Private notes</h3>
          <p className="text-text-secondary screenshot-sensitive mt-2 text-sm leading-6 whitespace-pre-line">
            {request.customerNotes || "No notes provided."}
          </p>
        </section>
        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <Panel title="Skills">
            {request.skills.map((skill) => (
              <p key={skill.id}>
                {customBuildSkillLabels[skill.skillKey]}{" "}
                {skill.targetLevel ? `to ${skill.targetLevel}` : ""}
              </p>
            ))}
          </Panel>
          <Panel title="Objectives">
            {request.objectives.map((objective) => (
              <p key={objective.id}>{objective.publicName}</p>
            ))}
          </Panel>
        </section>
      </section>
      <aside className="space-y-5">
        <form
          action={statusAction}
          className="border-border bg-surface-1 rounded-2xl border p-5"
        >
          <h2 className="font-bold">Status transition</h2>
          <input type="hidden" name="requestId" value={request.id} />
          <input
            type="hidden"
            name="expectedVersion"
            value={request.concurrencyVersion}
          />
          <SelectField
            name="nextStatus"
            label="Next status"
            values={Object.keys(customBuildPublicStatusLabels)}
            defaultValue="UNDER_REVIEW"
          />
          <label className={labelClass}>
            Public message
            <textarea
              className={`${fieldClass} min-h-20`}
              name="publicMessage"
            />
          </label>
          <label className={labelClass}>
            Private internal reason
            <textarea
              className={`${fieldClass} min-h-20`}
              name="internalReason"
            />
          </label>
          <Button className="mt-4" type="submit">
            Update status
          </Button>
        </form>
      </aside>
    </div>
  );
}

export function CustomBuildAttachmentsPanel({
  request,
  action,
}: {
  request: RequestDetail;
  action: ServerAction;
}) {
  return (
    <div className="grid gap-5">
      {request.attachments.map((attachment) => (
        <form
          action={action}
          className="border-border bg-surface-1 rounded-2xl border p-5"
          key={attachment.id}
        >
          <input type="hidden" name="requestId" value={request.id} />
          <input type="hidden" name="attachmentId" value={attachment.id} />
          <input
            type="hidden"
            name="expectedChildVersion"
            value={attachment.concurrencyVersion}
          />
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="font-bold">{attachment.originalFilename}</h2>
              <p className="text-text-muted mt-1 text-sm">
                {attachment.detectedMime} / {attachment.sizeBytes} bytes
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <StatusBadge status={attachment.status} />
                <StatusBadge status={attachment.scanStatus} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button asChild size="sm" variant="secondary">
                <a
                  href={`/api/admin/custom-build/attachments/${attachment.id}`}
                >
                  <Download className="size-4" aria-hidden />
                  Download
                </a>
              </Button>
              <FileWarning className="text-warning size-5" aria-hidden />
            </div>
          </div>
          <SelectField
            name="status"
            label="Review status"
            values={["APPROVED", "REJECTED", "QUARANTINED"]}
            defaultValue={attachment.status}
          />
          <label className={labelClass}>
            Safe review note
            <textarea className={`${fieldClass} min-h-20`} name="reviewNote" />
          </label>
          <Button className="mt-4" type="submit">
            Save attachment review
          </Button>
        </form>
      ))}
      {!request.attachments.length && (
        <Panel title="No attachments">
          Private uploaded files are not public and are never included in review
          packs.
        </Panel>
      )}
    </div>
  );
}

export function CustomBuildQuoteEditor({
  request,
  createAction,
  sendAction,
  voidAction,
}: {
  request: RequestDetail;
  createAction: ServerAction;
  sendAction: ServerAction;
  voidAction: ServerAction;
}) {
  const quote = request.quote;
  const latest = quote?.revisions[0];
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
      <form
        action={createAction}
        className="border-border bg-surface-1 rounded-2xl border p-5"
      >
        <input type="hidden" name="requestId" value={request.id} />
        <input
          type="hidden"
          name="expectedVersion"
          value={request.concurrencyVersion}
        />
        {quote && <input type="hidden" name="quoteId" value={quote.id} />}
        <h2 className="display-type text-3xl">Quote revision</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <TextField
            name="lineDescription"
            label="Line description"
            defaultValue="Custom account build scope"
          />
          <NumberField name="quantity" label="Quantity" defaultValue={1} />
          <NumberField
            name="unitAmountCents"
            label="Unit amount cents"
            defaultValue={latest?.finalTotalCents ?? 25000}
          />
          <NumberField
            name="adjustmentsCents"
            label="Adjustments cents"
            defaultValue={0}
          />
          <TextField
            name="estimatedDeliveryText"
            label="Estimated delivery"
            defaultValue="Confirmed by support before work begins"
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
        </div>
        <label className={`${labelClass} mt-4`}>
          Included work summary
          <textarea
            className={`${fieldClass} min-h-24`}
            name="includedWorkSummary"
            defaultValue="Staff-reviewed custom account build scope."
          />
        </label>
        <label className={`${labelClass} mt-4`}>
          Exclusions
          <textarea
            className={`${fieldClass} min-h-20`}
            name="exclusions"
            defaultValue="No checkout, order, payment or credential handover is included in this quote."
          />
        </label>
        <label className={`${labelClass} mt-4`}>
          Customer-safe terms
          <textarea
            className={`${fieldClass} min-h-24`}
            name="customerSafeTerms"
            defaultValue="Quote acceptance records approval only. It does not create an order or payment."
          />
        </label>
        <label className={`${labelClass} mt-4`}>
          Customer message
          <textarea
            className={`${fieldClass} min-h-20`}
            name="customerMessage"
          />
        </label>
        <label className={`${labelClass} mt-4`}>
          Private internal note
          <textarea
            className={`${fieldClass} min-h-20`}
            name="privateInternalNote"
          />
        </label>
        <Button className="mt-5" type="submit">
          Create revision
        </Button>
      </form>
      <aside className="space-y-5">
        {quote ? (
          <Panel title={quote.publicQuoteNumber}>
            <StatusBadge status={quote.status} />
            <p className="text-text-secondary mt-3 text-sm">
              Current revision #{quote.currentRevisionNumber}
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <form action={sendAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="quoteId" value={quote.id} />
                <input
                  type="hidden"
                  name="expectedQuoteVersion"
                  value={quote.concurrencyVersion}
                />
                <ConfirmSubmitButton confirmation="Send this quote to the secure tracking page?">
                  Send quote
                </ConfirmSubmitButton>
              </form>
              <form action={voidAction}>
                <input type="hidden" name="requestId" value={request.id} />
                <input type="hidden" name="quoteId" value={quote.id} />
                <input
                  type="hidden"
                  name="expectedQuoteVersion"
                  value={quote.concurrencyVersion}
                />
                <ConfirmSubmitButton
                  variant="danger"
                  confirmation="Void this quote?"
                >
                  Void
                </ConfirmSubmitButton>
              </form>
            </div>
          </Panel>
        ) : (
          <Panel title="No quote yet">
            Create a draft quote revision from the reviewed request.
          </Panel>
        )}
      </aside>
    </div>
  );
}

export function CustomBuildRevisionHistory({
  config,
  publishAction,
  discardAction,
  restoreAction,
}: {
  config: Config;
  publishAction: ServerAction;
  discardAction: ServerAction;
  restoreAction: ServerAction;
}) {
  return (
    <div className="grid gap-6">
      <Panel title="Publication controls">
        <div className="flex flex-wrap gap-3">
          <form action={publishAction}>
            <input type="hidden" name="serviceConfigId" value={config.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={config.concurrencyVersion}
            />
            <ConfirmSubmitButton confirmation="Publish an immutable custom-build revision?">
              Publish
            </ConfirmSubmitButton>
          </form>
          <form action={discardAction}>
            <input type="hidden" name="serviceConfigId" value={config.id} />
            <input
              type="hidden"
              name="expectedVersion"
              value={config.concurrencyVersion}
            />
            <ConfirmSubmitButton
              variant="secondary"
              confirmation="Discard draft changes and restore latest revision?"
            >
              Discard draft
            </ConfirmSubmitButton>
          </form>
        </div>
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
            {config.revisions.map((revision) => (
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
                    <input
                      type="hidden"
                      name="serviceConfigId"
                      value={config.id}
                    />
                    <input
                      type="hidden"
                      name="revisionId"
                      value={revision.id}
                    />
                    <input
                      type="hidden"
                      name="expectedVersion"
                      value={config.concurrencyVersion}
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
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SkillRuleForm({
  ruleSetId,
  rule,
  action,
}: {
  ruleSetId: string;
  rule?: Config["ruleSets"][number]["skillRules"][number];
  action: ServerAction;
}) {
  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <input type="hidden" name="ruleSetId" value={ruleSetId} />
      {rule && (
        <>
          <input type="hidden" name="ruleId" value={rule.id} />
          <input
            type="hidden"
            name="expectedChildVersion"
            value={rule.concurrencyVersion}
          />
        </>
      )}
      <SelectField
        name="skillKey"
        label="Skill"
        values={Object.keys(customBuildSkillLabels)}
        defaultValue={rule?.skillKey ?? "ATTACK"}
      />
      <SelectField
        name="pricingMode"
        label="Pricing mode"
        values={customBuildPricingModes}
        defaultValue={rule?.pricingMode ?? "PER_XP"}
      />
      <GameModeSelect defaultValue={rule?.gameMode ?? ""} />
      <NumberField
        name="centsPerMillionXp"
        label="Cents per million XP"
        defaultValue={rule?.centsPerMillionXp ?? ""}
      />
      <NumberField
        name="fixedPriceCents"
        label="Fixed cents"
        defaultValue={rule?.fixedPriceCents ?? ""}
      />
      <NumberField
        name="minimumPriceCents"
        label="Minimum cents"
        defaultValue={rule?.minimumPriceCents ?? 0}
      />
      <NumberField
        name="minimumLevel"
        label="Min level"
        defaultValue={rule?.minimumLevel ?? ""}
      />
      <NumberField
        name="maximumLevel"
        label="Max level"
        defaultValue={rule?.maximumLevel ?? ""}
      />
      <NumberField
        name="minimumXp"
        label="Min XP"
        defaultValue={rule?.minimumXp?.toString() ?? ""}
      />
      <NumberField
        name="maximumXp"
        label="Max XP"
        defaultValue={rule?.maximumXp?.toString() ?? ""}
      />
      <NumberField
        name="levelBandStart"
        label="Band start"
        defaultValue={rule?.levelBandStart ?? ""}
      />
      <NumberField
        name="levelBandEnd"
        label="Band end"
        defaultValue={rule?.levelBandEnd ?? ""}
      />
      <BooleanToggles
        values={[
          ["enabled", "Enabled", rule?.enabled ?? true],
          [
            "manualReviewOnly",
            "Manual review only",
            rule?.manualReviewOnly ?? false,
          ],
          [
            "needsClientReview",
            "Needs client review",
            rule?.needsClientReview ?? true,
          ],
        ]}
      />
      <Button className="w-fit" type="submit">
        Save skill rule
      </Button>
    </form>
  );
}

function ObjectiveForm({
  configId,
  objective,
  action,
}: {
  configId: string;
  objective?: Config["objectives"][number];
  action: ServerAction;
}) {
  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <input type="hidden" name="customBuildServiceId" value={configId} />
      {objective && (
        <>
          <input type="hidden" name="objectiveId" value={objective.id} />
          <input
            type="hidden"
            name="expectedChildVersion"
            value={objective.concurrencyVersion}
          />
        </>
      )}
      <SelectField
        name="objectiveType"
        label="Objective type"
        values={customBuildObjectiveTypes}
        defaultValue={objective?.objectiveType ?? "QUEST"}
      />
      <TextField
        name="objectiveKey"
        label="Objective key"
        defaultValue={objective?.objectiveKey ?? ""}
      />
      <TextField
        name="publicName"
        label="Public name"
        defaultValue={objective?.publicName ?? ""}
      />
      <TextField
        name="objectiveGroup"
        label="Group"
        defaultValue={objective?.objectiveGroup ?? ""}
        required={false}
      />
      <TextField
        name="difficultyTier"
        label="Tier"
        defaultValue={objective?.difficultyTier ?? ""}
        required={false}
      />
      <GameModeSelect defaultValue={objective?.gameMode ?? ""} />
      <NumberField
        name="sortOrder"
        label="Sort order"
        defaultValue={objective?.sortOrder ?? 10}
      />
      <label className={`${labelClass} md:col-span-2`}>
        Public description
        <textarea
          className={`${fieldClass} min-h-24`}
          name="publicDescription"
          defaultValue={objective?.publicDescription ?? ""}
        />
      </label>
      <label className={`${labelClass} md:col-span-2`}>
        Prerequisite text
        <textarea
          className={`${fieldClass} min-h-20`}
          name="prerequisiteText"
          defaultValue={objective?.prerequisiteText ?? ""}
        />
      </label>
      <BooleanToggles
        values={[
          ["enabled", "Enabled", objective?.enabled ?? true],
          [
            "needsClientReview",
            "Needs client review",
            objective?.needsClientReview ?? true,
          ],
        ]}
      />
      <Button className="w-fit" type="submit">
        Save objective
      </Button>
    </form>
  );
}

function ObjectiveRuleForm({
  ruleSetId,
  objectives,
  rule,
  action,
}: {
  ruleSetId: string;
  objectives: Config["objectives"];
  rule?: Config["ruleSets"][number]["objectiveRules"][number];
  action: ServerAction;
}) {
  return (
    <form action={action} className="mt-5 grid gap-4 md:grid-cols-2">
      <input type="hidden" name="ruleSetId" value={ruleSetId} />
      {rule && (
        <>
          <input type="hidden" name="ruleId" value={rule.id} />
          <input
            type="hidden"
            name="expectedChildVersion"
            value={rule.concurrencyVersion}
          />
        </>
      )}
      <label className={labelClass}>
        Objective
        <select
          className={fieldClass}
          name="objectiveId"
          defaultValue={rule?.objectiveId ?? objectives[0]?.id}
        >
          {objectives.map((objective) => (
            <option key={objective.id} value={objective.id}>
              {objective.publicName}
            </option>
          ))}
        </select>
      </label>
      <SelectField
        name="pricingMode"
        label="Pricing mode"
        values={customBuildPricingModes}
        defaultValue={rule?.pricingMode ?? "FIXED_ADDITION"}
      />
      <GameModeSelect defaultValue={rule?.gameMode ?? ""} />
      <NumberField
        name="fixedPriceCents"
        label="Fixed cents"
        defaultValue={rule?.fixedPriceCents ?? ""}
      />
      <NumberField
        name="percentBps"
        label="Percent bps"
        defaultValue={rule?.percentBps ?? ""}
      />
      <BooleanToggles
        values={[
          ["enabled", "Enabled", rule?.enabled ?? true],
          [
            "manualReviewOnly",
            "Manual review only",
            rule?.manualReviewOnly ?? false,
          ],
          [
            "needsClientReview",
            "Needs client review",
            rule?.needsClientReview ?? true,
          ],
        ]}
      />
      <Button className="w-fit" type="submit">
        Save objective rule
      </Button>
    </form>
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

function SummaryStat({
  label,
  value,
  sensitive = false,
}: {
  label: string;
  value: string;
  sensitive?: boolean;
}) {
  return (
    <div className="border-border bg-surface-1 rounded-2xl border p-5">
      <p className="text-text-muted text-sm font-semibold">{label}</p>
      <p
        className={`display-type mt-2 text-2xl ${sensitive ? "screenshot-sensitive" : ""}`}
      >
        {value}
      </p>
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
  defaultValue: string | number;
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
}: {
  name: string;
  label: string;
  values: readonly T[] | string[];
  defaultValue: T | string;
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

function GameModeSelect({ defaultValue }: { defaultValue: string }) {
  return (
    <label className={labelClass}>
      Game mode scope
      <select
        className={fieldClass}
        name="gameMode"
        defaultValue={defaultValue}
      >
        <option value="">All modes</option>
        {catalogueGameModes.map((mode) => (
          <option key={mode} value={mode}>
            {customBuildGameModeLabels[mode]}
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

export function CustomBuildAdminHero({
  title,
  description,
  taskBadge = "Task 011",
  icon = "settings",
}: {
  title: string;
  description: string;
  taskBadge?: string;
  icon?: "settings" | "requests" | "quote" | "history";
}) {
  const Icon =
    icon === "requests"
      ? ListChecks
      : icon === "quote"
        ? Send
        : icon === "history"
          ? History
          : Settings;
  return (
    <>
      <Badge variant="success">{taskBadge}</Badge>
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
      <CustomBuildAdminTabs />
    </>
  );
}

export function QuoteRevisionList({ request }: { request: RequestDetail }) {
  const quote = request.quote;
  if (!quote) return null;
  return (
    <div className="border-border bg-surface-1 overflow-x-auto rounded-2xl border">
      <table className="w-full min-w-3xl text-left text-sm">
        <thead className="bg-surface-2 text-text-muted">
          <tr>
            <th className="p-4">Revision</th>
            <th className="p-4">Total</th>
            <th className="p-4">Sent</th>
            <th className="p-4">Creator</th>
          </tr>
        </thead>
        <tbody className="divide-border divide-y">
          {quote.revisions.map((revision) => (
            <tr key={revision.id}>
              <td className="p-4 font-bold">#{revision.revisionNumber}</td>
              <td className="p-4">{formatCents(revision.finalTotalCents)}</td>
              <td className="text-text-secondary p-4">
                {revision.sentAt?.toLocaleString() ?? "Draft"}
              </td>
              <td className="text-text-secondary p-4">
                {revision.createdBy?.name ??
                  revision.createdBy?.email ??
                  "system"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { customBuildQuoteStatusLabels };
