# Screenshot-led OSRS storefront completion

## Task

- Task: follow-up visual implementation of the client's OSRS reference screenshots.
- Branch: `main`, repository `itwillbedope/osrs-services-app`.
- Date: 2026-09-10.
- Baseline: `7af8dfb6f18af3460714ab693dda62b6d8883c34`.
- Final commit SHA: supplied in the delivery message and GitHub commit history; this report is included in that commit.

## Summary and routes

This is a second, substantive presentation overhaul, not a cache workaround. It replaces the previous oversized storefront with compact black/red/gold layouts based on the client boards, while retaining the existing server-authoritative ordering engines.

| Module / route              | Delivered change                                                                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Homepage `/`                | Compact fiery hero, stacked headline, trust strip, nine illustrated direct service shortcuts, preserved Admin-managed categories, featured cards and service promotions.  |
| Shared navigation           | Compact red official wordmark, direct service links, active states, keyboard-accessible service search, cart/login links, mobile focus-trapped menu.                      |
| Skills `/skills`            | Left skill grid/search/information, right levels or XP inputs, selectable training methods, account/delivery options and automatic quote/cart.                            |
| Bossing `/bossing`          | Dense portrait grid, search/group filters, selected-boss configurator and summary; original KC, account, gear, supplies and requirements logic retained.                  |
| Infernal `/infernal`        | Illustrated cape column, manual combat stats, weapon/account/gear options, configurable service method and server-confirmed quote with cart action.                       |
| Quests `/quests`            | Searchable, filterable selection table, quest points, prices and available metadata, live multi-selection summary and dependency handling.                                |
| Diaries `/diaries`          | Twelve illustrated region cards, tier buttons, multi-selection and existing lower-tier dependency pricing.                                                                |
| Gold `/gold`                | Published preset cards with base prices, custom amount and RSN, buy/sell modes and right-hand availability/quote summary.                                                 |
| Items `/products`           | Marketplace table with variants, quantity steppers, automatic server estimates and inline cart actions. Search/filter/sort/pagination and product detail routes retained. |
| Gathering `/misc-gathering` | Illustrated resource cards and quantity configuration, right-hand summary; direct homepage navigation retained.                                                           |

Major services remain directly accessible rather than requiring category-description pages. Existing legacy redirects were retained and retested; no additional routes were deleted. Accounts, checkout, staff screens and backend commercial rules were not redesigned in this follow-up.

## Files changed

Application routes:

- `src/app/(public)/page.tsx`
- `src/app/(public)/bossing/page.tsx`
- `src/app/(public)/diaries/page.tsx`
- `src/app/(public)/gold/page.tsx`
- `src/app/(public)/quests/page.tsx`
- `src/app/(public)/skills/page.tsx`
- `src/app/layout.tsx`
- `src/app/reference-storefront.css` (new scoped styles)

Components in `src/components/`:

- `bossing-calculator-engine.tsx`, `brand-logo.tsx`, `direct-order-engine.tsx`
- `direct-service-hero.tsx`, `gold-trading-engine.tsx`, `premium-configurator-engine.tsx`
- `product-estimate-panel.tsx`, `product-marketplace.tsx`
- `public-footer.tsx`, `public-header.tsx`, `service-reference-icon.tsx`
- `skilling-calculator-engine.tsx`
- New: `reference-art.tsx`, `store-number-field.tsx`, `store-trust-strip.tsx`

Assets and validation:

- New unchanged client JPEG boards under `public/artwork/`: `client-diary-reference.jpeg`, `client-gathering-reference.jpeg`, `client-gold-reference.jpeg`, `client-home-reference.jpeg`, `client-infernal-reference.jpeg`, `client-items-reference.jpeg`, `client-quest-reference.jpeg`.
- `scripts/capture-direct-storefront.mjs`
- `tests/e2e/direct-ordering.spec.ts`, `tests/e2e/homepage.spec.ts`
- `docs/DECISIONS.md`, this report, and the 18 screenshots listed below.

## Admin and database

No schema changes, new migrations, seed changes, dependencies, credentials or deployment-script changes in this follow-up. All 23 existing migrations were present in an isolated loopback MariaDB validation database. The unchanged Hostinger prebuild migration/seed process completed successfully, with no pending migrations.

