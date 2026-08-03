"use client";

import {
  Archive,
  CheckCircle2,
  ExternalLink,
  FileText,
  MessageSquare,
  NotebookPen,
  RefreshCw,
  Send,
  ShieldAlert,
  UserCheck,
  UserMinus,
} from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type AdminMessage = {
  id: string;
  sequence: number;
  participantType: "GUEST" | "CUSTOMER" | "STAFF" | "SYSTEM";
  messageType: string;
  body: string;
  redactedAt: string | null;
  redactionReason: string | null;
  concurrencyVersion: number;
  createdAt: string;
};

export type AdminConversation = {
  id: string;
  reference: string;
  status: string;
  priority: string;
  assignedStaffId: string | null;
  concurrencyVersion: number;
  createdAt: string;
  updatedAt: string;
  messages: AdminMessage[];
  internalNotes?: Array<{
    id: string;
    staffUserId: string;
    body: string;
    createdAt: string;
  }>;
  orderLinks?: Array<{
    id: string;
    source: string;
    order: { orderNumber: string; status?: string; paymentStatus?: string };
    createdAt: string;
  }>;
  events?: Array<{
    id: string;
    eventType: string;
    reasonCode: string | null;
    createdAt: string;
  }>;
};

export type ChatSettings = {
  availabilityMode: "OFFLINE" | "ONLINE" | "MAINTENANCE";
  publicLauncherEnabled: boolean;
  offlineIntakeEnabled: boolean;
  publicOnlineMessage: string;
  publicOfflineMessage: string;
  publicMaintenanceMessage: string;
  maximumMessageLength: number;
  maximumOpenConversationsPerGuest: number;
  maximumOpenConversationsPerCustomer: number;
  pollingFallbackIntervalSeconds: number;
  realtimeExpected: boolean;
  needsClientReview: boolean;
  concurrencyVersion: number;
};

type ApiResult<T> = T & { ok: boolean; message?: string };

async function requestJson<T>(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  return (await response.json()) as ApiResult<T>;
}

function idempotencyKey(prefix: string) {
  const random = crypto.getRandomValues(new Uint32Array(4));
  return `${prefix}-${Array.from(random).join("-")}`;
}

function label(value: string) {
  return value.toLowerCase().replace(/_/g, " ");
}

function actorLabel(type: string) {
  if (type === "STAFF") return "Support";
  if (type === "CUSTOMER") return "Customer";
  if (type === "GUEST") return "Guest";
  return "System";
}

