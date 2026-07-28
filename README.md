# OSRS Services Web Application

A custom, full-stack web application replacing the existing WordPress/WooCommerce website at `osrsservices.com`.

## Product objective

Create an original, premium OSRS commerce and service platform combining:

- A Bald.gg-inspired premium homepage rhythm and special-service presentation
- MyPvM-inspired calculators, gold flows, account listings, membership, and commerce patterns
- Firstseller-inspired quests, diaries, minigames, PvM catalogues, filters, game modes, and requirement modals
- The established OSRS Services black, white, and bright-green brand identity

The final product must not look like a direct clone of any reference website.

## Launch scope

The planned launch includes:

- Public storefront
- Service catalogues and calculators
- Guest and customer checkout
- Customer dashboard
- Complete admin panel
- Inventory and pricing management
- Three staff roles
- Custom live chat
- RSN eligibility checker
- Quotes, discounts, reviews, notifications, reports, audit logs, feature flags, exports, and migration
- Payment user interfaces and provider-ready adapters
- Responsive desktop, tablet, and mobile interfaces

Live payment activation will occur after the client obtains approved payment-provider accounts and credentials.

## Task 002 public homepage

The public route now contains the complete Task 002 homepage, responsive navigation, accessible service menu, mobile drawer, FAQ, conversion sections, and footer. Catalogue engines, pricing, checkout, legal pages, live chat, and other business modules remain later tasks.

The official transparent OSRS Services logo is stored at `public/branding/osrs-services-logo.png`. Set `NEXT_PUBLIC_DISCORD_URL` only when a verified support or invitation URL is available; otherwise Discord calls to action safely return to the homepage support section.

## Task 003 catalogue foundation

The application now includes a normalized MySQL-backed catalogue, capability-protected category and service management, immutable publication revisions, catalogue audit events, and public service discovery at `/services`.

Admin catalogue routes require `products.view`; every create, update, duplicate, publish, archive, requirement and media mutation independently requires `products.edit` on the server. Drafts and archived or out-of-schedule services are excluded from public queries. Public projections explicitly omit internal notes, legacy metadata and actor relations.

The additive migration is `20260701180000_task003_catalogue_foundation`. It creates catalogue tables and foreign keys without altering or deleting Task 001 authentication, role, session, feature-flag or audit data. Rollback is intentionally manual: archive or unpublish catalogue content first, retain an export if content must be preserved, then remove the catalogue foreign keys and tables in reverse dependency order. Do not use `prisma migrate reset` against a shared or production database.

Catalogue seeds add missing taxonomy and four development-safe quote-only services. Existing seeded categories, public copy, requirements, publication states, availability and display order are not overwritten on rerun. Managed media upload/storage, pricing, service engines, cart and checkout remain deferred.

## Task 004 catalogue cards and eligibility

`CATALOGUE_CARD` pages now render normalized offerings with server-backed search, URL-shareable facets and game-mode filters, stable pagination, inherited modes, bounded quantity metadata, and accessible requirement dialogs. Admin offering changes use Task 003 staging, revisions, audits, permissions, and version conflicts.

The optional `/api/catalogue/eligibility` POST flow never puts an RSN in a public URL or requests a password. A server-only official Hiscores provider is protected by timeout, size, and parser limits; short database cache windows and an HMAC-keyed database rate limiter protect the lookup. `rsn_eligibility_enabled` defaults off and `catalogue_card_engine_enabled` defaults on; seed reruns preserve both.

## Task 005 skilling calculator

`SKILLING_CALCULATOR` pages now render a public skilling calculator backed by service-scoped skilling skills, methods and calculator rules. The calculator supports level and XP input modes, exact OSRS XP thresholds, account-mode adjustments, optional supplies, optional Discord Stream and configured delivery speed.

Estimates are calculated through `POST /api/skilling/estimate` with no-store responses and server-side catalogue/rule lookup. They are preview-only and show `Estimated total` plus the final-price disclaimer; cart, checkout, orders, payment records and quote creation remain later tasks.

Admin users with `products.view` can view skilling configuration under `/admin/catalogue/services/[id]/skilling`; edits require `products.edit` server-side. Published skilling edits use the Task 003 staged aggregate and remain private until republish. `skilling_calculator_enabled` is seeded off by default while seeded prices/rules are marked `Needs client review`; seed reruns preserve administrator changes to that flag.

