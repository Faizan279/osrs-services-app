# CODEX TASK 015 - Custom Live Chat and Support Dashboard Foundation

## Starting State

- Repository: `Faizan279/osrs-services-app`
- Worktree: `E:\Codex\osrs-services-task-015`
- Branch: `codex/task-015-live-chat-support-dashboard`
- Starting main SHA: `9a66f6089995950067408864c57151e436dd4c93`
- Task 014 merge commit: `9a66f6089995950067408864c57151e436dd4c93`
- PR #15 state: merged before Task 015 work began

Task 015 starts from latest `origin/main` containing the Task 014 merge commit. It does not continue from the Task 014 branch and does not modify prior task worktrees.

## Delivered Scope

- Additive Prisma migration `20260803150000_task015_live_chat_support_dashboard`.
- Durable MySQL chat settings, guest sessions, conversations, messages, read cursors, events, assignment events, internal notes, quick replies, order links and retention events.
- Provider-free, single-node Socket.IO gateway in `realtime/chat-server.ts` with credentialed explicit-origin CORS, cookie-only authentication and HTTP health endpoints.
- Public and customer chat surfaces at `/support` and `/account/support`, plus the floating launcher gated by database settings and feature flags.
- HTTP fallback APIs for availability, guest session creation, conversation creation/list/detail, message send, read cursors, status updates and order linking.
- Staff support dashboard at `/admin/chat` with queue filters, transcript detail, assignment, staff replies, status transitions, internal notes, message redaction and settings.
- Feature flags seeded disabled by default: `live_chat_enabled`, `guest_live_chat_enabled`, `customer_live_chat_enabled`, `chat_realtime_enabled`.
- Guest token raw value stored only in the HttpOnly cookie response; MySQL stores only an HMAC digest.
- Customer `CHAT_MESSAGE` in-app notification type for staff replies to customer-owned conversations.
- MySQL-backed GitHub Actions validation, E2E coverage, screenshots and review-pack generation.

## Boundaries

Task 015 does not configure Intercom, Zendesk, Crisp, Tawk, LiveChat, Help Scout, Drift, Twilio, Redis, Kafka, RabbitMQ, Pusher, Ably, PubNub, file attachments, AI chatbot behavior, agent scheduling, SLA automation, multi-node fanout, deployment or Task 016.

The Socket.IO gateway is explicitly single-node. Multi-node real-time scaling is deferred and should add a reviewed adapter or message bus in a later task.

## Feature Flags

The normal seed creates these disabled by default and preserves manual edits:

- `live_chat_enabled`
- `guest_live_chat_enabled`
- `customer_live_chat_enabled`
- `chat_realtime_enabled`

`ChatSettings` is also seeded offline, with launcher/offline intake disabled, safe public copy, `realtimeExpected=false` and `needsClientReview=true`.

## Validation

Local non-database validation covers Prisma format/generate, lint, typecheck, unit tests, seed tests, format check, build, static chat checks and whitespace checks.

Database-backed migration, seed, chat transaction, upgrade, E2E, screenshot and review-pack validation is configured in `.github/workflows/task015-validation.yml` with temporary MySQL 8.4 service containers and CI-only credentials. This task intentionally does not install local MySQL or Docker.