export function ChatSettingsForm({ settings }: { settings: ChatSettings }) {
  const [version, setVersion] = useState(settings.concurrencyVersion);
  const [state, setState] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setState("");
    startTransition(async () => {
      const result = await requestJson<{ settings: ChatSettings }>(
        "/api/admin/chat/settings",
        {
          method: "PATCH",
          body: JSON.stringify({
            availabilityMode: formData.get("availabilityMode"),
            publicLauncherEnabled:
              formData.get("publicLauncherEnabled") === "on",
            offlineIntakeEnabled: formData.get("offlineIntakeEnabled") === "on",
            publicOnlineMessage: formData.get("publicOnlineMessage"),
            publicOfflineMessage: formData.get("publicOfflineMessage"),
            publicMaintenanceMessage: formData.get("publicMaintenanceMessage"),
            maximumMessageLength: Number(formData.get("maximumMessageLength")),
            maximumOpenConversationsPerGuest: Number(
              formData.get("maximumOpenConversationsPerGuest"),
            ),
            maximumOpenConversationsPerCustomer: Number(
              formData.get("maximumOpenConversationsPerCustomer"),
            ),
            pollingFallbackIntervalSeconds: Number(
              formData.get("pollingFallbackIntervalSeconds"),
            ),
            realtimeExpected: formData.get("realtimeExpected") === "on",
            needsClientReview: formData.get("needsClientReview") === "on",
            expectedVersion: version,
          }),
        },
      );
      if (result.ok) {
        setVersion(result.settings.concurrencyVersion);
        setState("Settings saved.");
      } else {
        setState(result.message ?? "Settings were not saved.");
      }
    });
  }

  return (
    <form action={submit} className="grid gap-4" noValidate>
      {state ? (
        <p
          role="status"
          className="border-border bg-background/35 rounded-xl border p-3 text-sm"
        >
          {state}
        </p>
      ) : null}
      <label className="grid gap-2 text-sm font-semibold">
        Availability
        <select
          name="availabilityMode"
          defaultValue={settings.availabilityMode}
          className="border-border bg-background/50 h-12 rounded-xl border px-3"
        >
          <option value="OFFLINE">Offline</option>
          <option value="ONLINE">Online</option>
          <option value="MAINTENANCE">Maintenance</option>
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex items-center gap-3 text-sm">
          <input
            name="publicLauncherEnabled"
            type="checkbox"
            defaultChecked={settings.publicLauncherEnabled}
          />
          Public launcher enabled
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            name="offlineIntakeEnabled"
            type="checkbox"
            defaultChecked={settings.offlineIntakeEnabled}
          />
          Offline intake enabled
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            name="realtimeExpected"
            type="checkbox"
            defaultChecked={settings.realtimeExpected}
          />
          Realtime expected
        </label>
        <label className="flex items-center gap-3 text-sm">
          <input
            name="needsClientReview"
            type="checkbox"
            defaultChecked={settings.needsClientReview}
          />
          Needs client review
        </label>
      </div>
      <div className="grid gap-3">
        <label className="grid gap-2 text-sm font-semibold">
          Online message
          <Input
            name="publicOnlineMessage"
            defaultValue={settings.publicOnlineMessage}
            maxLength={500}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Offline message
          <Input
            name="publicOfflineMessage"
            defaultValue={settings.publicOfflineMessage}
            maxLength={500}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Maintenance message
          <Input
            name="publicMaintenanceMessage"
            defaultValue={settings.publicMaintenanceMessage}
            maxLength={500}
          />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <label className="grid gap-2 text-sm font-semibold">
          Message length
          <Input
            name="maximumMessageLength"
            type="number"
            defaultValue={settings.maximumMessageLength}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Guest max open
          <Input
            name="maximumOpenConversationsPerGuest"
            type="number"
            defaultValue={settings.maximumOpenConversationsPerGuest}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Customer max open
          <Input
            name="maximumOpenConversationsPerCustomer"
            type="number"
            defaultValue={settings.maximumOpenConversationsPerCustomer}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Poll seconds
          <Input
            name="pollingFallbackIntervalSeconds"
            type="number"
            defaultValue={settings.pollingFallbackIntervalSeconds}
          />
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        <CheckCircle2 className="size-4" aria-hidden="true" />
        Save settings
      </Button>
    </form>
  );
}

export function ChatConversationList({
  conversations,
}: {
  conversations: AdminConversation[];
}) {
  return (
    <div className="grid gap-3">
      {conversations.length === 0 ? (
        <div className="border-border bg-surface-1 rounded-xl border p-6">
          <p className="font-semibold">No conversations in this view.</p>
          <p className="text-text-muted mt-2 text-sm">
            Chat stays empty until the feature flags and availability settings
            are deliberately enabled.
          </p>
        </div>
      ) : (
        conversations.map((conversation) => (
          <article
            key={conversation.id}
            className="border-border bg-surface-1 rounded-xl border p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <Badge variant="info">{label(conversation.status)}</Badge>
                <h3 className="mt-2 font-bold">{conversation.reference}</h3>
                <p className="text-text-muted mt-1 text-sm">
                  {conversation.messages[0]?.body ?? "No public messages"}
                </p>
              </div>
              <Button asChild variant="secondary" size="sm">
                <Link href={`/admin/chat/${conversation.id}`}>
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Open
                </Link>
              </Button>
            </div>
          </article>
        ))
      )}
    </div>
  );
}

