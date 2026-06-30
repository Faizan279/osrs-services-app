import { BadgeCheck, LockKeyhole, ShieldCheck, Sparkles } from "lucide-react";
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
    <div className="login-atmosphere min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-[90rem] flex-col px-5 sm:px-8 lg:px-12">
        <header className="flex h-24 shrink-0 items-center justify-between border-b border-white/5">
          <Link href="/" aria-label="OSRS Services home">
            <BrandLogo priority className="w-44 sm:w-48" />
          </Link>
          <span className="border-border-strong/70 bg-surface-2/70 text-text-secondary inline-flex items-center gap-2 rounded-full border px-3 py-2 text-[0.68rem] font-bold tracking-[0.12em] uppercase backdrop-blur">
            <ShieldCheck className="text-primary size-3.5" aria-hidden="true" />
            Private staff access
          </span>
        </header>

        <main className="grid flex-1 items-center gap-12 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(25rem,30rem)] lg:py-14 xl:gap-24">
          <section className="hidden max-w-2xl lg:block">
            <p className="ornament-rule text-gold kicker-type">Staff command</p>
            <h1 className="display-type mt-7 max-w-xl text-5xl leading-[1.03] text-balance text-white xl:text-[3.55rem]">
              A private gateway for every trusted operation.
            </h1>
            <p className="text-text-secondary mt-6 max-w-xl text-lg leading-8">
              Secure access for the people who keep OSRS Services precise,
              responsive, and ready for every customer request.
            </p>

            <div className="border-border/80 bg-surface-1/45 mt-10 max-w-xl rounded-2xl border p-2 shadow-2xl shadow-black/20 backdrop-blur-sm">
              <div className="flex items-start gap-4 rounded-xl px-4 py-4">
                <span className="bg-primary-muted text-primary border-primary/15 flex size-10 shrink-0 items-center justify-center rounded-xl border">
                  <LockKeyhole className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="font-semibold text-white">
                    Permission-aware access
                  </p>
                  <p className="text-text-muted mt-1 text-sm leading-6">
                    Every session opens only the capabilities assigned to that
                    staff role.
                  </p>
                </div>
              </div>
              <div className="border-border/70 mx-4 border-t" />
              <div className="flex items-center gap-5 px-4 py-4 text-sm">
                <span className="text-text-secondary inline-flex items-center gap-2">
                  <BadgeCheck className="text-gold size-4" aria-hidden="true" />
                  Argon2id secured
                </span>
                <span className="text-text-secondary inline-flex items-center gap-2">
                  <ShieldCheck
                    className="text-gold size-4"
                    aria-hidden="true"
                  />
                  Database sessions
                </span>
              </div>
            </div>
          </section>

          <section className="mx-auto w-full max-w-[30rem]">
            <div className="surface-panel relative rounded-[1.4rem] p-6 sm:p-9">
              <div className="from-gold/80 via-gold/20 absolute inset-x-8 top-0 h-px bg-gradient-to-r to-transparent" />
              <div className="border-gold/20 bg-gold-muted/45 text-gold mb-7 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold tracking-[0.13em] uppercase">
                <Sparkles className="size-3" aria-hidden="true" />
                Secure operations
              </div>
              <h2 className="display-type text-3xl leading-tight text-white sm:text-[2.25rem]">
                Sign in to continue
              </h2>
              <p className="text-text-secondary mt-3 text-sm leading-6">
                Enter the Super Admin credentials provided through your local
                environment.
              </p>
              <LoginForm next={next} />
            </div>
            <p className="text-text-muted mt-5 px-3 text-center text-xs leading-5">
              Protected by secure, HTTP-only database sessions. No default
              password is included.
            </p>
          </section>
        </main>

        <footer className="text-text-muted flex min-h-16 shrink-0 items-center justify-center border-t border-white/5 text-center text-[0.7rem] tracking-[0.08em] uppercase sm:justify-between">
          <span>OSRS Services internal operations</span>
          <span className="hidden sm:inline">Authenticated staff only</span>
        </footer>
      </div>
    </div>
  );
}
