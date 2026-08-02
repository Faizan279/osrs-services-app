"use client";

import {
  Bell,
  CheckCircle2,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ApiState = { kind: "idle" | "success" | "error"; message: string };

const idleState: ApiState = { kind: "idle", message: "" };

async function postJson(path: string, body: unknown, method = "POST") {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return (await response.json()) as { ok: boolean; message?: string };
}

function StateMessage({ state }: { state: ApiState }) {
  if (state.kind === "idle") return null;
  return (
    <p
      role={state.kind === "error" ? "alert" : "status"}
      className={
        state.kind === "error"
          ? "border-danger/30 bg-danger/10 text-text-primary rounded-xl border p-3 text-sm"
          : "border-primary/30 bg-primary/10 text-text-primary rounded-xl border p-3 text-sm"
      }
    >
      {state.message}
    </p>
  );
}

function nextDestination(value: string) {
  return value.startsWith("/") && !value.startsWith("//") ? value : "/account";
}

export function CustomerLoginForm({
  next,
  disabled,
}: {
  next: string;
  disabled: boolean;
}) {
  const [state, setState] = useState<ApiState>(idleState);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setState(idleState);
    startTransition(async () => {
      const result = await postJson("/api/account/login", {
        email: formData.get("email"),
        password: formData.get("password"),
      });
      if (!result.ok) {
        setState({
          kind: "error",
          message: result.message ?? "Email or password is incorrect.",
        });
        return;
      }
      window.location.assign(nextDestination(next));
    });
  }

  return (
    <form action={submit} className="grid gap-4" noValidate>
      <StateMessage state={state} />
      <label className="grid gap-2 text-sm font-semibold">
        Email address
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={disabled || pending}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Password
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={disabled || pending}
        />
      </label>
      <Button type="submit" disabled={disabled || pending}>
        <LogIn className="size-4" aria-hidden="true" />
        {pending ? "Signing in" : "Sign in"}
      </Button>
    </form>
  );
}

export function CustomerRegisterForm({
  disabled,
  trackingToken,
}: {
  disabled: boolean;
  trackingToken?: string | null;
}) {
  const [state, setState] = useState<ApiState>(idleState);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setState(idleState);
    startTransition(async () => {
      const result = await postJson("/api/account/register", {
        displayName: formData.get("displayName"),
        email: formData.get("email"),
        password: formData.get("password"),
        passwordConfirmation: formData.get("passwordConfirmation"),
        discordUsername: formData.get("discordUsername"),
        defaultRsn: formData.get("defaultRsn"),
        termsAccepted: formData.get("termsAccepted") === "on",
        privacyAccepted: formData.get("privacyAccepted") === "on",
        orderTrackingToken: trackingToken ?? null,
      });
      if (!result.ok) {
        setState({
          kind: "error",
          message: result.message ?? "Registration could not be completed.",
        });
        return;
      }
      window.location.assign("/account");
    });
  }

  return (
    <form action={submit} className="grid gap-4" noValidate>
      <StateMessage state={state} />
      <label className="grid gap-2 text-sm font-semibold">
        Display name
        <Input
          name="displayName"
          autoComplete="name"
          required
          maxLength={120}
          disabled={disabled || pending}
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Email address
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={191}
          disabled={disabled || pending}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Password
          <Input
            name="password"
            type="password"
            autoComplete="new-password"
            required
            disabled={disabled || pending}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Confirm password
          <Input
            name="passwordConfirmation"
            type="password"
            autoComplete="new-password"
            required
            disabled={disabled || pending}
          />
        </label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Discord username
          <Input
            name="discordUsername"
            maxLength={80}
            disabled={disabled || pending}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Default RSN
          <Input
            name="defaultRsn"
            maxLength={12}
            disabled={disabled || pending}
          />
        </label>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input
          name="termsAccepted"
          type="checkbox"
          required
          disabled={disabled || pending}
        />
        <span>I accept the current terms version.</span>
      </label>
      <label className="flex items-start gap-3 text-sm">
        <input
          name="privacyAccepted"
          type="checkbox"
          required
          disabled={disabled || pending}
        />
        <span>I consent to the privacy policy for this account.</span>
      </label>
      <Button type="submit" disabled={disabled || pending}>
        <UserPlus className="size-4" aria-hidden="true" />
        {pending ? "Creating account" : "Create account"}
      </Button>
    </form>
  );
}

