# AGENTS.md — Codex Working Rules

## 1. Mission

Build a secure, original, production-quality OSRS Services web application inside one maintainable codebase. Work in small verified tasks. Never attempt the entire project from one prompt.

## 2. Source-of-truth order

When instructions conflict, use this order:

1. The active task file in `tasks/`
2. `docs/DECISIONS.md`
3. Other files in `docs/`
4. `plans/7-WEEK-DELIVERY-PLAN.md`
5. Reference images/PDFs
6. Assumptions

Do not silently invent business rules. Record unavoidable assumptions in `docs/DECISIONS.md`.

## 3. Design rules

- Use the official OSRS Services logo and bright-green/black identity.
- Reference websites are inspiration only.
- Do not copy competitor text, artwork, logos, or exact page composition.
- Use reusable design tokens and components.
- Every public screen must support desktop, tablet, and mobile.
- Include loading, empty, validation, error, offline, and success states.
- Do not redesign an approved component unless the active task requests it.

## 4. Engineering rules

- Use TypeScript strict mode.
- Prefer server-side validation and server-authoritative pricing.
- Do not hardcode product prices, requirements, multipliers, feature availability, inventory, or delivery fees.
- Use database migrations for schema changes.
- Keep secrets in environment variables; never commit real credentials.
- Never store raw payment-card data, CVV, Gmail passwords, RuneScape passwords, or payment-provider secrets in normal database fields.
- Sanitize user content and uploaded filenames.
- Add authorization checks on the server, not only in the UI.
- Add audit logs for sensitive staff actions.
- Preserve order price snapshots so later price changes never alter old orders.

## 5. Role rules

Seed these roles:

- SUPER_ADMIN
- EDITOR
- SUPPORT_AGENT

Implement permissions as capabilities, not only hardcoded role-name checks.

## 6. Quality gates

A task is incomplete unless:

- Lint passes
- Type checks pass
- Automated tests pass
- Database migration succeeds
- Mobile and desktop are manually verified
- Authorization is verified
- Error states are handled
- Documentation is updated
- No unrelated module is broken

## 7. Task discipline

Before coding:

1. Read the active task.
2. Read every referenced requirement file.
3. Inspect the current repository.
4. State the implementation plan.
5. Identify migrations and risks.

After coding:

1. Run all required commands.
2. Capture requested screenshots.
3. Update documentation.
4. Produce the completion report using `templates/CODEX-COMPLETION-REPORT.md`.
5. Stop. Do not begin the next task.

## 8. Prohibited actions

- Do not deploy to production.
- Do not delete the WordPress site.
- Do not connect real payment accounts.
- Do not scrape or copy competitor inventory as real OSRS Services inventory.
- Do not use competitor active account listings as real stock.
- Do not commit raw reference PDFs unless explicitly requested.
- Do not weaken authentication, authorization, validation, or audit logging to save time.
