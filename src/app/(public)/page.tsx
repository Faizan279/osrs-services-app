import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BarChart3,
  Calculator,
  CheckCircle2,
  Coins,
  Crown,
  Flag,
  Gauge,
  Headphones,
  LockKeyhole,
  Map,
  MapPin,
  MessageCircle,
  MessagesSquare,
  PackageCheck,
  ScrollText,
  Shield,
  ShieldCheck,
  Sparkles,
  Swords,
  Target,
  Waypoints,
  Zap,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { FaqAccordion } from "@/components/faq-accordion";
import { FeaturedServicesMarketplace } from "@/components/featured-services-marketplace";
import { MarketplaceSearch } from "@/components/marketplace-search";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { getDiscordHref, publicCtaLinks } from "@/config/public-navigation";
import {
  expertiseAreas,
  homepageCategories,
  homepageFaqs,
  orderSteps,
  orderTrackingPreview,
  processBenefits,
  type HomepageCategoryIcon,
} from "@/content/homepage";
import { cn } from "@/lib/utils";

const title = "Professional OSRS Services Marketplace";
const description =
  "Configure professional OSRS services, review transparent estimates and track progress through a clear, privacy-conscious marketplace.";

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

const trustIcons: readonly LucideIcon[] = [
  MessagesSquare,
  BarChart3,
  LockKeyhole,
];

const stepIcons: readonly LucideIcon[] = [
  Target,
  Waypoints,
  ShieldCheck,
  Gauge,
];

function SectionIntro({
  eyebrow,
  title: sectionTitle,
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
      <h2 className="display-type text-text-primary mt-4 text-3xl leading-[1.02] text-balance sm:text-4xl lg:text-5xl">
        {sectionTitle}
      </h2>
      <p className="text-text-secondary mt-5 text-base leading-7 sm:text-lg">
        {sectionDescription}
      </p>
    </div>
  );
}

function PortalArtwork() {
  return (
    <figure className="portal-artwork relative h-full min-h-[31rem] overflow-hidden md:min-h-[38rem] lg:min-h-[47rem]">
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet="/artwork/portal-hero-mobile.webp"
        />
        <Image
          src="/artwork/portal-hero-desktop.webp"
          alt="Armoured knight standing before a glowing green fantasy portal surrounded by coins and crystals"
          width={1600}
          height={900}
          priority
          sizes="(max-width: 767px) 100vw, 62vw"
          className="absolute inset-0 size-full object-cover object-center"
        />
      </picture>
      <div className="portal-artwork-fade pointer-events-none absolute inset-0" />
      <div className="portal-floor-glow pointer-events-none absolute right-[10%] bottom-[2%] h-24 w-2/3 rounded-[50%] blur-3xl" />
      <span className="hero-float-label hero-float-gold hidden md:flex">
        <Coins aria-hidden="true" className="size-3.5" /> Gold &amp; Items
      </span>
      <span className="hero-float-label hero-float-level hidden md:flex">
        <Zap aria-hidden="true" className="size-3.5" /> Power Levelling
      </span>
      <span className="hero-float-label hero-float-raids hidden md:flex">
        <Swords aria-hidden="true" className="size-3.5" /> Raids &amp; Bossing
      </span>
      <span className="hero-float-label hero-float-track hidden md:flex">
        <Gauge aria-hidden="true" className="size-3.5" /> Order Tracking
      </span>
    </figure>
  );
}