export function CustomerRecoveryForm({ disabled }: { disabled: boolean }) {
  const [state, setState] = useState<ApiState>(idleState);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setState(idleState);
    startTransition(async () => {
      const result = await postJson("/api/account/recovery", {
        email: formData.get("email"),
      });
      setState({
        kind: result.ok ? "success" : "error",
        message:
          result.message ??
          "If the account can be recovered, instructions will be prepared.",
      });
    });
  }

  return (
    <form action={submit} className="grid gap-4" noValidate>
      <StateMessage state={state} />
      <label className="grid gap-2 text-sm font-semibold">
        Email address
        <Input
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={disabled || pending}
        />
      </label>
      <Button type="submit" disabled={disabled || pending}>
        <Mail className="size-4" aria-hidden="true" />
        {pending ? "Preparing" : "Request recovery"}
      </Button>
    </form>
  );
}

export function CustomerResetForm({ token }: { token: string }) {
  const [state, setState] = useState<ApiState>(idleState);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setState(idleState);
    startTransition(async () => {
      const result = await postJson("/api/account/reset", {
        token,
        password: formData.get("password"),
        passwordConfirmation: formData.get("passwordConfirmation"),
      });
      setState({
        kind: result.ok ? "success" : "error",
        message: result.ok
          ? "Password was reset. Sign in with the new password."
          : (result.message ?? "Password reset link is invalid."),
      });
    });
  }

  return (
    <form action={submit} className="grid gap-4" noValidate>
      <StateMessage state={state} />
      <label className="grid gap-2 text-sm font-semibold">
        New password
        <Input
          name="password"
          type="password"
          autoComplete="new-password"
          required
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold">
        Confirm new password
        <Input
          name="passwordConfirmation"
          type="password"
          autoComplete="new-password"
          required
        />
      </label>
      <Button type="submit" disabled={pending}>
        <KeyRound className="size-4" aria-hidden="true" />
        {pending ? "Resetting" : "Reset password"}
      </Button>
    </form>
  );
}

export function CustomerLogoutButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/account/logout", { method: "POST" });
          window.location.assign("/account/login");
        })
      }
      disabled={pending}
    >
      <LogOut className="size-4" aria-hidden="true" />
      Sign out
    </Button>
  );
}

export function CustomerProfileForm({
  profile,
}: {
  profile: {
    displayName: string;
    discordUsername: string | null;
    defaultRsn: string | null;
    timezone: string | null;
    locale: string | null;
    concurrencyVersion: number;
  };
}) {
  const [state, setState] = useState<ApiState>(idleState);
  const [version, setVersion] = useState(profile.concurrencyVersion);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setState(idleState);
    startTransition(async () => {
      const response = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: formData.get("displayName"),
          discordUsername: formData.get("discordUsername"),
          defaultRsn: formData.get("defaultRsn"),
          timezone: formData.get("timezone"),
          locale: formData.get("locale"),
          expectedVersion: version,
        }),
      });
      const result = (await response.json()) as {
        ok: boolean;
        message?: string;
        profile?: { concurrencyVersion: number };
      };
      if (result.ok && result.profile)
        setVersion(result.profile.concurrencyVersion);
      setState({
        kind: result.ok ? "success" : "error",
        message: result.ok
          ? "Profile updated."
          : (result.message ?? "Profile was not saved."),
      });
    });
  }

  return (
    <form action={submit} className="grid gap-4" noValidate>
      <StateMessage state={state} />
      <input type="hidden" name="expectedVersion" value={version} />
      <label className="grid gap-2 text-sm font-semibold">
        Display name
        <Input
          name="displayName"
          defaultValue={profile.displayName}
          required
          maxLength={120}
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          Discord username
          <Input
            name="discordUsername"
            defaultValue={profile.discordUsername ?? ""}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Default RSN
          <Input
            name="defaultRsn"
            defaultValue={profile.defaultRsn ?? ""}
            maxLength={12}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Timezone
          <Input name="timezone" defaultValue={profile.timezone ?? ""} />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Locale
          <Input name="locale" defaultValue={profile.locale ?? ""} />
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {pending ? "Saving" : "Save profile"}
      </Button>
    </form>
  );
}

export function CustomerPasswordForm() {
  const [state, setState] = useState<ApiState>(idleState);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setState(idleState);
    startTransition(async () => {
      const result = await postJson("/api/account/password", {
        currentPassword: formData.get("currentPassword"),
        newPassword: formData.get("newPassword"),
        newPasswordConfirmation: formData.get("newPasswordConfirmation"),
      });
      setState({
        kind: result.ok ? "success" : "error",
        message: result.ok
          ? "Password updated and other sessions revoked."
          : (result.message ?? "Password was not changed."),
      });
    });
  }

  return (
    <form action={submit} className="grid gap-4" noValidate>
      <StateMessage state={state} />
      <label className="grid gap-2 text-sm font-semibold">
        Current password
        <Input
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold">
          New password
          <Input
            name="newPassword"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Confirm new password
          <Input
            name="newPasswordConfirmation"
            type="password"
            autoComplete="new-password"
            required
          />
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        <ShieldCheck className="size-4" aria-hidden="true" />
        {pending ? "Updating" : "Change password"}
      </Button>
    </form>
  );
}

