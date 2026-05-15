# Operations

## Deployment Shape

This MVP is designed as one Next.js App Router application on Vercel with Neon/Postgres, Drizzle, Vercel Blob, and Vercel Cron. The production direction is SaaS access: users sign up, log in, join an organization or tenant workspace, and operate only tenant-scoped Coupang and Ownerclan integrations.

Use Vercel Pro before relying on sub-daily production monitoring. Hobby cron is acceptable for local MVP smoke checks, but not for operational order/cancel/return monitoring.

## Current Roadmap

The service is being pivoted toward order, shipment, claim/return, and CS operations automation. Item Winner detection and product deletion are out of scope for this service.

Use [order-cs-automation-todo.md](order-cs-automation-todo.md) as the durable implementation backlog for future development.

Use [saas-auth-tenancy-plan.md](saas-auth-tenancy-plan.md) for the Vercel SaaS signup/login, tenant isolation, and onboarding plan.

## Playwright Verification Policy

Every Next.js development task must include detailed Playwright E2E coverage for the affected browser-visible flow and must run `pnpm test:e2e` before completion. Backend-only tasks with no browser-observable behavior still run the existing Playwright suite unless technically blocked, and the completion notes must explain why no new E2E test was added.

The Playwright web server uses test-only placeholder server environment values from `playwright.config.ts` so production preflight can run without real Coupang, Ownerclan, Blob, or database credentials. It starts `next start` on a dedicated E2E port and does not reuse an existing server, so the suite verifies the code built by the current `pnpm test:e2e` run. Do not replace those placeholders with production secrets.

## Environment Variables

- `DATABASE_URL`: pooled Neon runtime URL.
- `DATABASE_DIRECT_URL`: direct Neon URL for Drizzle migrations.
- `CRON_SECRET`: Vercel Cron bearer secret.
- `OPERATOR_API_KEY`: temporary local/MVP key for protected dashboard APIs before SaaS auth is implemented.
- `OPERATOR_ACTOR_ID`, `OPERATOR_ROLE`: temporary server-resolved actor identity for the single-operator MVP.
- `AUTH_PROVIDER_MODE`: `development` for local/E2E auth shell, `clerk` for production SaaS.
- `AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION`: only `true` for Playwright `next start` E2E. Production preflight rejects it.
- `E2E_TEST_MODE`: only `true` for Playwright browser tests that run against placeholder service dependencies.
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`: Clerk browser publishable key.
- `CLERK_SECRET_KEY`: Clerk server secret key.
- `COUPANG_VENDOR_ID`, `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`: legacy single-seller Coupang credentials for older jobs. New SaaS seller credentials are stored per tenant in encrypted `integration_accounts` rows.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token.
- `PII_ENCRYPTION_KEY`: encryption key for receiver PII and tenant-scoped marketplace credential envelopes.

Never prefix secrets with `NEXT_PUBLIC_`.

Protected routes must resolve actor identity from server-side configuration or a session/DB-backed auth layer. They must not trust `actorId`, `tenantId`, organization id, or role values supplied by the client body.

## SaaS Authentication And Tenancy

Production auth provider: Clerk. See [auth.md](auth.md) for the decision record.

Before public deployment, replace the temporary operator key model with:

1. Public `/sign-up` and `/sign-in` entry points.
2. A protected app shell that redirects unauthenticated users before any dashboard data loads.
3. User, organization or tenant, membership, role, invitation, and audit actor records.
4. Tenant-scoped integration accounts so Coupang and Ownerclan credentials are never global process-wide seller state.
5. Tenant allowlists on every dashboard query, job, approval, upload, provider request, notification, and audit log.
6. A first-run onboarding flow that creates the workspace, verifies the seller's Coupang/Ownerclan readiness, and stores credentials encrypted.
7. A production decision record for the auth provider before implementation.

Vercel Cron still uses `CRON_SECRET`, but cron jobs must derive tenant work from database schedules and never from request-supplied tenant ids.

## Cron Authentication

Native Vercel Cron endpoints must send:

```text
Authorization: Bearer ${CRON_SECRET}
```

Route handlers must reject missing or invalid authorization with `401` before any job lookup or work.

## Job Limits

- Lease TTL: 10 minutes.
- Invocation budget: checkpoint and exit by 240 seconds.
- Import chunk: 500 rows or 30 seconds.
- Dead-letter: 5 failed attempts or 24 hours stuck.

The initial job contract lives in `src/server/jobs/**`:

- `lease.ts` documents the Postgres `FOR UPDATE SKIP LOCKED` lease statement.
- `runner.ts` provides the bounded execution loop that returns `checkpointed` before the serverless budget is exceeded.
- `job-policy.ts` centralizes lease TTL, budget, dead-letter, and idempotency key rules.

## Legacy Import And Approval Flow

The flow below describes the current WING upload and non-winner approval MVP surface. It remains useful as a reference for upload parsing, approval hashing, idempotency, and audit behavior, but it is not the forward product roadmap. Future development should prioritize the order/CS automation backlog above.

1. Upload WING CSV/XLSX through `/api/uploads`.
2. Blob callback stores upload metadata in `uploads`.
3. Parser jobs normalize rows with `src/server/imports/wing-parser.ts`.
4. `src/server/imports/non-winner-candidates.ts` excludes rows with recent orders or open claims.
5. `src/server/workflows/non-winners/prepare.ts` creates approval hashes and idempotency keys.
6. `/api/approvals` records the approval-ready request shape.
7. Execution uses `src/server/workflows/non-winners/execute.ts`, which blocks rejected/expired approvals and records denial audits.

## Retention

- Raw uploads: 30 days.
- Raw API payloads: 14 days.
- Redacted operational logs: 90 days.
- Audit logs: 1 year.

Retention jobs must delete or mask raw payloads while preserving audit metadata.

## Production Migration Checklist

1. Review generated Drizzle SQL.
2. Confirm backup/restore path.
3. Apply to staging or preview DB.
4. Add rollback note.
5. Get explicit approval before destructive changes.
6. Run migration with `DATABASE_DIRECT_URL`.

## Worker Migration Triggers

Move execution out of Vercel Functions if recurring imports exceed 50MB or 100,000 rows, p95 job runtime exceeds 240 seconds for 3 consecutive days, cron lag exceeds 15 minutes for 3 consecutive Pro runs, timeout/dead-letter rate exceeds 5% over 7 days, Coupang 429 rate exceeds 20% despite throttling, or a fixed outbound IP is required and unavailable.
