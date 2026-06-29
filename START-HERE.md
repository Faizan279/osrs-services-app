# OSRS Services — Start Here

This folder is the authoritative starting package for the custom OSRS Services web application.

## What you need to do first

1. Keep this folder on your computer.
2. Open Codex using the same OpenAI account you already use.
3. Give Codex access to this folder, or place it inside a new GitHub repository.
4. Open `KICKOFF-PROMPT.txt`.
5. Paste that prompt into Codex.
6. Do not ask Codex to build the whole platform at once.
7. When Codex completes Task 001, send its completion report and screenshots back to ChatGPT for review.

## Important rules

- The existing WordPress website stays live until the new application is approved and deployed.
- Development starts locally. Production hosting is not needed yet.
- Never share Gmail, Hostinger, payment-provider, or customer passwords in prompts.
- No payment method will be activated until the client has an approved merchant account and credentials.
- All prices, multipliers, inventory, requirements, content, and feature availability must be editable from the admin panel.
- Competitor websites are functional and visual references only. Do not copy their branding, text, artwork, or exact layouts.

## Main files

- `AGENTS.md` — permanent rules for Codex
- `docs/` — final requirements and architecture
- `plans/7-WEEK-DELIVERY-PLAN.md` — weekly execution plan
- `tasks/CODEX-TASK-001.md` — first implementation task
- `KICKOFF-PROMPT.txt` — exact prompt to paste into Codex
- `migration/` — original WooCommerce product export
- `assets/` — approved logo and initial visual references
