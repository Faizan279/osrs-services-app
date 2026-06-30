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

## Task 001 foundation

The current UI intentionally contains placeholders only. The homepage and business modules remain later tasks.

### Requirements

- Node.js 24 LTS
- pnpm 11.7+
- Docker with Docker Compose

Node 24 is selected because it is the current LTS line and is supported by Hostinger managed Node.js hosting.

### Local setup

```bash
cp .env.example .env
```

Set `AUTH_SECRET` to at least 32 random characters. To seed a local Super Admin, also set `ADMIN_SEED_EMAIL` and `ADMIN_SEED_PASSWORD` together. There is no default password.

`DATABASE_ALLOW_PUBLIC_KEY_RETRIEVAL=true` supports the non-TLS Docker MySQL account locally. Leave it disabled in production and use the database provider's TLS configuration.

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
pnpm exec playwright install chromium
pnpm test:e2e
pnpm screenshots:task001
pnpm build
```

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
