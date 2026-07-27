import type { Metadata } from "next";
import { CheckCircle2, CircleAlert, Clock3, Gamepad2 } from "lucide-react";
import { notFound } from "next/navigation";

import { CatalogueBreadcrumbs } from "@/components/catalogue-public";
import { BossingCalculatorEngine } from "@/components/bossing-calculator-engine";
import { CatalogueCardEngine } from "@/components/catalogue-card-engine";
import { GoldTradingEngine } from "@/components/gold-trading-engine";
import { PremiumConfiguratorEngine } from "@/components/premium-configurator-engine";
import { SkillingCalculatorEngine } from "@/components/skilling-calculator-engine";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getDiscordHref } from "@/config/public-navigation";
import {
  catalogueGameModes,
  formatEnumLabel,
  gameModeLabels,
} from "@/lib/catalogue/constants";
import { publicPrimaryMedia } from "@/lib/catalogue/public-select";
import {
  getCatalogueFeatureFlags,
  getPublicBossingCalculatorService,
  getPublicCatalogueCardService,
  getPublicPremiumConfiguratorService,
  getPublicSkillingCalculatorService,
  getPublicService,
} from "@/lib/catalogue/queries";
import { getPublicGoldTradingService } from "@/lib/gold/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ categorySlug: string; serviceSlug: string }>;
}): Promise<Metadata> {
  const { categorySlug, serviceSlug } = await params;
  const service = await getPublicService(categorySlug, serviceSlug);
  if (!service) return { title: "Service not found" };
  const primaryMedia = publicPrimaryMedia(service);
  return {
    title: service.seoTitle ?? service.name,
    description: service.seoDescription ?? service.shortSummary,
    alternates: { canonical: `/services/${categorySlug}/${serviceSlug}` },
    openGraph: {
      title: service.seoTitle ?? service.name,
      description: service.seoDescription ?? service.shortSummary,
      url: `/services/${categorySlug}/${serviceSlug}`,
      ...(primaryMedia
        ? {
            images: [
              { url: primaryMedia.assetPath, alt: primaryMedia.altText },
            ],
          }
        : {}),
    },
  };
}

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ categorySlug: string; serviceSlug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { categorySlug, serviceSlug } = await params;
  const query = await searchParams;
  const service = await getPublicService(categorySlug, serviceSlug);
  if (!service) notFound();
  const discordHref = getDiscordHref();
  if (service.engineType === "CATALOGUE_CARD") {
    const search = typeof query.q === "string" ? query.q.slice(0, 80) : "";
    const mode =
      typeof query.mode === "string" &&
      catalogueGameModes.includes(
        query.mode as (typeof catalogueGameModes)[number],
      )
        ? query.mode
        : "";
    const sort =
      query.sort === "name" || query.sort === "order" ? query.sort : "featured";
    const page = Math.max(
      1,
      Number(typeof query.page === "string" ? query.page : 1) || 1,
    );
    const facets = Object.entries(query)
      .filter(
        ([key, value]) => key.startsWith("f_") && typeof value === "string",
      )
      .map(([key, value]) => ({
        key: key.slice(2, 82),
        value: String(value).slice(0, 120),
      }))
      .filter(
        ({ key, value }) =>
          /^[a-z0-9-]+$/.test(key) && /^[a-z0-9-]+$/.test(value),
      );
    const [engine, flags] = await Promise.all([
      getPublicCatalogueCardService({
        categorySlug,
        serviceSlug,
        search,
        gameMode: mode || undefined,
        facets,
        sort,
        page,
      }),
      getCatalogueFeatureFlags(),
    ]);
    if (engine && flags.catalogue_card_engine_enabled) {
      const facetRecord = Object.fromEntries(
        facets.map((facet) => [facet.key, facet.value]),
      );
      return (
        <main id="main-content" className="min-h-[70vh]">
          <section className="border-border bg-surface-1 border-b py-14 sm:py-20">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <CatalogueBreadcrumbs
                items={[
                  { label: "Home", href: "/" },
                  { label: "Services", href: "/services" },
                  {
                    label: service.category.name,
                    href: `/services/${service.category.slug}`,
                  },
                  { label: service.name },
                ]}
              />
              {service.isQuoteOnly && (
                <Badge className="mt-8" variant="warning">
                  Quote only
                </Badge>
              )}
              <p className="text-gold kicker-type mt-8">
                {service.category.name}
              </p>
              <h1 className="display-type mt-4 max-w-4xl text-4xl sm:text-6xl">
                {service.name}
              </h1>
              <p className="text-text-secondary mt-5 max-w-3xl text-lg leading-8">
                {service.shortSummary}
              </p>
            </div>
          </section>
          <CatalogueCardEngine
            service={{
              id: engine.service.id,
              name: engine.service.name,
              content: engine.service.content,
              requirements: engine.service.requirements,
              gameModes: engine.service.gameModes,
            }}
            offerings={engine.offerings}
            availableFacets={engine.availableFacets}
            total={engine.total}
            page={engine.page}
            pages={engine.pages}
            filters={{ search, gameMode: mode, sort, facets: facetRecord }}
            eligibilityEnabled={Boolean(flags.rsn_eligibility_enabled)}
            requestHref={discordHref}
          />
        </main>
      );
    }
  }
  if (service.engineType === "SKILLING_CALCULATOR") {
    const [engine, flags] = await Promise.all([
      getPublicSkillingCalculatorService({ categorySlug, serviceSlug }),
      getCatalogueFeatureFlags(),
    ]);
    if (engine && flags.skilling_calculator_enabled) {
      return (
        <main id="main-content" className="min-h-[70vh]">
          <section className="border-border bg-surface-1 border-b py-14 sm:py-20">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <CatalogueBreadcrumbs
                items={[
                  { label: "Home", href: "/" },
                  { label: "Services", href: "/services" },
                  {
                    label: service.category.name,
                    href: `/services/${service.category.slug}`,
                  },
                  { label: service.name },
                ]}
              />
              <div className="mt-8 flex flex-wrap gap-2">
                <Badge variant="info">Skilling calculator</Badge>
                {service.isQuoteOnly && (
                  <Badge variant="warning">Quote only</Badge>
                )}
              </div>
              <p className="text-gold kicker-type mt-8">
                {service.category.name}
              </p>
              <h1 className="display-type mt-4 max-w-4xl text-4xl sm:text-6xl">
                {service.name}
              </h1>
              <p className="text-text-secondary mt-5 max-w-3xl text-lg leading-8">
                {service.shortSummary}
              </p>
            </div>
          </section>
          <SkillingCalculatorEngine
            service={{
              id: engine.service.id,
              name: engine.service.name,
              content: engine.service.content,
              requirements: engine.service.requirements,
              gameModes: engine.service.gameModes,
            }}
            skills={engine.skills}
            rule={engine.rule}
            requestHref={discordHref}
          />
        </main>
      );
    }
  }
  if (service.engineType === "BOSSING_ENGINE") {
    const [engine, flags] = await Promise.all([
      getPublicBossingCalculatorService({ categorySlug, serviceSlug }),
      getCatalogueFeatureFlags(),
    ]);
    if (engine && flags.bossing_calculator_enabled) {
      return (
        <main id="main-content" className="min-h-[70vh]">
          <section className="border-border bg-surface-1 border-b py-14 sm:py-20">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <CatalogueBreadcrumbs
                items={[
                  { label: "Home", href: "/" },
                  { label: "Services", href: "/services" },
                  {
                    label: service.category.name,
                    href: `/services/${service.category.slug}`,
                  },
                  { label: service.name },
                ]}
              />
              <div className="mt-8 flex flex-wrap gap-2">
                <Badge variant="info">Bossing calculator</Badge>
                {service.isQuoteOnly && (
                  <Badge variant="warning">Quote only</Badge>
                )}
              </div>
              <p className="text-gold kicker-type mt-8">
                {service.category.name}
              </p>
              <h1 className="display-type mt-4 max-w-4xl text-4xl sm:text-6xl">
                {service.name}
              </h1>
              <p className="text-text-secondary mt-5 max-w-3xl text-lg leading-8">
                {service.shortSummary}
              </p>
            </div>
          </section>
          <BossingCalculatorEngine
            service={{
              id: engine.service.id,
              name: engine.service.name,
              content: engine.service.content,
              requirements: engine.service.requirements,
              gameModes: engine.service.gameModes,
            }}
            bosses={engine.bosses}
            rule={engine.rule}
            requestHref={discordHref}
            eligibilityEnabled={Boolean(flags.rsn_eligibility_enabled)}
          />
        </main>
      );
    }
  }
  if (service.engineType === "PREMIUM_SERVICE_CONFIGURATOR") {
    const [engine, flags] = await Promise.all([
      getPublicPremiumConfiguratorService({ categorySlug, serviceSlug }),
      getCatalogueFeatureFlags(),
    ]);
    if (engine && flags.premium_configurator_enabled) {
      return (
        <main id="main-content" className="min-h-[70vh]">
          <section className="border-border bg-surface-1 border-b py-14 sm:py-20">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <CatalogueBreadcrumbs
                items={[
                  { label: "Home", href: "/" },
                  { label: "Services", href: "/services" },
                  {
                    label: service.category.name,
                    href: `/services/${service.category.slug}`,
                  },
                  { label: service.name },
                ]}
              />
              <div className="mt-8 flex flex-wrap gap-2">
                <Badge variant="info">Premium configurator</Badge>
                {service.isQuoteOnly && (
                  <Badge variant="warning">Quote only</Badge>
                )}
              </div>
              <p className="text-gold kicker-type mt-8">
                {service.category.name}
              </p>
              <h1 className="display-type mt-4 max-w-4xl text-4xl sm:text-6xl">
                {service.name}
              </h1>
              <p className="text-text-secondary mt-5 max-w-3xl text-lg leading-8">
                {service.shortSummary}
              </p>
            </div>
          </section>
          <PremiumConfiguratorEngine
            service={{
              id: engine.service.id,
              name: engine.service.name,
              content: engine.service.content,
              requirements: engine.service.requirements,
              gameModes: engine.service.gameModes,
            }}
            packages={engine.packages}
            options={engine.options}
            rule={engine.rule}
            requestHref={discordHref}
            eligibilityEnabled={Boolean(flags.rsn_eligibility_enabled)}
          />
        </main>
      );
    }
  }
  if (service.engineType === "GOLD_ENGINE") {
    const engine = await getPublicGoldTradingService({
      categorySlug,
      serviceSlug,
    });
    if (engine) {
      return (
        <main id="main-content" className="min-h-[70vh]">
          <section className="border-border bg-surface-1 border-b py-14 sm:py-20">
            <div className="mx-auto max-w-7xl px-5 sm:px-8">
              <CatalogueBreadcrumbs
                items={[
                  { label: "Home", href: "/" },
                  { label: "Services", href: "/services" },
                  {
                    label: service.category.name,
                    href: `/services/${service.category.slug}`,
                  },
                  { label: service.name },
                ]}
              />
              <div className="mt-8 flex flex-wrap gap-2">
                <Badge variant="info">Gold trading</Badge>
                {service.isQuoteOnly && (
                  <Badge variant="warning">Quote only</Badge>
                )}
              </div>
              <p className="text-gold kicker-type mt-8">
                {service.category.name}
              </p>
              <h1 className="display-type mt-4 max-w-4xl text-4xl sm:text-6xl">
                {service.name}
              </h1>
              <p className="text-text-secondary mt-5 max-w-3xl text-lg leading-8">
                {service.shortSummary}
              </p>
            </div>
          </section>
          <GoldTradingEngine
            service={{
              id: engine.service.id,
              name: engine.service.name,
              content: engine.service.content,
              requirements: engine.service.requirements.map(
                ({ id, title, description, isRequired, verificationMode }) => ({
                  id,
                  title,
                  description,
                  isRequired,
                  verificationMode,
                }),
              ),
            }}
            market={engine.market}
            presets={engine.presets}
            latestRevision={engine.latestRevision}
            featureEnabled={engine.featureEnabled}
            requestHref={discordHref}
          />
        </main>
      );
    }
  }
  return (
    <main id="main-content" className="min-h-[70vh]">
      <section className="border-border bg-surface-1 border-b py-14 sm:py-20">
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <CatalogueBreadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Services", href: "/services" },
              {
                label: service.category.name,
                href: `/services/${service.category.slug}`,
              },
              { label: service.name },
            ]}
          />
          <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant={
                    service.availabilityState === "AVAILABLE"
                      ? "success"
                      : service.availabilityState === "PAUSED"
                        ? "warning"
                        : "danger"
                  }
                >
                  {formatEnumLabel(service.availabilityState)}
                </Badge>
                {service.isQuoteOnly && (
                  <Badge variant="warning">Quote only</Badge>
                )}
              </div>
              <p className="text-gold kicker-type mt-6">
                {service.category.name}
              </p>
              <h1 className="display-type mt-4 max-w-4xl text-4xl sm:text-6xl">
                {service.name}
              </h1>
              <p className="text-text-secondary mt-5 max-w-3xl text-lg leading-8">
                {service.shortSummary}
              </p>
            </div>
            <aside className="border-border bg-background/55 rounded-2xl border p-6">
              <p className="text-text-muted text-xs font-bold tracking-wider uppercase">
                Service request
              </p>
              <h2 className="display-type mt-3 text-2xl">
                Request a tailored quote
              </h2>
              <p className="text-text-secondary mt-3 text-sm leading-6">
                Pricing and expected timing are confirmed after your
                requirements are reviewed.
              </p>
              <Button asChild className="mt-6 w-full">
                <a href={discordHref}>Request a quote</a>
              </Button>
            </aside>
          </div>
        </div>
      </section>
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:py-16">
        <div className="space-y-12">
          <section>
            <h2 className="display-type text-3xl">About this service</h2>
            <div className="text-text-secondary mt-5 space-y-4 leading-7">
              {service.content.split(/\n{2,}/).map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </div>
          </section>
          {service.requirements.length > 0 && (
            <section>
              <h2 className="display-type text-3xl">Requirements</h2>
              <ul className="mt-5 grid gap-4">
                {service.requirements.map((requirement) => (
                  <li
                    key={requirement.id}
                    className="border-border bg-surface-1 flex gap-4 rounded-2xl border p-5"
                  >
                    <CheckCircle2
                      className="text-primary mt-0.5 size-5 shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <h3 className="font-bold">
                        {requirement.title}
                        {requirement.isRequired && (
                          <span className="text-gold ml-2 text-xs">
                            Required
                          </span>
                        )}
                      </h3>
                      <p className="text-text-secondary mt-2 text-sm leading-6">
                        {requirement.description}
                      </p>
                      <p className="text-text-muted mt-2 text-xs">
                        {formatEnumLabel(requirement.verificationMode)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          {service.publicPreparationNotes && (
            <section>
              <h2 className="display-type text-3xl">Before you request</h2>
              <div className="border-info/30 bg-info/10 text-text-secondary mt-5 flex gap-4 rounded-2xl border p-5 leading-7">
                <CircleAlert
                  className="text-info mt-1 size-5 shrink-0"
                  aria-hidden="true"
                />
                <p>{service.publicPreparationNotes}</p>
              </div>
            </section>
          )}
        </div>
        <aside className="space-y-5">
          <div className="border-border bg-surface-1 rounded-2xl border p-5">
            <h2 className="text-sm font-bold">Supported game modes</h2>
            <ul className="mt-4 space-y-3">
              {service.gameModes.map(({ gameMode }) => (
                <li
                  className="text-text-secondary flex items-center gap-3 text-sm"
                  key={gameMode}
                >
                  <Gamepad2
                    className="text-primary size-4"
                    aria-hidden="true"
                  />
                  {gameModeLabels[gameMode]}
                </li>
              ))}
            </ul>
          </div>
          <div className="border-border bg-surface-1 rounded-2xl border p-5">
            <h2 className="text-sm font-bold">Availability</h2>
            <p className="text-text-secondary mt-3 flex items-center gap-3 text-sm">
              <Clock3 className="text-gold size-4" aria-hidden="true" />
              {formatEnumLabel(service.availabilityState)}
            </p>
            <p className="text-text-muted mt-3 text-xs leading-5">
              Pricing and expected timing are confirmed after your requirements
              are reviewed.
            </p>
          </div>
        </aside>
      </div>
    </main>
  );
}
