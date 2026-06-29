# CODEX TASK 001 — Project Foundation

## Objective

Initialize the production-quality local project foundation. Do not build the full homepage or business modules in this task.

## Read first

- `AGENTS.md`
- `docs/PROJECT-CHARTER.md`
- `docs/ARCHITECTURE.md`
- `docs/DESIGN-SYSTEM.md`
- `docs/USER-ROLES-AND-PERMISSIONS.md`
- `docs/SECURITY.md`
- `docs/DATA-MODEL-DRAFT.md`

## Required implementation

### 1. Application setup

Create a single repository application using:

- Latest stable compatible Next.js App Router
- TypeScript strict
- Current LTS Node.js version compatible with Hostinger's supported choices
- pnpm
- Tailwind CSS
- ESLint
- Prettier
- Environment validation
- Absolute import aliases

### 2. Local infrastructure

Create Docker Compose services for:

- MySQL 8
- Mailpit or equivalent local email catcher

Provide:

- `.env.example`
- health checks
- documented startup commands
- no real secrets

### 3. Database

Set up Prisma for MySQL.

Implement only the minimum foundation models required now:

- User
- Role
- Permission
- UserRole
- RolePermission
- Session/auth-required models
- FeatureFlag
- AuditLog

Create migration and seed:

- SUPER_ADMIN
- EDITOR
- SUPPORT_AGENT
- Initial permissions
- Payment feature flags disabled
- Priority/Express delivery flags disabled

### 4. Authentication foundation

Implement:

- Auth.js compatible email/password login
- Argon2id password hashing
- Database sessions
- Protected route middleware/helpers
- Server-side capability checking
- Seeded local Super Admin account created only from environment variables

Do not expose a default production password.

### 5. Application structure

Create route groups/layouts for:

- Public storefront
- Customer dashboard
- Admin
- Authentication

Create placeholders only:

- `/`
- `/account`
- `/admin`
- `/login`
- `/health`

The admin and account routes must be protected.

### 6. Design foundation

Implement:

- CSS variables/design tokens from `docs/DESIGN-SYSTEM.md`
- Typography setup
- Button variants
- Input
- Card
- Badge
- Dialog
- Skeleton
- Alert
- Toast
- A protected `/admin/design-system` component showcase

Use the official logo from `assets/branding/`.

### 7. Testing

Configure:

- Unit test framework
- Playwright
- Tests for:
  - health endpoint
  - permission helper
  - login failure
  - protected route denial
  - Super Admin access

### 8. Documentation

Update:

- root `README.md` with exact local commands
- architecture notes only if implementation differs
- `docs/DECISIONS.md` with package/version decisions

## Non-goals

Do not implement:

- Homepage design
- Product catalogue
- Pricing engine
- Cart
- Payments
- Chat
- RSN lookup
- WooCommerce migration

## Acceptance criteria

- Fresh clone can be started using documented commands.
- MySQL becomes healthy through Docker Compose.
- Prisma migration and seed succeed.
- Login works locally.
- Admin route is denied without authorization.
- Super Admin can access the component showcase.
- Lint, typecheck, tests, and production build pass.
- No real credentials are committed.
- Completion report follows the template.

## Required screenshots

- Login page at 1440 px
- Admin design-system showcase at 1440 px
- Login page at 390 px
- Admin design-system showcase at 390 px

## Stop

After producing the completion report, stop and wait for review.