## Task 006 bossing calculator

`BOSSING_ENGINE` pages now support a public bossing/PvM calculator backed by service-scoped boss configs, methods, calculator rules, stat requirements and gear requirements. The calculator supports direct kill quantity, current KC to target KC, account-mode adjustments, optional supplies, optional Discord Stream, customer-provided gear confirmation and configured delivery speed.

Estimates are calculated through `POST /api/bossing/estimate` with no-store responses and server-side catalogue/rule lookup. They are preview-only and show `Estimated total` plus the final-price disclaimer; cart, checkout, orders, payment records, premium configurators and quote creation remain later tasks.

Admin users with `products.view` can view bossing configuration under `/admin/catalogue/services/[id]/bossing`; edits require `products.edit` server-side. Published bossing edits use the Task 003 staged aggregate and remain private until republish. `bossing_calculator_enabled` is seeded off by default while seeded prices/rules are marked `Needs client review`; seed reruns preserve administrator changes to that flag.

## Task 007 premium service configurator

`PREMIUM_SERVICE_CONFIGURATOR` pages now support a public premium configurator backed by service-scoped premium packages, options, calculator rules, requirement groups and FAQs. The configurator supports package selection, account-mode adjustments, optional public RSN stat checks, manual/no-RSN operation, customer gear confirmation, optional add-ons, optional Discord Stream and configured delivery speed.

Estimates are calculated through `POST /api/premium/estimate` with no-store responses and server-side catalogue/rule lookup. They are preview-only and show `Estimated total` plus the final-price disclaimer; cart, checkout, quotes, orders and payment records remain later tasks.

Admin users with `products.view` can view premium configuration under `/admin/catalogue/services/[id]/premium`; edits require `products.edit` server-side. Published premium edits use the Task 003 staged aggregate and remain private until republish. `premium_configurator_enabled` is seeded off by default while seeded package prices/rules are marked `Needs client review`; seed reruns preserve administrator changes to that flag.

## Task 008 global pricing foundation

Global pricing now sits above the skilling, bossing and premium estimate engines. Each engine still calculates its server-authoritative base subtotal first; when `global_pricing_enabled` is enabled, the latest published pricing revision can append fixed additions, percentage additions, minimum totals or maximum totals.

Admin users with `pricing.view` can access `/admin/pricing`; edits require `pricing.edit`; publish, discard and restore require `pricing.publish`. Seeds create a neutral draft rule set and neutral published revision, with `global_pricing_enabled` disabled so Task 005-007 public estimate behavior remains unchanged until the client approves pricing rules.

## Task 009 gold trading engine

`GOLD_ENGINE` pages now support a public gold trading estimator for `/services/gold/gold-trading` and convenience route `/gold`. Customers can choose Buy Gold or Sell Gold, configured presets or custom million-GP quantities, RSN, and an optional Secure 100+ Combat Service where staff enable it.

Gold quantities are represented as whole-GP `BigInt` values on the server and serialized as decimal strings in JSON and snapshots. Rates are integer minor units per 1,000,000 GP. Rounding is deterministic half-up to whole minor units: `rateMinorUnitsPerMillion * quantityGp + 500000`, then integer-divide by `1000000`.

Public estimates are calculated through `POST /api/gold/estimate` with no-store responses. The route loads the published gold-rate revision, market balances, limits and secure-service config server-side, ignores client-submitted rates or totals, excludes RSNs from snapshots, and never reserves or deducts stock. Customer-buy estimates may receive Task 008 global-pricing additions when `global_pricing_enabled` is enabled; customer-sell payouts intentionally bypass customer-charge global additions.

Admin users with `gold.view` can access `/admin/gold`; edits require `gold.edit`; publish/discard/restore require `gold.publish`; inventory and buying-capacity adjustments require `gold.inventory.adjust`. Seeds create the Gold category/service, one paused gold market, draft buy/sell rates, presets, zero live balances, no default published gold revision, and `gold_engine_enabled=false`.

## Task 010 account marketplace engine