export function CustomerClaimOrderForm() {
  const [state, setState] = useState<ApiState>(idleState);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setState(idleState);
    startTransition(async () => {
      const result = await postJson("/api/account/orders/claim", {
        trackingToken: formData.get("trackingToken"),
      });
      setState({
        kind: result.ok ? "success" : "error",
        message: result.ok
          ? "Order claimed."
          : (result.message ?? "Order was not claimed."),
      });
    });
  }

  return (
    <form action={submit} className="grid gap-4" noValidate>
      <StateMessage state={state} />
      <label className="grid gap-2 text-sm font-semibold">
        Secure tracking token
        <Input name="trackingToken" required autoComplete="off" />
      </label>
      <Button type="submit" disabled={pending}>
        <CheckCircle2 className="size-4" aria-hidden="true" />
        {pending ? "Claiming" : "Claim order"}
      </Button>
    </form>
  );
}

export function CustomerSessionRevokeButton({
  sessionId,
}: {
  sessionId: string;
}) {
  const [state, setState] = useState<ApiState>(idleState);
  const [pending, startTransition] = useTransition();
  return (
    <div className="grid gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={() =>
          startTransition(async () => {
            const result = await fetch(`/api/account/sessions/${sessionId}`, {
              method: "DELETE",
            });
            const payload = (await result.json()) as {
              ok: boolean;
              message?: string;
            };
            setState({
              kind: payload.ok ? "success" : "error",
              message: payload.ok
                ? "Session revoked."
                : (payload.message ?? "Session was not revoked."),
            });
          })
        }
        disabled={pending}
      >
        Revoke
      </Button>
      <StateMessage state={state} />
    </div>
  );
}

export function CustomerNotificationReadButton({
  notificationId,
}: {
  notificationId: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() =>
        startTransition(async () => {
          await fetch(`/api/account/notifications/${notificationId}/read`, {
            method: "POST",
          });
          window.location.reload();
        })
      }
      disabled={pending}
    >
      <Bell className="size-4" aria-hidden="true" />
      Mark read
    </Button>
  );
}

export function MarkAllNotificationsReadButton() {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={() =>
        startTransition(async () => {
          await fetch("/api/account/notifications", { method: "PATCH" });
          window.location.reload();
        })
      }
      disabled={pending}
    >
      <Bell className="size-4" aria-hidden="true" />
      Mark all read
    </Button>
  );
}

export function PreferenceToggleForm({
  preference,
}: {
  preference: {
    type: string;
    inAppEnabled: boolean;
    emailEnabled: boolean;
    marketingConsent: boolean;
    concurrencyVersion: number;
  };
}) {
  const [state, setState] = useState<ApiState>(idleState);
  const [pending, startTransition] = useTransition();
  const label = useMemo(
    () => preference.type.toLowerCase().replace(/_/g, " "),
    [preference.type],
  );

  function submit(formData: FormData) {
    setState(idleState);
    startTransition(async () => {
      const result = await postJson(
        "/api/account/notification-preferences",
        {
          type: preference.type,
          inAppEnabled: formData.get("inAppEnabled") === "on",
          emailEnabled: formData.get("emailEnabled") === "on",
          marketingConsent: formData.get("marketingConsent") === "on",
          expectedVersion: preference.concurrencyVersion,
        },
        "PATCH",
      );
      setState({
        kind: result.ok ? "success" : "error",
        message: result.ok
          ? "Preference saved."
          : (result.message ?? "Preference was not saved."),
      });
    });
  }

  return (
    <form
      action={submit}
      className="border-border bg-background/30 grid gap-3 rounded-xl border p-4"
    >
      <p className="font-semibold capitalize">{label}</p>
      <label className="flex items-center gap-3 text-sm">
        <input
          name="inAppEnabled"
          type="checkbox"
          defaultChecked={preference.inAppEnabled}
        />
        In-app
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          name="emailEnabled"
          type="checkbox"
          defaultChecked={preference.emailEnabled}
        />
        Email when a provider is configured
      </label>
      <label className="flex items-center gap-3 text-sm">
        <input
          name="marketingConsent"
          type="checkbox"
          defaultChecked={preference.marketingConsent}
        />
        Marketing consent
      </label>
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
      <StateMessage state={state} />
    </form>
  );
}
