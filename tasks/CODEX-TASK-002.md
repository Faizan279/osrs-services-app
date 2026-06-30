# CODEX TASK 002 — Public Homepage, Navigation and Footer

## Repository and branch

- Repository: `Faizan279/osrs-services-app`
- Base: latest merged `main` after CODEX-TASK-001
- Working branch: `codex/task-002-homepage`
- Stop condition: local commit and visual review only; do not push or open a pull request before approval

## Objective

Build a complete, polished, original, responsive public homepage for OSRS Services while preserving the Task 001 authentication, database, permissions, account routes, admin shell, tests, and engineering foundation.

The public experience must feel like a premium gaming-services marketplace rather than a corporate SaaS page, neon gaming template, cryptocurrency site, RuneScape UI imitation, or competitor copy.

## Visual direction

- Deep obsidian and near-black backgrounds
- Dark forest-green layered surfaces
- Restrained action-lime accents
- Muted gold secondary details
- White and soft-grey readable text
- Serif display typography only for major headings
- Sans-serif navigation, controls, labels, and body copy
- Original CSS atmosphere, geometry, patterns, borders, gradients, and licensed icons

Do not copy competitor text, branding, cards, exact layouts, artwork, icons, or protected assets. Do not use RuneScape or Jagex artwork unless a project-provided asset is explicitly approved.

## Required public shell

- Optional announcement bar with careful, factual copy
- Responsive sticky header
- Official OSRS Services logo from `public/branding/osrs-services-logo.png`
- Desktop Services menu covering power levelling, questing, achievement diaries, minigames, bossing/PvM, and skill training
- Main Gold, Accounts, Membership, Reviews, and Help links
- Account entry and primary service CTA
- Accessible mobile drawer with focus management, explicit close control, Escape handling, and background scroll locking
- Centralized public navigation definitions
- Full responsive footer with service, support, account, legal-placeholder, and configurable Discord links

## Homepage sections

1. Hero with clear value proposition, two CTAs, process indicators, and an original visual composition
2. Service category explorer
3. Featured service previews driven by typed centralized data
4. Why choose OSRS Services process benefits
5. Four-step ordering explanation
6. Distinctive privacy and secure-service section
7. Reusable customer-feedback preview with unmistakable demo labels until approved reviews exist
8. Accessible six-question FAQ accordion
9. End-of-page services and support CTA
10. Complete footer

## Content and commercial safeguards

All copy must be original. Do not invent or imply:

- Customer or completion counts
- Ratings or review-platform scores
- Partnerships or rankings
- Guarantees or delivery times
- Prices, rates, discounts, inventory, or payment availability

When pricing is unavailable, use `Custom quote` or `Pricing configured at checkout`. Configurable Discord links must fall back to an on-page support destination rather than a fake invitation.

## Technical scope

- Next.js App Router, strict TypeScript, Tailwind CSS, existing tokens and UI primitives
- Server Components by default; Client Components only for interaction
- Semantic landmarks and heading hierarchy
- Visible keyboard focus and skip-to-content support
- Accessible dropdown, mobile navigation, and FAQ state
- Reduced-motion consideration
- SEO title, description, Open Graph metadata, and canonical-ready configuration
- No new dependency unless essential
- No database migration, authentication redesign, permissions change, admin redesign, checkout, product management, calculator, live chat, or payment integration

## Responsive targets

Validate intentionally at 320, 390, 768, 1024, and 1440 px. There must be no horizontal overflow, clipped navigation, overlapping content, unusably small controls, or decorative interference with legibility.

## Required validation

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm format:check
```

Focused coverage must include homepage rendering, main navigation, desktop service-menu behavior, mobile open/close and Escape behavior, FAQ state, important CTA targets, protected admin/account routes, and horizontal overflow at required widths.

## Required screenshots

```text
artifacts/task-002/homepage-desktop-above-fold-1440.png
artifacts/task-002/homepage-desktop-full-1440.png
artifacts/task-002/homepage-tablet-768.png
artifacts/task-002/homepage-mobile-390.png
artifacts/task-002/mobile-navigation-open-390.png
artifacts/task-002/desktop-services-menu-open-1440.png
```

- Desktop: `1440 × 1000`
- Tablet: `768 × 1024`
- Mobile: `390 × 844`

## Completion documentation

Create `reports/CODEX-TASK-002-COMPLETION.md` with the work summary, branch, files/components, sections, navigation behavior, responsive and accessibility validation, test/build results, screenshot paths, limitations, missing client content, official-logo status, local commit SHA, and confirmation that Task 003 or later work was not started.
