import { BadgeCheck, ShieldCheck } from "lucide-react";
import Link from "next/link";

import { BrandLogo } from "@/components/brand-logo";
import { LoginForm } from "@/components/login-form";

export const metadata = { title: "Secure sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next = "/admin" } = await searchParams;

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.08fr_0.92fr]">
      <section className="grid-pattern border-border relative hidden overflow-hidden border-r lg:flex lg:flex-col lg:justify-between lg:p-12">
        <BrandLogo priority className="w-52" />
        <div className="relative z-10 max-w-xl">
          <span className="text-primary text-sm font-bold tracking-[0.22em] uppercase">
            Operations portal
          </span>
          <h1 className="display-type mt-5 text-6xl leading-[0.94] font-black uppercase">
            Built for secure, focused service.
          </h1>
          <p className="text-text-secondary mt-6 max-w-lg text-lg leading-8">
            Capability-based access keeps staff inside the exact tools they
            need—nothing more.
          </p>
        </div>
        <div className="text-text-secondary flex gap-8 text-sm">
          <span className="flex items-center gap-2">
            <ShieldCheck className="text-primary size-4" />
            Database sessions
          </span>
          <span className="flex items-center gap-2">
            <BadgeCheck className="text-primary size-4" />
            Argon2id secured
          </span>
        </div>
      </section>
      <section className="flex min-h-screen items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-md">
          <Link href="/" className="mb-12 inline-block lg:hidden">
            <BrandLogo priority className="w-44" />
          </Link>
          <div className="border-border bg-surface-1/90 rounded-3xl border p-6 shadow-2xl shadow-black/20 backdrop-blur sm:p-9">
            <p className="text-primary text-sm font-bold tracking-[0.2em] uppercase">
              Welcome back
            </p>
            <h2 className="display-type mt-3 text-4xl font-black uppercase">
              Sign in to continue
            </h2>
            <p className="text-text-secondary mt-3 text-sm leading-6">
              Use the local Super Admin credentials supplied through your
              environment.
            </p>
            <LoginForm next={next} />
          </div>
          <p className="text-text-muted mt-6 text-center text-xs leading-5">
            Protected by secure, HTTP-only database sessions. No default
            password is included.
          </p>
        </div>
      </section>
    </div>
  );
}
