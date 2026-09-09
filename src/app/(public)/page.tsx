import type { Metadata } from "next";
import type { LucideIcon } from "lucide-react";
import {
  ArrowRight,
  Check,
  Coins,
  Headphones,
  MonitorPlay,
  ShieldCheck,
  Skull,
  Swords,
  UserRoundCheck,
  UsersRound,
  Leaf,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import {
  defaultHomepageSections,
  fallbackHomepageCards,
  type HomepageCard,
} from "@/lib/homepage/core";

const title = "OSRS Services | Hand-Played Boosting & Marketplace";
const description =
  "Professional OSRS boosting, account builds, gold, items and PvM services with secure support and clear order tracking.";

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
    images: [
      {
        url: "/artwork/zuk-inferno-hero.png",
        alt: "OSRS Services inferno battle artwork",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/artwork/zuk-inferno-hero.png"],
  },
  robots: { index: true, follow: true },
};

const trustItems = [
  { icon: UserRoundCheck, value: "100%", label: "Hand played" },
  { icon: ShieldCheck, value: "VPN", label: "Protected" },
  { icon: MonitorPlay, value: "Streaming", label: "Available" },
  { icon: ShieldCheck, value: "Safe &", label: "Secure" },
  { icon: Headphones, value: "24/7", label: "Support" },
] as const;

const categoryIcons: readonly LucideIcon[] = [
  UserRoundCheck,
  Coins,
  ArrowRight,
  Swords,
  Leaf,
];

const launchMetrics = [
  { icon: UsersRound, value: "25K+*", label: "Orders completed" },
  { icon: ShieldCheck, value: "99.8%*", label: "Customer satisfaction" },
  { icon: Skull, value: "1M+*", label: "Bosses killed" },
  { icon: Headphones, value: "24/7", label: "Support coverage" },
] as const;

function sectionByKey(
  sections: readonly { sectionKey: string; title: string; enabled: boolean }[],
  key: string,
) {
  return sections.find((section) => section.sectionKey === key);
}

function artworkClass(
  kind: "category" | "service" | "featured",
  index: number,
) {
  return `reference-slice reference-slice-${kind}-${index % (kind === "category" ? 5 : kind === "service" ? 7 : 4)}`;
}

function CardArtwork({
  card,
  kind,
  index,
}: {
  card: HomepageCard;
  kind: "category" | "service" | "featured";
  index: number;
}) {
  if (
    kind === "category" &&
    card.href === "/misc-gathering" &&
    (!card.imagePath || card.imagePath === "/artwork/osrs-reference-board.jpeg")
  ) {
    return (
      <div className="relative size-full overflow-hidden">
        <Image
          src="/artwork/misc-gathering-resources.png"
          alt="Gathered herbs, logs, ore and fish beside a woodland river"
          fill
          sizes="(max-width: 768px) 100vw, 25vw"
          className="object-cover transition duration-300 group-hover:scale-105"
        />
      </div>
    );
  }
  if (
    !card.imagePath ||
    card.imagePath === "/artwork/osrs-reference-board.jpeg"
  ) {
    return <div className={artworkClass(kind, index)} aria-hidden="true" />;
  }
  return (
    <div className="relative size-full overflow-hidden">
      {card.imagePath.startsWith("/") ? (
        <Image
          src={card.imagePath}
          alt={card.imageAltText}
          fill
          sizes={
            kind === "service" ? "180px" : "(max-width: 768px) 100vw, 25vw"
          }
          className="object-cover transition duration-300 group-hover:scale-105"
          unoptimized={card.imagePath.startsWith("/uploads/")}
        />
      ) : (
        <div
          className="size-full bg-cover bg-center transition duration-300 group-hover:scale-105"
          style={{
            backgroundImage: `url(${JSON.stringify(card.imagePath).slice(1, -1)})`,
          }}
          aria-label={card.imageAltText}
          role="img"
        />
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-transparent to-transparent" />
    </div>
  );
}

async function loadHomepage() {
  const databaseConfigured = Boolean(
    process.env.DATABASE_USER &&
    process.env.DATABASE_PASSWORD &&
    process.env.DATABASE_NAME,
  );
  if (databaseConfigured) {
    try {
      const { getPublicHomepageContent } =
        await import("@/lib/homepage/server");
      return await getPublicHomepageContent();
    } catch {
      // Keep the storefront available while a migration or database connection is recovering.
    }
  }
  return {
    sections: defaultHomepageSections,
    cards: fallbackHomepageCards,
  };
}

export default async function Homepage() {
  const { sections, cards } = await loadHomepage();
  const categorySection = sectionByKey(sections, "main-categories");
  const serviceSection = sectionByKey(sections, "main-services");
  const featuredSection = sectionByKey(sections, "featured-services");
  const categories = cards.filter((card) => card.placement === "MAIN_CATEGORY");
  const services = cards.filter((card) => card.placement === "MAIN_SERVICE");
  const featured = cards.filter(
    (card) => card.placement === "FEATURED_SERVICE",
  );

  return (
    <main id="main-content" className="osrs-storefront overflow-hidden">
      <section className="inferno-hero relative isolate">
        <Image
          src="/artwork/zuk-inferno-hero.png"
          alt="An armoured adventurer confronting a colossal demon in a fiery fortress"
          fill
          priority
          sizes="100vw"
          className="-z-20 object-cover object-[66%_center]"
        />
        <div className="inferno-hero-shade absolute inset-0 -z-10" />
        <div className="mx-auto flex min-h-[38rem] max-w-7xl items-center px-5 py-16 sm:px-8 lg:min-h-[43rem]">
          <div className="max-w-2xl">
            <p className="text-primary text-xs font-black tracking-[0.18em] uppercase">
              #1 Trusted OSRS Services
            </p>
            <h1 className="display-type mt-5 text-5xl leading-[0.92] uppercase sm:text-7xl lg:text-[5.5rem]">
              You fight Zuk,
              <span className="text-primary block">we fight for you.</span>
            </h1>
            <p className="text-text-secondary mt-6 max-w-xl text-base leading-7 sm:text-lg">
              Professional OSRS boosting, account builds, quests, gold and
              more—safe, fast and hand-played.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/services" className={buttonVariants({ size: "lg" })}>
                Browse services
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <Link
                href="/services?featured=1"
                className={buttonVariants({
                  variant: "secondary",
                  size: "lg",
                })}
              >
                View offers
              </Link>
            </div>
            <ul className="mt-10 grid max-w-2xl grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-5">
              {trustItems.map(({ icon: Icon, value, label }) => (
                <li key={label} className="flex items-center gap-2">
                  <span className="inferno-trust-icon">
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <span className="text-[0.62rem] leading-tight font-bold uppercase">
                    <span className="text-primary block">{value}</span>
                    <span className="text-text-secondary">{label}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {categorySection?.enabled !== false && categories.length ? (
        <section className="osrs-section mx-auto max-w-7xl px-5 py-14 sm:px-8">
          <div className="osrs-section-heading">
            <span />
            <h2>{categorySection?.title ?? "What Can We Do For You?"}</h2>
            <span />
          </div>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {categories.map((card, index) => {
              const Icon =
                categoryIcons[index % categoryIcons.length] ?? UserRoundCheck;
              return (
                <Link
                  key={card.id}
                  href={card.href}
                  className="osrs-category-card group"
                >
                  <div className="h-56">
                    <CardArtwork card={card} kind="category" index={index} />
                  </div>
                  <div className="relative z-10 -mt-14 flex flex-1 flex-col items-center px-5 pb-5 text-center">
                    <span className="osrs-hex-icon">
                      <Icon className="size-6" aria-hidden="true" />
                    </span>
                    <h3 className="display-type mt-3 text-2xl uppercase">
                      {card.title}
                    </h3>
                    <p className="text-text-secondary mt-2 min-h-10 text-xs leading-5">
                      {card.description}
                    </p>
                    <span className="osrs-card-cta mt-5">{card.ctaText}</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ) : null}

      {serviceSection?.enabled !== false && services.length ? (
        <section className="mx-auto max-w-7xl px-5 pb-12 sm:px-8">
          <div className="osrs-section-heading">
            <span />
            <h2>{serviceSection?.title ?? "Our Main Services"}</h2>
            <span />
          </div>
          <div className="osrs-service-rail mt-6 flex gap-3 overflow-x-auto pb-3">
            {services.map((card, index) => (
              <Link
                key={card.id}
                href={card.href}
                className="osrs-service-tile group"
              >
                <div className="h-32">
                  <CardArtwork card={card} kind="service" index={index} />
                </div>
                <span className="display-type block px-3 py-3 text-center text-lg uppercase">
                  {card.title}
                </span>
              </Link>
            ))}
          </div>
          <div className="mt-3 text-right">
            <Link className="osrs-view-all" href="/services">
              View all services{" "}
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        </section>
      ) : null}

      {featuredSection?.enabled !== false && featured.length ? (
        <section className="osrs-featured-wrap border-primary/20 border-y py-12">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 className="display-type text-3xl uppercase">
                {featuredSection?.title ?? "Featured Services"}
              </h2>
              <Link className="osrs-view-all" href="/services">
                View all services{" "}
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
            <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {featured.map((card, index) => (
                <article key={card.id} className="osrs-feature-card group">
                  <div className="relative h-40">
                    <CardArtwork card={card} kind="featured" index={index} />
                    {card.badge ? (
                      <span className="osrs-promo-badge">{card.badge}</span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-4">
                    {card.categoryLabel ? (
                      <p className="text-primary text-[0.62rem] font-black tracking-[0.15em] uppercase">
                        {card.categoryLabel}
                      </p>
                    ) : null}
                    <h3 className="display-type mt-2 text-xl uppercase">
                      {card.title}
                    </h3>
                    <p className="text-text-muted mt-2 text-xs leading-5">
                      {card.description}
                    </p>
                    {card.bullets.length ? (
                      <ul className="text-text-secondary mt-4 space-y-2 text-xs">
                        {card.bullets.map((bullet) => (
                          <li key={bullet} className="flex gap-2">
                            <Check
                              className="text-primary mt-0.5 size-3.5 shrink-0"
                              aria-hidden="true"
                            />
                            {bullet}
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    <div className="mt-auto flex items-end justify-between gap-3 pt-5">
                      {card.priceLabel ? (
                        <div>
                          <span className="text-text-muted block text-[0.58rem] font-bold uppercase">
                            From
                          </span>
                          <strong className="text-primary text-lg">
                            {card.priceLabel}
                          </strong>
                          {card.oldPriceLabel ? (
                            <del className="text-text-muted ml-2 text-xs">
                              {card.oldPriceLabel}
                            </del>
                          ) : null}
                        </div>
                      ) : (
                        <span />
                      )}
                      <Link href={card.href} className="osrs-order-button">
                        {card.ctaText}
                      </Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      <section className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
        <div className="grid gap-7 xl:grid-cols-[1.05fr_2fr] xl:items-stretch">
          <div className="osrs-why-panel p-6">
            <h2 className="display-type text-2xl uppercase">
              Why choose <span className="text-primary">OSRS Services?</span>
            </h2>
            <ul className="text-text-secondary mt-5 space-y-2.5 text-sm">
              {[
                "Experienced and verified boosters",
                "Safe, hand-played methods",
                "24/7 customer support",
                "Clear order communication",
                "Trusted service workflows",
              ].map((item) => (
                <li key={item} className="flex items-center gap-2">
                  <span className="bg-primary flex size-4 items-center justify-center rounded-full text-[0.65rem] text-white">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {launchMetrics.map(({ icon: Icon, value, label }) => (
              <div key={label} className="osrs-metric-card">
                <Icon className="text-primary size-8" aria-hidden="true" />
                <strong className="display-type mt-4 text-3xl">{value}</strong>
                <span className="text-text-secondary mt-1 text-center text-[0.62rem] font-bold tracking-[0.06em] uppercase">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-text-muted mt-3 text-right text-[0.65rem]">
          * Illustrative layout values; replace with client-verified metrics
          before launch.
        </p>
      </section>
    </main>
  );
}
