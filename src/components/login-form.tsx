"use client";

import { LockKeyhole, Mail } from "lucide-react";
import { useActionState } from "react";

import { loginAction, type LoginState } from "@/app/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: LoginState = {};

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(loginAction, initialState);

  return (
    <form action={action} className="mt-7 space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error ? (
        <Alert data-testid="login-error" variant="danger">
          {state.error}
        </Alert>
      ) : null}
      <div className="space-y-2">
        <label
          htmlFor="email"
          className="text-text-primary text-sm font-semibold tracking-[0.01em]"
        >
          Email address
        </label>
        <div className="relative">
          <Mail
            aria-hidden="true"
            className="text-text-muted pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
          />
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="bg-background/55 pl-11"
            placeholder="admin@example.com"
          />
        </div>
      </div>
      <div className="space-y-2">
        <label
          htmlFor="password"
          className="text-text-primary text-sm font-semibold tracking-[0.01em]"
        >
          Password
        </label>
        <div className="relative">
          <LockKeyhole
            aria-hidden="true"
            className="text-text-muted pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2"
          />
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="bg-background/55 pl-11"
            placeholder="Enter your password"
          />
        </div>
      </div>
      <Button
        type="submit"
        size="lg"
        className="mt-1 w-full shadow-[0_12px_30px_rgb(166_215_25_/_0.12)]"
        disabled={pending}
      >
        {pending ? "Signing in…" : "Sign in securely"}
      </Button>
    </form>
  );
}