`ACCOUNT_MARKETPLACE` pages now support preview-only public browsing at `/accounts` and listing details at `/accounts/[listingSlug]`. Public APIs are `GET /api/accounts`, `GET /api/accounts/[listingSlug]`, and `POST /api/accounts/estimate`. The server loads listing price, approval, publication and availability state; client-submitted prices, totals, revisions, availability and global adjustments are ignored.

Account listing snapshots are JSON-safe and contain public stats, unlock references, feature references, cover image references, immutable published listing revision data and optional Task 008 global-pricing lines. They exclude login identifiers, passwords, email addresses, recovery data, authenticator data, bank PINs, internal notes, hold actors and customer contact data.

Admin users with `accounts.view` can access `/admin/accounts`; edits require `accounts.edit`; approval requires `accounts.approve`; publish/discard/restore requires `accounts.publish`; holds, sold state and availability require `accounts.availability.manage`; secure-handover readiness requires `accounts.handover.review`. Seeds create the Accounts category/service, one account marketplace, representative public-safe listings, stats, unlocks, features, media and `account_marketplace_enabled=false`.

### Requirements

- Node.js 24 LTS
- pnpm 11.7+
- Docker with Docker Compose, only when running the local MySQL stack

Node 24 is selected because it is the current LTS line and is supported by Hostinger managed Node.js hosting.

### Local setup

```bash
cp .env.example .env
```

Set `AUTH_SECRET` to at least 32 random characters. To seed a local Super Admin, also set `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` together. There is no default password.

Normal seed runs preserve an existing administrator password. Set `ADMIN_SEED_RESET_PASSWORD=true` only for a deliberate password reset, with both administrator seed credentials supplied; return it to `false` immediately afterward. Seed reruns also preserve feature-flag activation states and existing role-permission assignments while adding any missing defaults.

`DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL=true` supports the non-TLS Docker MySQL account locally. Leave it disabled in production and use the database provider's TLS configuration.

Local MySQL is optional for Task 007, Task 008, Task 009 and Task 010 handoff validation. Task-specific GitHub Actions workflows, including `.github/workflows/task010-validation.yml`, run migrations, seeds, unit tests, E2E tests, screenshots and review-pack generation against temporary GitHub-hosted MySQL 8.4 service containers. Those CI credentials are disposable validation-only values and are not production secrets.

```bash
pnpm install --frozen-lockfile
docker compose up -d
docker compose ps
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open:

- App: `http://127.0.0.1:3000`
- Login: `http://127.0.0.1:3000/login`
- Health: `http://127.0.0.1:3000/health`
- Mailpit: `http://127.0.0.1:8025`

### Quality gates

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:seed
pnpm exec playwright install chromium
pnpm test:e2e
pnpm screenshots:task001
pnpm screenshots:task002
pnpm screenshots:task003
pnpm screenshots:task004
pnpm screenshots:task005
pnpm screenshots:task006
pnpm screenshots:task007
pnpm screenshots:task008
pnpm screenshots:task009
pnpm format:check
pnpm build
```

Task 002 through Task 010 screenshot capture expects the app to be running at `http://127.0.0.1:3000`. `PLAYWRIGHT_BASE_URL` may override that address, and `PLAYWRIGHT_EXECUTABLE_PATH` may point to an existing Chromium installation when the pinned Playwright browser is not installed locally.

For Task 010, the GitHub Actions workflow uploads Playwright results, screenshots, validation reports and the final review ZIP as workflow artifacts. Production deployment still requires a real persistent MySQL database and must not use the temporary CI service container.

### Database commands

```bash
pnpm db:generate
pnpm db:migrate
pnpm db:seed
pnpm db:reset
```

`db:reset` is destructive and is for disposable local databases only. Production changes use committed migrations and `pnpm db:migrate`.

### Authentication and authorization

- Email/password credentials use Argon2id hashes.
- Opaque session secrets are held in secure, HTTP-only, same-site cookies; only HMAC digests are stored in MySQL.
- Proxy checks provide the first redirect boundary. Server layouts then validate the database session and required capability.
- The Super Admin seed is created only when both environment variables are explicitly supplied.

### Local services

`docker-compose.yml` provides MySQL 8.4 and Mailpit with health checks. Stop services with `docker compose down`; preserve the database volume unless an intentional reset is required.
