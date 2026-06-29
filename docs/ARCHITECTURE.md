# Technical Architecture

## Chosen direction

One repository and one primary full-stack application, organized by modules.

## Application

- Next.js App Router
- TypeScript strict mode
- Custom Node.js start server where required for Socket.IO
- Server-rendered public pages where beneficial
- Protected customer and admin route groups
- Tailwind-based custom design system
- Zod validation
- Automated unit, integration, and browser testing

## Database

- MySQL 8
- Prisma ORM
- Database migrations and seed scripts
- Transactional order and inventory updates

MySQL is selected to preserve compatibility with Hostinger Business managed hosting. The application must avoid database-specific assumptions that would make later migration unnecessarily difficult.

## Authentication

- Latest stable compatible Auth.js setup
- Email/password credentials initially
- Argon2id password hashing
- Database-backed sessions
- Email verification architecture
- Optional social login can be enabled later
- Server-side capability authorization

## Real-time chat

- Socket.IO
- MySQL message persistence
- Single-instance deployment initially
- Optional Redis adapter for future multi-instance scaling

## Files

Development:

- Local storage abstraction

Production:

- S3-compatible private object storage preferred
- Signed/private URLs for sensitive files
- Media metadata stored in MySQL

## Background work

Initially use:

- Database-backed job records
- Host cron jobs for scheduled processing

Move to a dedicated queue/Redis only when load or deployment requires it.

## Local development

Use Docker Compose for:

- MySQL
- Mail testing service

The application itself may run through the local Node package manager for faster development.

## Deployment decision gate

1. Test Hostinger Business Node.js deployment.
2. Confirm custom start command and WebSocket behaviour.
3. Use Hostinger MySQL if acceptable.
4. If real-time or operational limits fail, move application/realtime services to a VPS while retaining domain/email at Hostinger.