export function ChatAdminConversationPanel({
  initialConversation,
  staffUserId,
}: {
  initialConversation: AdminConversation;
  staffUserId: string;
}) {
  const [conversation, setConversation] =
    useState<AdminConversation>(initialConversation);
  const [state, setState] = useState("");
  const [pending, startTransition] = useTransition();

  function refresh() {
    startTransition(async () => {
      const result = await requestJson<{ conversation: AdminConversation }>(
        `/api/admin/chat/conversations/${conversation.id}`,
      );
      if (result.ok) setConversation(result.conversation);
    });
  }

  function send(formData: FormData) {
    setState("");
    startTransition(async () => {
      const result = await requestJson<{ conversation: AdminConversation }>(
        `/api/admin/chat/conversations/${conversation.id}/messages`,
        {
          method: "POST",
          body: JSON.stringify({
            body: formData.get("body"),
            idempotencyKey: idempotencyKey("admin-chat-message"),
          }),
        },
      );
      if (result.ok) setConversation(result.conversation);
      else setState(result.message ?? "Message was not sent.");
    });
  }

  function note(formData: FormData) {
    setState("");
    startTransition(async () => {
      const result = await requestJson<{ note: unknown }>(
        `/api/admin/chat/conversations/${conversation.id}/internal-notes`,
        {
          method: "POST",
          body: JSON.stringify({
            body: formData.get("body"),
            idempotencyKey: idempotencyKey("admin-chat-note"),
          }),
        },
      );
      if (result.ok) refresh();
      else setState(result.message ?? "Internal note was not saved.");
    });
  }

  function assign(assigneeId: string | null) {
    setState("");
    startTransition(async () => {
      const result = await requestJson<{ conversation: AdminConversation }>(
        `/api/admin/chat/conversations/${conversation.id}/assignment`,
        {
          method: "PATCH",
          body: JSON.stringify({
            assigneeId,
            expectedVersion: conversation.concurrencyVersion,
          }),
        },
      );
      if (result.ok) setConversation(result.conversation);
      else setState(result.message ?? "Assignment was not saved.");
    });
  }

  function status(nextStatus: string) {
    setState("");
    startTransition(async () => {
      const result = await requestJson<{ conversation: AdminConversation }>(
        `/api/admin/chat/conversations/${conversation.id}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            nextStatus,
            expectedVersion: conversation.concurrencyVersion,
            reasonCode: nextStatus,
          }),
        },
      );
      if (result.ok) setConversation(result.conversation);
      else setState(result.message ?? "Status was not saved.");
    });
  }

  function redact(message: AdminMessage) {
    setState("");
    startTransition(async () => {
      const result = await requestJson<{ conversation: AdminConversation }>(
        `/api/admin/chat/conversations/${conversation.id}/messages/${message.id}/redact`,
        {
          method: "POST",
          body: JSON.stringify({
            expectedVersion: message.concurrencyVersion,
            reason: "STAFF_SAFETY_REVIEW",
          }),
        },
      );
      if (result.ok) setConversation(result.conversation);
      else setState(result.message ?? "Message was not redacted.");
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_21rem]">
      <section className="grid gap-4">
        <div className="border-border bg-surface-1 rounded-xl border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <Badge variant="info">{label(conversation.status)}</Badge>
              <h1 className="display-type mt-3 text-3xl font-black uppercase">
                {conversation.reference}
              </h1>
              <p className="text-text-muted mt-1 text-sm">
                Priority {label(conversation.priority)}
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              onClick={refresh}
              disabled={pending}
            >
              <RefreshCw className="size-4" aria-hidden="true" />
              Refresh
            </Button>
          </div>
          {state ? (
            <p
              role="alert"
              className="border-danger/30 bg-danger/10 mt-4 rounded-xl border p-3 text-sm"
            >
              {state}
            </p>
          ) : null}
        </div>

        <div className="border-border bg-background/35 grid max-h-[34rem] gap-3 overflow-y-auto rounded-xl border p-4">
          {conversation.messages.map((message) => (
            <article
              key={message.id}
              className={cn(
                "rounded-xl border p-3 text-sm",
                message.participantType === "STAFF"
                  ? "border-primary/30 bg-primary/10"
                  : message.messageType === "SAFETY_REDACTION"
                    ? "border-warning/40 bg-warning/10"
                    : "border-border bg-surface-2",
              )}
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-text-muted text-xs font-bold uppercase">
                  {actorLabel(message.participantType)} / #{message.sequence}
                </p>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => redact(message)}
                  disabled={Boolean(message.redactedAt) || pending}
                >
                  <ShieldAlert className="size-4" aria-hidden="true" />
                  Redact
                </Button>
              </div>
              <p className="mt-2 whitespace-pre-wrap">
                {message.redactedAt
                  ? "[Message removed for safety]"
                  : message.body}
              </p>
            </article>
          ))}
        </div>

        <form
          action={send}
          className="border-border bg-surface-1 grid gap-3 rounded-xl border p-4"
        >
          <label className="grid gap-2 text-sm font-semibold">
            Staff reply
            <textarea
              name="body"
              required
              className="border-border bg-background/50 focus:ring-primary min-h-28 rounded-xl border p-3 text-sm outline-none focus:ring-2"
            />
          </label>
          <Button type="submit" disabled={pending}>
            <Send className="size-4" aria-hidden="true" />
            Send reply
          </Button>
        </form>
      </section>

      <aside className="grid gap-4 self-start">
        <section className="border-border bg-surface-1 rounded-xl border p-4">
          <h2 className="font-bold">Assignment</h2>
          <p className="text-text-muted mt-1 text-sm">
            {conversation.assignedStaffId
              ? conversation.assignedStaffId === staffUserId
                ? "Assigned to you"
                : "Assigned to another staff member"
              : "Unassigned"}
          </p>
          <div className="mt-4 grid gap-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => assign(staffUserId)}
            >
              <UserCheck className="size-4" aria-hidden="true" />
              Assign to me
            </Button>
            <Button type="button" variant="ghost" onClick={() => assign(null)}>
              <UserMinus className="size-4" aria-hidden="true" />
              Unassign
            </Button>
          </div>
        </section>

        <section className="border-border bg-surface-1 rounded-xl border p-4">
          <h2 className="font-bold">Status</h2>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {[
              "WAITING_FOR_SUPPORT",
              "WAITING_FOR_CUSTOMER",
              "RESOLVED",
              "CLOSED",
              "SPAM",
              "ARCHIVED",
            ].map((nextStatus) => (
              <Button
                key={nextStatus}
                type="button"
                size="sm"
                variant={nextStatus === "ARCHIVED" ? "danger" : "secondary"}
                onClick={() => status(nextStatus)}
              >
                {nextStatus === "ARCHIVED" ? (
                  <Archive className="size-4" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="size-4" aria-hidden="true" />
                )}
                {label(nextStatus)}
              </Button>
            ))}
          </div>
        </section>

        <section className="border-border bg-surface-1 rounded-xl border p-4">
          <h2 className="font-bold">Order links</h2>
          <div className="mt-3 grid gap-2">
            {(conversation.orderLinks ?? []).length === 0 ? (
              <p className="text-text-muted text-sm">No linked order.</p>
            ) : (
              conversation.orderLinks?.map((link) => (
                <div
                  key={link.id}
                  className="border-border bg-background/35 rounded-lg border p-3 text-sm"
                >
                  <p className="font-semibold">{link.order.orderNumber}</p>
                  <p className="text-text-muted capitalize">
                    {label(link.source)}
                  </p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="border-border bg-surface-1 rounded-xl border p-4">
          <h2 className="flex items-center gap-2 font-bold">
            <NotebookPen className="size-4" aria-hidden="true" />
            Internal notes
          </h2>
          <div className="mt-3 grid gap-2">
            {(conversation.internalNotes ?? []).map((note) => (
              <article
                key={note.id}
                className="border-gold/30 bg-gold-muted/20 rounded-lg border p-3 text-sm"
              >
                <p className="whitespace-pre-wrap">{note.body}</p>
              </article>
            ))}
          </div>
          <form action={note} className="mt-4 grid gap-2">
            <label className="sr-only" htmlFor="internal-note">
              Internal note
            </label>
            <textarea
              id="internal-note"
              name="body"
              required
              className="border-border bg-background/50 focus:ring-primary min-h-24 rounded-xl border p-3 text-sm outline-none focus:ring-2"
            />
            <Button type="submit" size="sm" disabled={pending}>
              <FileText className="size-4" aria-hidden="true" />
              Add note
            </Button>
          </form>
        </section>

        <section className="border-border bg-surface-1 rounded-xl border p-4">
          <h2 className="flex items-center gap-2 font-bold">
            <MessageSquare className="size-4" aria-hidden="true" />
            Event history
          </h2>
          <div className="mt-3 grid gap-2">
            {(conversation.events ?? []).slice(-8).map((event) => (
              <div
                key={event.id}
                className="text-text-muted text-xs capitalize"
              >
                {label(event.eventType)}
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
