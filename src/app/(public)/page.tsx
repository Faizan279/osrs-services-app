import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { ReferenceArt } from "@/components/reference-art";
import { StoreTrustStrip } from "@/components/store-trust-strip";
import Link from "next/link";

import {
  defaultHomepageSections,
  fallbackHomepageCards,
  type HomepageCard,
} from "@/lib/homepage/core";

const title = "OSRS Services | Hand-Played Boosting & Marketplace";
export const dynamic = "force-dynamic";
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
  const featured = cards.filter(
    (card) => card.placement === "FEATURED_SERVICE",
  );
  const mainServices = [
    ["Skills", "/skills", "Level up your account"],
    ["Bossing", "/bossing", "Choose your next challenge"],
    ["Infernal", "/infernal", "Claim your cape"],
    ["Quests", "/quests", "Complete your journey"],
    ["Diaries", "/diaries", "Unlock new content"],
    ["Gold", "/gold", "See the current gold rate"],
    ["Items", "/products", "Find your next upgrade"],
    ["Accounts", "/accounts", "Explore available accounts"],
    ["Misc Gathering", "/misc-gathering", "Resources, runs and more"],
  ] as const;
  return (
    <main id="main-content" className="reference-home">
      <section className="reference-home-hero">
        <div className="reference-home-art" />
        <div className="reference-home-copy">
          <p className="reference-eyebrow">
            Professional OSRS boosting services
          </p>
          <h1>
            CONQUER
            <br />
            ACHIEVE
            <br />
            <em>LEVEL UP</em>
          </h1>
          <h2>Trusted OSRS Services</h2>
          <p>Hand trained · Clear pricing · Personal support</p>
          <div className="reference-home-actions">
            <a className="reference-primary-button" href="#main-services">
              Browse Services <ArrowRight size={18} />
            </a>
            <Link className="reference-secondary-button" href="/support">
              Contact our team
            </Link>
          </div>
        </div>
        <p className="reference-home-quote">
          More than a service.
          <br />A gaming partner.
        </p>
      </section>
      <StoreTrustStrip />
      {serviceSection?.enabled && (
        <section className="reference-home-services" id="main-services">
          <div className="reference-section-heading">
            <div>
              <h2>{serviceSection.title.toUpperCase()}</h2>
              <p>
                Everything you need for your OSRS journey, all in one place.
              </p>
            </div>
            <span>
              PLAY BETTER
              <br />
              <strong>ACHIEVE MORE</strong>
            </span>
          </div>
          <div className="reference-home-service-grid">
            {mainServices.map(([name, href, description], index) => (
              <Link className="reference-home-service" href={href} key={href}>
                {index < 8 ? (
                  <ReferenceArt
                    board="home"
                    crop={[45 + index * 182, 654, 162, 128]}
                    className="reference-home-service-art"
                  />
                ) : (
                  <span className="reference-home-service-art gathering-tile-art" />
                )}
                <h3>{name}</h3>
                <p>{description}</p>
                <span className="reference-card-link">
                  View Services <ArrowRight size={15} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {categorySection?.enabled && (
        <section className="reference-home-categories">
          <h2>{categorySection.title}</h2>
          <div>
            {categories.map((card, index) => (
              <Link
                href={card.href}
                key={card.id}
                className="reference-category"
              >
                <span className="reference-category-art">
                  <CardArtwork card={card} kind="category" index={index} />
                </span>
                <h3>{card.title}</h3>
                <p>{card.description}</p>
                <span>
                  {card.ctaText} <ArrowRight size={16} />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}
      {featuredSection?.enabled && featured.length > 0 && (
        <section className="reference-featured">
          <h2>{featuredSection.title}</h2>
          <div>
            {featured.map((card, index) => (
              <Link href={card.href} key={card.id}>
                <span className="reference-featured-art">
                  <CardArtwork card={card} kind="featured" index={index} />
                </span>
                <div>
                  <h3>{card.title}</h3>
                  <p>{card.description}</p>
                  <strong>{card.priceLabel}</strong>
                </div>
                <ArrowRight size={18} />
              </Link>
            ))}
          </div>
        </section>
      )}
      {serviceSection?.enabled &&
        cards.some((card) => card.placement === "MAIN_SERVICE") && (
          <section className="reference-featured">
            <h2>More Services</h2>
            <div>
              {cards
                .filter((card) => card.placement === "MAIN_SERVICE")
                .map((card, index) => (
                  <Link href={card.href} key={card.id}>
                    <span className="reference-featured-art">
                      <CardArtwork card={card} kind="service" index={index} />
                    </span>
                    <div>
                      <h3>{card.title}</h3>
                      <p>{card.description}</p>
                      {card.badge && <small>{card.badge}</small>}
                      <strong>{card.priceLabel}</strong>
                      <p>{card.ctaText}</p>
                    </div>
                    <ArrowRight size={18} />
                  </Link>
                ))}
            </div>
          </section>
        )}
    </main>
  );
}