Existing Admin pricing, inventory, requirements, feature switches and publishing remain authoritative. Homepage rendering is now dynamic so published merchandising changes do not require a rebuild. No new business prices or stock were inferred from mockups. Earlier structural/Admin additions are documented in `CODEX-OSRS-STRUCTURAL-REDESIGN-COMPLETION.md`.

Rollback: reverting this source commit restores the previous presentation; no schema rollback is necessary. No production database was accessed or changed.

## Commands and test results

- `pnpm install --frozen-lockfile`: passed.
- `pnpm lint`: passed, zero warnings.
- `pnpm typecheck`: passed.
- `pnpm test`: 267 tests passed across 47 files.
- `pnpm test:seed`: 2 tests passed.
- `pnpm build`: passed, including existing Hostinger migration and seed steps.
- `pnpm exec playwright test tests/e2e/direct-ordering.spec.ts tests/e2e/homepage.spec.ts --workers=1`: final run 36/36 passed against `pnpm start`, not the development server.
- `pnpm production:smoke --base-url http://127.0.0.1:3000`: 12/13 OK, zero critical failures; existing optional `/support/chat` returned 404 while `/support` returned 200.
- `node scripts/capture-direct-storefront.mjs`: all 18 captures completed.
- Unauthenticated GET checks: `/api/admin/chat/settings` and `/api/admin/chat/conversations` returned 401; `/admin` redirected to staff login.

Browser tests cover Skills, Bossing, Infernal, Diaries, Gathering, Gold and Items configuration through cart and checkout, quest multi-selection, legacy redirects, manual-review disabling, inline item quantity pricing, keyboard search and mobile-menu focus behavior. The item fixture verified quantity two retained an exact $24.68 quote into cart/checkout. Positive inventory fixtures were restricted to the explicitly opted-in local database and restored afterward. No payment was submitted.

The first production browser run exposed an overly broad item quantity locator checking before detail navigation and two navigation timeouts. The item test now waits for its detail URL and uses the exact accessible label; navigation assertions use a bounded 30-second allowance. The complete subsequent 36-test run passed in 1.6 minutes. The full historical E2E suite is not claimed as passing.

## Responsive testing and screenshots

Automated overflow checks passed at 390, 430, 768, 1024 and 1440 CSS pixels. Final production screenshots were visually reviewed against the supplied boards, including desktop selectors and mobile stacking. Earlier review corrected logo sizing, portrait crops, diary-region art mapping and hero crops that included screenshot controls.

All files below are in `artifacts/reference-ui-redesign/`:

- 1440 × 1000: `home-1440.png`, `skills-1440.png`, `bossing-1440.png`, `quests-1440.png`, `diaries-1440.png`, `infernal-1440.png`, `gathering-1440.png`, `gold-1440.png`, `items-1440.png`.
- 390 × 844: `home-390.png`, `skills-390.png`, `skills-controls-390.png`, `bossing-390.png`, `quests-390.png`, `diaries-390.png`, `infernal-390.png`, `gold-390.png`, `items-390.png`.

## Assumptions and remaining business data

- The user's explicit screenshot-led black/red/gold request overrides the repository's older green identity guideline. The existing official wordmark is preserved rather than replacing it with a mockup dragon logo.
- Client-supplied boards are used as artwork sources via CSS cropping; the interface itself is real responsive HTML and working controls, not screenshot overlays. Existing generated hero/gathering art is reused.
- This is not a pixel-identical reproduction. Published catalogue data, available options and existing safety/eligibility controls determine content and form length.
- Gold remains paused and representative product records remain unavailable/manual-review until staff approve and publish real inventory and commercial data. Screenshots show those honest states. Missing item-specific artwork, boss portraits, service ETAs and quest metadata still need approved content; no fake stock or delivery guarantees were added.
- No separate premium Quiver configurator was introduced: the existing catalogue does not provide an approved premium Quiver package. Its existing promotional/manual-service destination remains; a dedicated offering needs published package requirements and pricing. The Colosseum boss remains in Bossing.
- Production publishing is not performed, in accordance with `AGENTS.md`. A GitHub push is source delivery, not proof that Hostinger has deployed it. The live site is checked separately in the delivery message.

## Documentation and stop condition

`docs/DECISIONS.md` records the design, asset provenance, Admin preservation and deployment boundary. This report supplements the previous structural completion report. Work remained within the requested storefront redesign and its validation; no unrelated task or live payment integration was started.
