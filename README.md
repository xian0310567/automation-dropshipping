# Coupang Ownerclan Operations Automation

Next.js full-stack MVP for a personal Coupang x Ownerclan dropshipping operations dashboard.

The current product direction is the daily order and CS operations loop. Item Winner detection and product deletion are handled outside this service.

- order, cancel, return, and shipment monitoring
- CS inquiry monitoring, classification, and reply drafting
- Ownerclan fulfillment queueing with API or CSV/manual fallback
- approval-gated Coupang shipment, claim, and CS actions
- Ownerclan API readiness or CSV/XLSX fallback
- audit logs, retry/dead-letter state, retention, and alerts

See [docs/order-cs-automation-todo.md](docs/order-cs-automation-todo.md) for the detailed phased development backlog.

## Stack

- Next.js App Router + TypeScript
- Vercel + Vercel Cron + Vercel Blob
- Vercel-managed Neon/Postgres
- Drizzle ORM
- Vitest

## Local Development

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Open `http://localhost:3000`.

## Verification

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Database

Generate migrations:

```bash
pnpm db:generate
```

Apply migrations with the direct Neon URL:

```bash
DATABASE_DIRECT_URL="postgres://..." pnpm db:migrate
```

Runtime code uses `DATABASE_URL`, which should be the pooled Neon connection string.

## Cron

Vercel Cron calls `/api/cron/dispatch`.

The route requires:

```text
Authorization: Bearer ${CRON_SECRET}
```

Cron handlers must authenticate before any job lookup or work.

## Operator API Auth

Protected MVP endpoints require an operator key:

```text
Authorization: Bearer ${OPERATOR_API_KEY}
```

The actor id and role come from server environment variables (`OPERATOR_ACTOR_ID`, `OPERATOR_ROLE`), never from the request body.

## Implemented MVP Surface

- `/`: operator dashboard shell for approvals, failed jobs, fallback metrics, and integration readiness.
- `/api/uploads`: operator-authenticated Vercel Blob client-upload handler. The current implementation still supports legacy WING CSV/XLSX uploads.
- `/api/workflows/non-winners`: legacy operator-authenticated conversion from normalized WING rows into approval-ready sales-stop candidates. This is not part of the forward order/CS automation roadmap.
- `/api/approvals`: operator-authenticated approval creation with durable approval and audit-log rows.
- `/api/cron/dispatch`: authenticated cron entrypoint that claims a Postgres job lease and runs the bounded dispatcher.

## Operational Limits

- Job invocation target: checkpoint by 240 seconds.
- Lease TTL: 10 minutes.
- Import chunk: 500 rows or 30 seconds.
- Coupang throttle: 4 requests/sec/vendor.
- Dead-letter: 5 failed attempts or 24 hours stuck.
- Raw uploads retention: 30 days.
- Raw API payload retention: 14 days.
- Audit logs: 1 year.

See [docs/operations.md](docs/operations.md) for deployment and migration notes.