export default function Homepage() {
  const discordHref = getDiscordHref();
  const priorityCategories = homepageCategories.filter(({ id }) =>
    ["power-levelling", "questing"].includes(id),
  );
  const secondaryCategories = homepageCategories.filter(
    ({ id }) => !["power-levelling", "questing"].includes(id),
  );

  return (
    <main id="main-content" className="redesign-atmosphere overflow-hidden">
      <section className="hero-marketplace relative isolate min-h-[calc(100svh-6.8rem)] overflow-hidden">
        <div className="hero-grid pointer-events-none absolute inset-0 -z-20" />
        <div className="hero-portal-haze pointer-events-none absolute top-[15%] right-[8%] -z-10 size-[34rem] rounded-full blur-[120px]" />

        <div className="mx-auto grid min-h-[calc(100svh-6.8rem)] max-w-[100rem] lg:grid-cols-[44%_56%]">
          <div className="relative z-20 flex items-center px-5 py-14 sm:px-8 sm:py-18 lg:px-12 xl:pl-[max(3rem,calc((100vw-80rem)/2))]">
            <div className="max-w-2xl">
              <Badge
                variant="success"
                className="border-primary/20 bg-primary-muted/55 text-primary"
              >
                <Sparkles aria-hidden="true" className="size-3.5" />
                Built around your next milestone
              </Badge>
              <h1 className="display-type text-text-primary mt-6 text-[2.7rem] leading-[0.96] text-balance sm:text-6xl lg:text-[4.15rem] xl:text-[4.65rem]">
                Your next OSRS milestone,
                <span className="text-primary block">handled with care.</span>
              </h1>
              <p className="text-text-secondary mt-6 max-w-xl text-base leading-7 sm:text-lg sm:leading-8">
                Configure professional OSRS services, review transparent
                estimates and track your order from one secure dashboard.
              </p>

              <MarketplaceSearch />

              <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                <Link
                  href={publicCtaLinks.browseServices}
                  className={buttonVariants({ size: "lg" })}
                >
                  Browse Services
                  <ArrowRight aria-hidden="true" className="size-4" />
                </Link>
                <Link
                  href={publicCtaLinks.getEstimate}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "lg",
                  })}
                >
                  Get an Estimate
                </Link>
              </div>

              <ul className="mt-8 flex flex-wrap gap-x-5 gap-y-3">
                {[
                  "Clear estimates",
                  "Secure communication",
                  "Order progress visibility",
                ].map((item) => (
                  <li
                    key={item}
                    className="text-text-muted flex items-center gap-2 text-xs font-semibold"
                  >
                    <CheckCircle2
                      aria-hidden="true"
                      className="text-primary size-3.5"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="relative min-h-[25rem] md:min-h-[38rem] lg:min-h-0">
            <PortalArtwork />
          </div>
        </div>
      </section>

      <section
        id="service-categories"
        className="section-anchor category-marketplace py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid gap-8 lg:grid-cols-[1fr_0.7fr] lg:items-end">
            <SectionIntro
              eyebrow="Marketplace entry points"
              title="Go straight to the progress you have in mind."
              description="Start with a priority service path or scan the wider marketplace. Each route keeps requirements and estimates visible before an order is confirmed."
            />
            <p className="text-text-muted max-w-md text-sm leading-6 lg:justify-self-end lg:text-right">
              Full service configuration is scheduled for later tasks. These
              entry points establish the discovery experience without inventing
              prices or availability.
            </p>
          </div>

          <div className="mt-12 grid gap-5 lg:grid-cols-2">
            {priorityCategories.map((category, index) => {
              const Icon = categoryIcons[category.icon];
              return (
                <article
                  key={category.id}
                  id={category.id}
                  className={cn(
                    "priority-category section-anchor group relative isolate min-h-80 overflow-hidden rounded-[1.75rem] p-7 sm:p-9",
                    index === 1 && "priority-category-quest",
                  )}
                >
                  <div className="category-poly-object" aria-hidden="true">
                    <span className="category-poly-ring" />
                    <span className="category-poly-core">
                      <Icon className="size-10" />
                    </span>
                  </div>
                  <div className="relative z-10 flex h-full max-w-md flex-col">
                    <p className="text-gold kicker-type">
                      {index === 0 ? "Build a skill path" : "Plan progression"}
                    </p>
                    <h3 className="display-type text-text-primary mt-auto pt-20 text-3xl sm:text-4xl">
                      {category.title}
                    </h3>
                    <p className="text-text-secondary mt-3 text-sm leading-6">
                      {category.description}
                    </p>
                    <Link
                      href={category.href}
                      className="text-primary focus-visible:ring-primary mt-5 inline-flex min-h-10 w-fit items-center gap-2 rounded-lg text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
                    >
                      Explore service path
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 transition-transform group-hover:translate-x-1"
                      />
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="secondary-category-rail mt-5 grid sm:grid-cols-2 lg:grid-cols-3">
            {secondaryCategories.map((category) => {
              const Icon = categoryIcons[category.icon];
              return (
                <Link
                  key={category.id}
                  id={category.id}
                  href={category.href}
                  className="section-anchor group focus-visible:ring-primary flex min-h-32 items-center gap-4 px-5 py-5 transition focus-visible:ring-2 focus-visible:outline-none sm:px-6"
                >
                  <span className="secondary-category-icon">
                    <Icon
                      aria-hidden="true"
                      className="text-primary size-5 transition-transform group-hover:-translate-y-1"
                    />
                  </span>
                  <span>
                    <span className="text-text-primary group-hover:text-primary block text-sm font-bold transition">
                      {category.title}
                    </span>
                    <span className="text-text-muted mt-1 block text-xs leading-5">
                      {category.description}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="security"
        className="section-anchor trust-editorial py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[0.9fr_0.65fr_0.95fr] lg:px-8">
          <div>
            <p className="text-gold kicker-type ornament-rule">
              Ordering confidence
            </p>
            <h2 className="display-type text-text-primary mt-5 text-3xl leading-[1.03] sm:text-5xl">
              One clear path from request to progress.
            </h2>
            <p className="text-text-secondary mt-5 text-base leading-7">
              Useful detail should make an order easier to understand—not make
              the experience feel like an internal system. Scope, updates and
              support stay connected around your milestone.
            </p>
          </div>

          <div className="trust-relic mx-auto" aria-hidden="true">
            <span className="trust-relic-orbit" />
            <span className="trust-relic-shield">
              <Shield className="size-14" />
            </span>
            <span className="trust-relic-gem trust-relic-gem-one" />
            <span className="trust-relic-gem trust-relic-gem-two" />
          </div>

          <div className="divide-border/50 divide-y">
            {processBenefits.map((benefit, index) => {
              const Icon = trustIcons[index] ?? ShieldCheck;
              return (
                <article
                  key={benefit.title}
                  className="flex gap-4 py-6 first:pt-0 last:pb-0"
                >
                  <span className="bg-primary/10 text-primary flex size-10 shrink-0 items-center justify-center rounded-xl">
                    <Icon aria-hidden="true" className="size-4.5" />
                  </span>
                  <div>
                    <h3 className="text-text-primary text-base font-bold">
                      {benefit.title}
                    </h3>
                    <p className="text-text-secondary mt-2 text-sm leading-6">
                      {benefit.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section
        id="featured-services"
        className="section-anchor featured-marketplace py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <SectionIntro
              eyebrow="Popular service paths"
              title="A marketplace view built around useful choices."
              description="Compare service context, supported account modes and estimate states without fabricated rankings, prices or delivery promises."
            />
            <Link
              href={publicCtaLinks.browseServices}
              className="text-primary focus-visible:ring-primary inline-flex min-h-11 w-fit items-center gap-2 rounded-lg text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              View all service areas
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <FeaturedServicesMarketplace />
        </div>
      </section>

      <section
        id="calculator-preview"
        className="section-anchor calculator-atmosphere py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16 lg:px-8">
          <div>
            <Badge variant="warning">Transparent estimate preview</Badge>
            <h2 className="display-type text-text-primary mt-5 text-3xl leading-[1.02] sm:text-5xl">
              Configure first. Confirm the final price before ordering.
            </h2>
            <p className="text-text-secondary mt-5 text-base leading-7">
              The planned calculators will adapt to service type, current
              progress, target, account mode and relevant requirements. This
              preview demonstrates the information hierarchy only.
            </p>
            <ul className="text-text-secondary mt-7 space-y-3 text-sm">
              {[
                "Skill and XP targets",
                "Quest and diary requirements",
                "Bossing and PvM scope",
                "Account-mode adjustments",
              ].map((item) => (
                <li key={item} className="flex items-center gap-3">
                  <CheckCircle2
                    aria-hidden="true"
                    className="text-primary size-4"
                  />
                  {item}
                </li>
              ))}
            </ul>
            <Link
              href={publicCtaLinks.browseServices}
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "mt-8",
              )}
            >
              Browse calculator types
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>

          <div className="calculator-stage relative" data-content-status="demo">
            <div
              className="calculator-coins pointer-events-none"
              aria-hidden="true"
            >
              <span />
              <span />
              <span />
            </div>
            <div
              className="calculator-crystal pointer-events-none"
              aria-hidden="true"
            />
            <div className="calculator-window relative z-10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-gold text-[0.65rem] font-bold tracking-[0.16em] uppercase">
                    Calculator interface preview
                  </p>
                  <h3 className="text-text-primary mt-2 text-xl font-bold">
                    Skill progression estimate
                  </h3>
                </div>
                <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                  <Calculator aria-hidden="true" className="size-5" />
                </span>
              </div>

              <fieldset className="mt-7 grid gap-4 sm:grid-cols-2" disabled>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-text-secondary text-xs font-bold">
                    Service
                  </span>
                  <select
                    aria-label="Preview service"
                    defaultValue="Agility training"
                    className="border-border bg-background/65 text-text-primary h-12 w-full rounded-xl border px-4 text-sm"
                  >
                    <option>Agility training</option>
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="text-text-secondary text-xs font-bold">
                    Current level
                  </span>
                  <input
                    aria-label="Preview current level"
                    value="62"
                    readOnly
                    className="border-border bg-background/65 text-text-primary h-12 w-full rounded-xl border px-4 text-sm"
                  />
                </label>
                <label className="space-y-2">
                  <span className="text-text-secondary text-xs font-bold">
                    Target level
                  </span>
                  <input
                    aria-label="Preview target level"
                    value="80"
                    readOnly
                    className="border-border bg-background/65 text-text-primary h-12 w-full rounded-xl border px-4 text-sm"
                  />
                </label>
                <label className="space-y-2 sm:col-span-2">
                  <span className="text-text-secondary text-xs font-bold">
                    Game mode
                  </span>
                  <select
                    aria-label="Preview game mode"
                    defaultValue="Normal"
                    className="border-border bg-background/65 text-text-primary h-12 w-full rounded-xl border px-4 text-sm"
                  >
                    <option>Normal</option>
                  </select>
                </label>
              </fieldset>

              <div className="estimate-preview mt-6 p-5">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-text-primary text-sm font-bold">
                    Estimate summary
                  </p>
                  <span className="text-primary text-[0.62rem] font-bold tracking-[0.12em] uppercase">
                    Configuration required
                  </span>
                </div>
                <p className="display-type text-text-primary mt-5 text-2xl">
                  Estimate updates after configuration
                </p>
                <p className="text-text-muted mt-2 text-xs leading-5">
                  Final pricing is confirmed before order submission.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section
        id="how-it-works"
        className="section-anchor journey-atmosphere py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <SectionIntro
            eyebrow="How ordering works"
            title="Follow one connected route to your next milestone."
            description="The homepage explains the intended journey. Service engines, checkout and real tracking remain later implementation tasks."
            align="center"
          />
          <ol className="journey-path relative mt-14 grid gap-8 lg:grid-cols-4 lg:gap-5">
            {orderSteps.map((step, index) => {
              const Icon = stepIcons[index] ?? MapPin;
              return (
                <li
                  key={step.number}
                  className="journey-stop relative flex gap-5 lg:block"
                >
                  <span className="journey-marker">
                    <Icon aria-hidden="true" className="size-5" />
                  </span>
                  <div className="lg:pt-7">
                    <span className="text-gold text-[0.62rem] font-black tracking-[0.16em]">
                      {step.number}
                    </span>
                    <h3 className="text-text-primary mt-2 text-lg font-bold">
                      {index === 0
                        ? "Choose a service"
                        : index === 1
                          ? "Configure requirements"
                          : index === 2
                            ? "Confirm securely"
                            : "Track progress"}
                    </h3>
                    <p className="text-text-secondary mt-2 text-sm leading-6">
                      {step.description}
                    </p>
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      <section
        id="order-tracking"
        className="section-anchor tracking-atmosphere py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-6 lg:grid-cols-[0.78fr_1.22fr] lg:gap-20 lg:px-8">
          <div>
            <Badge variant="success">Development-safe preview</Badge>
            <h2 className="display-type text-text-primary mt-5 text-3xl leading-[1.02] sm:text-5xl">
              Keep progress, messages and the next milestone together.
            </h2>
            <p className="text-text-secondary mt-5 text-base leading-7">
              The planned customer dashboard will make the meaningful parts of
              an order easy to follow without exposing internal operations. All
              information shown here is demonstration content.
            </p>
            <Link
              href={publicCtaLinks.account}
              className={cn(
                buttonVariants({ variant: "secondary", size: "lg" }),
                "mt-8",
              )}
            >
              Customer account
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>

          <div className="tracking-stage relative" data-content-status="demo">
            <span className="tracking-float tracking-float-one">
              Secure messages
            </span>
            <span className="tracking-float tracking-float-two">
              Milestone completed
            </span>
            <span className="tracking-float tracking-float-three">
              Support available
            </span>
            <div className="tracking-window">
              <div className="border-border/70 flex flex-wrap items-center justify-between gap-4 border-b px-5 py-4 sm:px-7">
                <div className="flex items-center gap-3">
                  <span className="bg-primary/12 text-primary flex size-10 items-center justify-center rounded-xl">
                    <PackageCheck aria-hidden="true" className="size-5" />
                  </span>
                  <div>
                    <p className="text-text-primary text-sm font-bold">
                      {orderTrackingPreview.title}
                    </p>
                    <p className="text-text-muted mt-0.5 text-xs">
                      {orderTrackingPreview.category}
                    </p>
                  </div>
                </div>
                <span className="bg-primary/10 text-primary rounded-full px-3 py-1.5 text-[0.65rem] font-bold tracking-[0.1em] uppercase">
                  {orderTrackingPreview.status}
                </span>
              </div>

              <div className="grid gap-6 p-5 sm:p-7 md:grid-cols-[1.1fr_0.9fr]">
                <div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-text-muted text-xs font-bold">
                        Order progress
                      </p>
                      <p className="display-type text-text-primary mt-2 text-4xl">
                        {orderTrackingPreview.progress}%
                      </p>
                    </div>
                    <Gauge aria-hidden="true" className="text-primary size-8" />
                  </div>
                  <div className="bg-background mt-5 h-2 overflow-hidden rounded-full">
                    <span
                      className="bg-primary block h-full rounded-full"
                      style={{ width: `${orderTrackingPreview.progress}%` }}
                    />
                  </div>
                  <div className="tracking-route mt-8">
                    {[
                      "Confirmed",
                      "Requirements",
                      "In progress",
                      "Complete",
                    ].map((milestone, index) => (
                      <span
                        key={milestone}
                        className={cn(index < 3 && "tracking-route-active")}
                      >
                        {milestone}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="tracking-info-row">
                    <MessagesSquare
                      aria-hidden="true"
                      className="text-gold size-4"
                    />
                    <span>
                      <span className="text-text-muted block text-[0.62rem] font-bold uppercase">
                        Communication
                      </span>
                      <span className="text-text-primary mt-1 block text-xs font-bold">
                        {orderTrackingPreview.activity}
                      </span>
                    </span>
                  </div>
                  <div className="tracking-info-row">
                    <Target
                      aria-hidden="true"
                      className="text-primary size-4"
                    />
                    <span>
                      <span className="text-text-muted block text-[0.62rem] font-bold uppercase">
                        Next milestone
                      </span>
                      <span className="text-text-primary mt-1 block text-xs font-bold">
                        {orderTrackingPreview.nextMilestone}
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled
                    className="border-border text-text-secondary flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border text-xs font-bold disabled:opacity-70"
                  >
                    <Headphones aria-hidden="true" className="size-4" />
                    Support action preview
                  </button>
                </div>
              </div>
              <p className="border-border/70 text-warning border-t px-5 py-3 text-center text-[0.62rem] font-bold tracking-[0.1em] uppercase sm:px-7">
                Demonstration content — not a real customer order
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="expertise-atmosphere py-20 sm:py-24 lg:py-28">
        <div className="mx-auto max-w-7xl px-5 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[0.72fr_1.28fr] lg:items-end">
            <SectionIntro
              eyebrow="Areas of expertise"
              title="Service knowledge organised around the work."
              description="Explore category expertise without fabricated employee profiles, qualifications or experience claims."
            />
            <div className="expertise-rail grid sm:grid-cols-2">
              {expertiseAreas.map((area) => {
                const Icon = categoryIcons[area.icon];
                return (
                  <article key={area.title} className="expertise-item group">
                    <span className="expertise-symbol">
                      <Icon
                        aria-hidden="true"
                        className="size-6 transition-transform group-hover:-translate-y-1"
                      />
                    </span>
                    <h3 className="text-text-primary mt-5 text-base font-bold">
                      {area.title}
                    </h3>
                    <p className="text-text-secondary mt-2 text-sm leading-6">
                      {area.description}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section
        id="faq"
        className="section-anchor faq-atmosphere py-20 sm:py-24 lg:py-28"
      >
        <div className="mx-auto grid max-w-7xl gap-12 px-5 sm:px-6 lg:grid-cols-[0.72fr_1.28fr] lg:gap-20 lg:px-8">
          <div>
            <SectionIntro
              eyebrow="Common questions"
              title="Clear answers before you configure an order."
              description="Review the planned service process, account information, communication and custom-estimate approach."
            />
            <div className="help-relic mt-10" aria-hidden="true">
              <span className="help-scroll" />
              <span className="help-seal">
                <MessageCircle className="size-5" />
              </span>
            </div>
            <Link
              href={discordHref}
              className="text-primary focus-visible:ring-primary mt-8 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-bold focus-visible:ring-2 focus-visible:outline-none"
            >
              <Headphones aria-hidden="true" className="size-4" />
              Request support
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
          </div>
          <FaqAccordion items={homepageFaqs} />
        </div>
      </section>

      <section
        id="support"
        className="section-anchor final-portal-cta relative isolate overflow-hidden py-20 sm:py-24"
      >
        <div className="cta-grid pointer-events-none absolute inset-0 -z-20" />
        <div className="cta-portal-energy pointer-events-none absolute top-1/2 right-[8%] -z-10 size-80 -translate-y-1/2 rounded-full" />
        <span className="cta-crystal cta-crystal-one" aria-hidden="true" />
        <span className="cta-crystal cta-crystal-two" aria-hidden="true" />
        <span className="cta-coin cta-coin-one" aria-hidden="true" />
        <span className="cta-coin cta-coin-two" aria-hidden="true" />
        <div className="mx-auto flex max-w-7xl flex-col gap-9 px-5 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div className="max-w-3xl">
            <p className="text-gold kicker-type">Continue the journey</p>
            <h2 className="display-type text-text-primary mt-4 text-3xl leading-[1.02] text-balance sm:text-5xl">
              Ready to plan your next OSRS milestone?
            </h2>
            <p className="text-text-secondary mt-4 max-w-2xl text-base leading-7">
              Explore the marketplace preview or request support before choosing
              a service path.
            </p>
          </div>
          <div className="relative z-10 flex shrink-0 flex-col gap-3 sm:flex-row">
            <Link
              href={publicCtaLinks.browseServices}
              className={buttonVariants({ size: "lg" })}
            >
              Browse Services
              <ArrowRight aria-hidden="true" className="size-4" />
            </Link>
            <Link
              href={discordHref}
              className={buttonVariants({ variant: "secondary", size: "lg" })}
            >
              Request Support
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
