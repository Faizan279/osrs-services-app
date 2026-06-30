import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CircleCheck,
  Coins,
  Crown,
  Eye,
  Flag,
  Headphones,
  KeyRound,
  LockKeyhole,
  Map,
  MessageCircle,
  MessagesSquare,
  Quote,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Swords,
  UserRoundCheck,
} from "lucide-react";
import Link from "next/link";

import { FaqAccordion } from "@/components/faq-accordion";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getDiscordHref, publicCtaLinks } from "@/config/public-navigation";
import {
  featuredServices,
  feedbackPreviews,
  homepageCategories,
  homepageFaqs,
  orderSteps,
  processBenefits,
  type HomepageCategoryIcon,
} from "@/content/homepage";
import { cn } from "@/lib/utils";

const title = "Professional OSRS Services Marketplace";
const description =
  "Explore OSRS power levelling, questing, PvM and progression services through a clear, privacy-conscious ordering process.";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? "https://osrsservices.com",
  ),
  title,
  description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "OSRS Services",
    title,
    description,
  },
  robots: { index: true, follow: true },
};

const categoryIcons: Record<HomepageCategoryIcon, LucideIcon> = {
  activity: Activity,
  badge: BadgeCheck,
  coins: Coins,
  crown: Crown,
  flag: Flag,
  map: Map,
  scroll: ScrollText,
  swords: Swords,
};

const benefitIcons: readonly LucideIcon[] = [
  ShieldCheck,
  MessagesSquare,
  UserRoundCheck,
  Eye,
  Headphones,
  LockKeyhole,
];

function SectionIntro({
  eyebrow,
  title,
  description: sectionDescription,
  align = "left",
}: {
  eyebrow: string;
  title: string;
  description: string;
  align?: "left" | "center";
}) {
  return (
    <div
      className={cn("max-w-2xl", align === "center" && "mx-auto text-center")}
    >
      <p
        className={cn(
          "text-gold kicker-type ornament-rule",
          align === "center" && "justify-center before:hidden",
        )}
      >
        {eyebrow}
      </p>
      <h2 className="display-type text-text-primary mt-4 text-3xl leading-[1.05] sm:text-4xl lg:text-5xl">
        {title}
      </h2>
      <p className="text-text-secondary mt-5 text-base leading-7 sm:text-lg">
        {sectionDescription}
      </p>
    </div>
  );
}

