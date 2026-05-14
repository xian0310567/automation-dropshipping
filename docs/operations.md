# Operations

## Deployment Shape

This MVP is designed as one Next.js App Router application on Vercel with Neon/Postgres, Drizzle, Vercel Blob, and Vercel Cron.

Use Vercel Pro before relying on sub-daily production monitoring. Hobby cron is acceptable for local MVP smoke checks, but not for operational order/cancel/return monitoring.

## Current Roadmap

The service is being pivoted toward order, shipment, claim/return, and CS operations automation. Item Winner detection and product deletion are out of scope for this service.

Use [order-cs-automation-todo.md](order-cs-automation-todo.md) as the durable implementation backlog for future development.

## Environment Variables

- `DATABASE_URL`: pooled Neon runtime URL.
- `DATABASE_DIRECT_URL`: direct Neon URL for Drizzle migrations.
- `CRON_SECRET`: Vercel Cron bearer secret.
- `OPERATOR_API_KEY`: server-side key required by protected MVP dashboard APIs.
- `OPERATOR_ACTOR_ID`, `OPERATOR_ROLE`: server-resolved actor identity for the single-operator MVP.
- `COUPANG_VENDOR_ID`, `COUPANG_ACCESS_KEY`, `COUPANG_SECRET_KEY`: server-only Coupang credentials.
- `BLOB_READ_WRITE_TOKEN`: Vercel Blob token.
- `PII_ENCRYPTION_KEY`: future encryption key for receiver PII.

Never prefix secrets with `NEXT_PUBLIC_`.

Protected routes must resolve actor identity from server-side configuration or a future session/DB-backed auth layer. They must not trust `actorId` or role values supplied by the client body.

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