function HeroVisual() {
  return (
    <div
      aria-label="Illustration of the OSRS Services ordering workflow"
      role="img"
      className="hero-visual relative mx-auto w-full max-w-[35rem] lg:mx-0 lg:ml-auto"
    >
      <div className="border-gold/15 absolute -inset-4 rounded-[2rem] border" />
      <div className="border-border-strong bg-surface-1 relative overflow-hidden rounded-[1.75rem] border p-4 shadow-[0_38px_90px_rgb(0_0_0_/_0.48)] sm:p-5">
        <div className="border-border bg-background/55 flex items-center justify-between rounded-xl border px-4 py-3">
          <div className="flex items-center gap-3">
            <span className="bg-primary/12 border-primary/25 flex size-9 items-center justify-center rounded-lg border">
              <Swords aria-hidden="true" className="text-primary size-4" />
            </span>
            <div>
              <p className="text-text-primary text-xs font-bold">
                Service request
              </p>
              <p className="text-text-muted mt-0.5 text-[0.65rem]">
                Clear scope · private communication
              </p>
            </div>
          </div>
          <span className="border-gold/25 bg-gold-muted/60 text-gold rounded-full border px-2.5 py-1 text-[0.6rem] font-bold tracking-[0.12em] uppercase">
            In review
          </span>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-[1.12fr_0.88fr]">
          <div className="border-border from-surface-3 to-background relative min-h-72 overflow-hidden rounded-2xl border bg-gradient-to-br p-5">
            <div className="hero-orbit absolute top-1/2 left-1/2 size-52 -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed" />
            <div className="border-gold/12 absolute top-1/2 left-1/2 size-36 -translate-x-1/2 -translate-y-1/2 rotate-45 rounded-3xl border" />
            <div className="border-primary/30 bg-primary-muted/80 absolute top-1/2 left-1/2 flex size-24 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-[1.5rem] border shadow-[0_0_50px_rgb(166_215_25_/_0.12)]">
              <ShieldCheck
                aria-hidden="true"
                className="text-primary size-10"
              />
            </div>
            <span className="border-border-strong bg-surface-raised text-text-primary absolute top-5 left-5 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.62rem] font-bold shadow-xl">
              <CircleCheck aria-hidden="true" className="text-primary size-3" />
              Goal selected
            </span>
            <span className="border-border-strong bg-surface-raised text-text-primary absolute right-4 bottom-6 flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.62rem] font-bold shadow-xl">
              <MessageCircle aria-hidden="true" className="text-gold size-3" />
              Updates ready
            </span>
          </div>

          <div className="grid gap-3">
            {[
              ["01", "Choose", "Select the right service"],
              ["02", "Configure", "Share the useful details"],
              ["03", "Track", "Follow clear progress"],
            ].map(([number, step, detail], index) => (
              <div
                key={number}
                className={cn(
                  "border-border bg-background/45 rounded-xl border p-3.5",
                  index === 1 && "border-primary/25 bg-primary-muted/20",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-primary text-[0.62rem] font-black tracking-[0.16em]">
                    {number}
                  </span>
                  {index === 1 ? (
                    <Sparkles
                      aria-hidden="true"
                      className="text-gold size-3.5"
                    />
                  ) : null}
                </div>
                <p className="text-text-primary mt-3 text-xs font-bold">
                  {step}
                </p>
                <p className="text-text-muted mt-1 text-[0.65rem] leading-4">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </div>

        <div className="border-border bg-background/35 mt-4 grid grid-cols-3 gap-2 rounded-xl border p-3">
          {["Privacy-aware", "Scope first", "Support access"].map((item) => (
            <span
              key={item}
              className="text-text-secondary flex items-center justify-center gap-1.5 text-center text-[0.62rem] font-semibold"
            >
              <span className="bg-primary size-1.5 shrink-0 rounded-full" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function Homepage() {
  const discordHref = getDiscordHref();

  return (
    <main id="main-content" className="public-atmosphere overflow-hidden">
      <section className="relative isolate flex min-h-[calc(100svh-7rem)] items-center">
        <div className="public-grid pointer-events-none absolute inset-0 -z-20 opacity-50" />
        <div className="bg-primary/8 pointer-events-none absolute top-16 left-[-12rem] -z-10 size-[32rem] rounded-full blur-[110px]" />
        <div className="bg-gold/5 pointer-events-none absolute right-[-10rem] bottom-[-8rem] -z-10 size-[28rem] rounded-full blur-[100px]" />

        <div className="mx-auto grid w-full max-w-7xl items-center gap-14 px-5 py-18 sm:px-6 sm:py-22 lg:grid-cols-[0.93fr_1.07fr] lg:px-8 lg:py-20 xl:gap-20">
          <div className="max-w-2xl">
            <Badge
              variant="success"
              className="border-primary/25 bg-primary-muted/65 text-primary"
            >
              <ShieldCheck aria-hidden="true" className="size-3.5" />
              Professional service workflow
            </Badge>
            <h1 className="display-type text-text-primary mt-6 text-[2.75rem] leading-[0.98] text-balance sm:text-6xl lg:text-[4.35rem]">
              Your next goal,
              <span className="text-primary block">handled with care.</span>
            </h1>
            <p className="text-text-secondary mt-6 max-w-xl text-base leading-7 sm:text-lg sm:leading-8">
              Explore professional OSRS services through a clear ordering path
              designed around thoughtful account handling, useful updates and
              access to support.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                href={publicCtaLinks.browseServices}
                className={buttonVariants({ size: "lg" })}
              >
                Browse services
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href="/#how-it-works"
                className={buttonVariants({ variant: "secondary", size: "lg" })}
              >
                See how it works
              </Link>
            </div>

            <ul className="text-text-muted mt-9 grid gap-3 text-xs sm:grid-cols-3 sm:gap-5">
              {[
                [LockKeyhole, "Privacy-conscious"],
                [MessagesSquare, "Clear communication"],
                [Headphones, "Support access"],
              ].map(([Icon, label]) => {
                const TrustIcon = Icon as LucideIcon;
                return (
                  <li
                    key={label as string}
                    className="flex items-center gap-2.5"
                  >
                    <span className="border-border bg-surface-2 flex size-8 items-center justify-center rounded-lg border">
                      <TrustIcon
                        aria-hidden="true"
                        className="text-gold size-3.5"
                      />
                    </span>
                    <span className="font-semibold">{label as string}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <HeroVisual />
        </div>
      </section>

      <section
        id="service-categories"
        className="section-anchor border-border/70 bg-background/45 border-y py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <SectionIntro
              eyebrow="Service index"
              title="Start with the kind of progress you need."
              description="Browse the major service areas now. Detailed calculators, live inventory and checkout configuration remain intentionally scheduled for later tasks."
            />
            <p className="text-text-muted max-w-sm text-sm leading-6 lg:text-right">
              Every category will grow into a purpose-built order experience —
              never a one-size-fits-all product form.
            </p>
          </div>

          <div className="mt-12 grid auto-rows-fr gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {homepageCategories.map((category) => {
              const Icon = categoryIcons[category.icon];
              return (
                <article
                  key={category.id}
                  id={category.id}
                  className={cn(
                    "section-anchor group border-border from-surface-2 to-surface-1 hover:border-primary/35 relative flex min-h-64 flex-col overflow-hidden rounded-2xl border bg-gradient-to-br p-5 transition duration-200 sm:p-6",
                    category.treatment === "feature" &&
                      "sm:col-span-2 lg:min-h-72",
                    category.treatment === "compact" && "lg:min-h-60",
                  )}
                >
                  <div className="bg-primary/6 group-hover:bg-primary/10 pointer-events-none absolute -top-12 -right-12 size-36 rounded-full blur-3xl transition" />
                  <span className="border-border-strong bg-background/45 group-hover:border-primary/35 flex size-11 items-center justify-center rounded-xl border transition">
                    <Icon aria-hidden="true" className="text-primary size-5" />
                  </span>
                  <div className="mt-auto pt-8">
                    <h3 className="display-type text-text-primary text-2xl">
                      {category.title}
                    </h3>
                    <p className="text-text-secondary mt-3 max-w-xl text-sm leading-6">
                      {category.description}
                    </p>
                    <Link
                      href={category.href}
                      className="text-primary focus-visible:ring-primary mt-5 inline-flex min-h-9 items-center gap-2 rounded-lg text-xs font-bold tracking-[0.04em] uppercase focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Explore category
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3.5 transition-transform group-hover:translate-x-1"
                      />
                    </Link>
                  </div>
                </article>
              );
            })}
            <span id="skill-training" className="section-anchor sr-only" />
          </div>
        </div>
      </section>

      <section
        id="featured-services"
        className="section-anchor py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="Featured paths"
            title="A useful preview — without invented prices."
            description="These service cards show how the future catalogue will communicate scope, scheduling and next actions while client pricing remains unconfigured."
          />

          <div className="mt-12 grid gap-4 md:grid-cols-2">
            {featuredServices.map((service, index) => (
              <article
                key={service.name}
                className="border-border bg-surface-1/75 hover:border-border-strong group rounded-2xl border p-5 transition sm:p-6"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-gold text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                      {service.category}
                    </p>
                    <h3 className="text-text-primary mt-3 text-xl font-bold">
                      {service.name}
                    </h3>
                  </div>
                  <span className="border-border bg-background/55 text-text-muted flex size-9 shrink-0 items-center justify-center rounded-lg border text-xs font-black">
                    0{index + 1}
                  </span>
                </div>
                <p className="text-text-secondary mt-4 text-sm leading-6">
                  {service.summary}
                </p>
                <dl className="border-border mt-6 grid gap-4 border-y py-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-text-muted text-[0.62rem] font-bold tracking-[0.14em] uppercase">
                      Starting price
                    </dt>
                    <dd className="text-text-primary mt-1.5 text-sm font-bold">
                      {service.price}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-text-muted text-[0.62rem] font-bold tracking-[0.14em] uppercase">
                      Scheduling
                    </dt>
                    <dd className="text-text-primary mt-1.5 text-sm font-bold">
                      {service.delivery}
                    </dd>
                  </div>
                </dl>
                <Link
                  href={service.href}
                  className="text-primary focus-visible:ring-primary mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
                >
                  {service.label}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform group-hover:translate-x-1"
                  />
                </Link>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-border bg-surface-1/45 border-y py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="Why OSRS Services"
            title="Trust comes from a better process."
            description="The marketplace is being built around practical operating principles, not fabricated popularity numbers or marketing guarantees."
            align="center"
          />

          <div className="border-border bg-border mt-12 grid gap-px overflow-hidden rounded-2xl border sm:grid-cols-2 lg:grid-cols-3">
            {processBenefits.map((benefit, index) => {
              const Icon = benefitIcons[index] ?? ShieldCheck;
              return (
                <article
                  key={benefit.title}
                  className="bg-surface-1 p-6 sm:p-7"
                >
                  <Icon aria-hidden="true" className="text-primary size-5" />
                  <h3 className="text-text-primary mt-5 text-base font-bold">
                    {benefit.title}
                  </h3>
                  <p className="text-text-secondary mt-2 text-sm leading-6">
                    {benefit.description}
                  </p>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="section-anchor py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20">
            <SectionIntro
              eyebrow="How it works"
              title="Four clear steps from goal to progress."
              description="This explains the intended order journey. Live service configuration and checkout are deliberately outside Task 002."
            />
            <ol className="grid gap-4 sm:grid-cols-2">
              {orderSteps.map((step) => (
                <li
                  key={step.number}
                  className="border-border bg-surface-1/70 relative rounded-2xl border p-6"
                >
                  <span className="text-primary text-xs font-black tracking-[0.18em]">
                    {step.number}
                  </span>
                  <h3 className="text-text-primary mt-8 text-lg font-bold">
                    {step.title}
                  </h3>
                  <p className="text-text-secondary mt-2 text-sm leading-6">
                    {step.description}
                  </p>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section
        id="security"
        className="section-anchor mx-auto max-w-7xl px-5 pb-20 sm:px-6 sm:pb-24 lg:px-8 lg:pb-28"
      >
        <div className="border-border-strong from-primary-muted/55 via-surface-2 to-background relative overflow-hidden rounded-[1.75rem] border bg-gradient-to-br p-6 sm:p-10 lg:p-14">
          <div className="public-grid pointer-events-none absolute inset-0 opacity-35" />
          <div className="relative grid items-center gap-12 lg:grid-cols-[1.08fr_0.92fr] lg:gap-20">
            <div>
              <Badge variant="warning">Privacy-conscious service</Badge>
              <h2 className="display-type text-text-primary mt-5 text-3xl leading-[1.05] sm:text-4xl lg:text-5xl">
                Your order details belong in a controlled workflow.
              </h2>
              <p className="text-text-secondary mt-5 max-w-2xl text-base leading-7">
                Account and order information should be shared only when needed,
                through the approved communication path, and with staff access
                limited by their responsibilities.
              </p>
              <Link
                href="/#faq"
                className={cn(buttonVariants({ variant: "secondary" }), "mt-7")}
              >
                Read security FAQs
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </div>
            <div className="grid gap-3">
              {[
                [
                  KeyRound,
                  "Account and order privacy",
                  "Share only the information required for the agreed service.",
                ],
                [
                  MessageCircle,
                  "Secure communication",
                  "Keep important updates connected to the order workflow.",
                ],
                [
                  UserRoundCheck,
                  "Permission-aware operations",
                  "Staff access follows the responsibilities established in the platform foundation.",
                ],
              ].map(([Icon, itemTitle, itemDescription]) => {
                const SecurityIcon = Icon as LucideIcon;
                return (
                  <article
                    key={itemTitle as string}
                    className="border-border bg-background/55 flex gap-4 rounded-xl border p-4 backdrop-blur"
                  >
                    <span className="border-primary/25 bg-primary/8 flex size-10 shrink-0 items-center justify-center rounded-lg border">
                      <SecurityIcon
                        aria-hidden="true"
                        className="text-primary size-4"
                      />
                    </span>
                    <div>
                      <h3 className="text-text-primary text-sm font-bold">
                        {itemTitle as string}
                      </h3>
                      <p className="text-text-muted mt-1 text-xs leading-5">
                        {itemDescription as string}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        id="feedback"
        className="section-anchor border-border bg-background/55 border-y py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <SectionIntro
              eyebrow="Customer feedback"
              title="A transparent home for verified voices."
              description="The reusable review layout is ready. These cards are visibly marked as demo content until client-approved feedback is supplied."
            />
            <Badge variant="warning">Demo content — not real reviews</Badge>
          </div>
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {feedbackPreviews.map((feedback) => (
              <article
                key={feedback.context}
                className="border-border bg-surface-1 relative rounded-2xl border p-6"
                data-content-status="demo"
              >
                <Quote aria-hidden="true" className="text-gold/45 size-7" />
                <p className="text-text-primary mt-6 text-base leading-7">
                  “{feedback.quote}”
                </p>
                <div className="border-border mt-7 border-t pt-4">
                  <p className="text-text-secondary text-xs font-bold">
                    {feedback.context}
                  </p>
                  <p className="text-warning mt-1 text-[0.65rem] font-bold tracking-[0.08em] uppercase">
                    {feedback.attribution}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="faq" className="section-anchor py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-5xl px-5 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="Common questions"
            title="Good orders begin with clear answers."
            description="A careful overview of the planned service process, account details, communication and custom quotes."
            align="center"
          />
          <div className="mt-12">
            <FaqAccordion items={homepageFaqs} />
          </div>
        </div>
      </section>

      <section
        id="support"
        className="section-anchor mx-auto max-w-7xl px-5 pb-20 sm:px-6 sm:pb-24 lg:px-8 lg:pb-28"
      >
        <div className="border-primary/25 bg-primary text-primary-foreground relative overflow-hidden rounded-[1.75rem] border px-6 py-10 shadow-[0_24px_70px_rgb(166_215_25_/_0.12)] sm:px-10 sm:py-12 lg:px-14">
          <div className="pointer-events-none absolute top-1/2 right-[-5rem] size-72 -translate-y-1/2 rounded-full border border-black/10" />
          <div className="pointer-events-none absolute top-1/2 right-[-1rem] size-48 -translate-y-1/2 rounded-full border border-black/10" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[0.68rem] font-black tracking-[0.18em] uppercase">
                Ready when you are
              </p>
              <h2 className="display-type mt-3 text-3xl leading-[1.05] sm:text-4xl">
                Find the right service path for your next goal.
              </h2>
              <p className="mt-4 max-w-xl text-sm leading-6 font-semibold text-black/70 sm:text-base">
                Browse the current service preview or contact support before you
                decide. Discord uses a verified configurable link when one is
                supplied.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Link
                href={publicCtaLinks.browseServices}
                className="focus-visible:ring-background inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/25 bg-black px-6 text-sm font-bold text-white transition hover:bg-black/85 focus-visible:ring-2 focus-visible:outline-none"
              >
                Browse services
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
              <Link
                href={discordHref}
                className="focus-visible:ring-background inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-black/25 bg-transparent px-6 text-sm font-bold transition hover:bg-black/8 focus-visible:ring-2 focus-visible:outline-none"
              >
                <MessageCircle aria-hidden="true" className="size-4" />
                Discord &amp; support
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
