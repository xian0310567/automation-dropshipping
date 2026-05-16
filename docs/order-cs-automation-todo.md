# Order/CS Automation TODO

Last updated: 2026-05-15 KST
Source plan: `.omx/plans/order-cs-automation-20260514T225551Z.md`
SaaS plan: [saas-auth-tenancy-plan.md](saas-auth-tenancy-plan.md)

## Purpose

This document is the durable development backlog for the Coupang x Ownerclan order and CS automation service.

The service is not responsible for Item Winner detection or product deletion. Another service will handle that. This service owns the daily operating loop after products are already listed:

- let users sign up, log in, and access a protected Vercel-hosted SaaS dashboard
- isolate each seller workspace as an organization/tenant with its own users, roles, credentials, jobs, and data
- collect Coupang orders, shipments, cancellations, returns, and CS inquiries
- decide what needs operator attention today
- prepare Ownerclan fulfillment work
- prepare and safely execute shipment/waybill actions
- draft and safely execute CS replies
- prevent mistakes around cancellation, return, refund, shipment stop, and PII

The product should feel like an operations control tower, not a product deletion dashboard.

## Development Policy

Follow these rules for every future task in this document:

- Read first, write later. Build sync, classification, and dry-run flows before provider mutations.
- PII envelope first. Do not sync real receiver, address, phone, return requester, or CS message content before encryption, masking, redaction, retention, and dashboard DTO allowlists exist.
- Provider writes require gates. No Coupang or Ownerclan write can run until transaction-safe DB, provider-control, idempotency, dry-run, readiness, and kill switch are implemented.
- Approval before impact. Customer-facing replies, seller-score-impacting actions, refund/return actions, cancellation, shipment suspend, and waybill upload start as approval-gated.
- Ownerclan live order automation is conditional. Verify account/API capability and duplicate/cancellation semantics before enabling live supplier order placement.
- Store external identifiers as strings. Coupang IDs such as `shipmentBoxId`, `orderId`, `vendorItemId`, `receiptId`, `inquiryId`, `answerId`, and `sellerProductId` can exceed safe JavaScript integer behavior.
- Keep Next/Vercel/Neon simple unless runtime, cron lag, fixed egress/IP, or provider throughput forces a worker.
- Treat SaaS auth and tenant isolation as foundation work, not polish. No production dashboard, sync, approval, upload, notification, provider call, or audit query may depend on client-supplied `tenantId` or global seller credentials.

## Current Repo Snapshot

Existing primitives:

- Next.js App Router, TypeScript, Vercel, Neon/Postgres, Drizzle, Vitest.
- `src/server/db/schema.ts` already has shallow `orders`, `shipments`, `approvals`, `jobs`, `job_runs`, `api_request_logs`, `audit_logs`, `alerts`, `notifications`, `integration_accounts`, and `dead_letters`.
- `src/server/coupang/coupang-client.ts` has HMAC authorization generation and a simple 429 pause helper.
- `src/server/ownerclan/readiness.ts` decides API vs CSV fallback readiness.
- `src/server/cron/dispatcher.ts` has a bounded cron/job runner pattern.
- `src/app/page.tsx` is currently a static dashboard shell.

Known gaps:

- SaaS signup/login, protected app shell, development session fallback, direct password sessions, and tenant schema foundation exist. Billing, password recovery, account management, and encrypted credential rollout are still pending.
- Current protected API model supports server session auth plus temporary local/dev `OPERATOR_API_KEY` fallback.
- Tenant-scoped integration account columns exist, but the full encrypted credential envelope and provider migration are still pending.
- Dashboard copy is now oriented around order/CS operations.
- README and operations docs now link to this roadmap, but the first app screen still needs the same product pivot.
- No real Coupang endpoint clients exist yet.
- No CS domain exists yet.
- Current order/shipment tables are not enough for line-level order, claim, return, CS, and fulfillment automation.
- PII encryption is documented as future work but not implemented as a reusable envelope.
- Current DB runtime uses the Neon HTTP path; transaction-safe provider-control work is still required.
- Ownerclan order placement, stock, status, and tracking API behavior are not verified.

## Target Product Shape

Primary navigation should eventually be:

- Public access: marketing/landing, signup, login, password/session recovery, and invitation acceptance
- Onboarding: workspace creation, seller profile, Coupang credentials, Ownerclan readiness, notification settings
- `오늘 처리`: overdue CS, orders needing Ownerclan order, tracking upload due, cancellation/return risk, provider/API failures
- `주문`: new orders, fulfillment status, Ownerclan mapping, shipment state, waybill state
- `CS`: product inquiries, Coupang contact-center inquiries, draft replies, reply SLA, manual review
- `취소/반품`: return/cancel requests, pre-refund flags, CS-confirm flags, receipt confirmation tasks, approval tasks
- `자동화 정책`: template rules, approval thresholds, auto-execution allowlist, recent failures
- `연동 상태`: Coupang readiness, Ownerclan readiness, rate/circuit state, job/dead-letter state

## Automation Levels

Use these levels when deciding what to build or promote:

- Level 0, Observe: sync data, show alerts, no provider writes.
- Level 1, Classify: categorize events and suggest next actions, no provider writes.
- Level 2, Draft: create CS reply drafts and fulfillment/action tasks, approval required.
- Level 3, Approval-gated execute: execute approved provider actions through provider-control.
- Level 4, Policy auto-execute: only narrow proven internal rules first; waybill/CS auto-actions require later explicit promotion.

First-wave auto-execution may include:

- internal task creation
- operator notifications
- low-risk internal housekeeping

Do not auto-execute these by default:

- seller cancellation
- shipment suspend
- return approval
- refund-affecting actions
- complaint replies
- uncertain ETA promises
- AI-generated freeform CS replies

## Non-Negotiable Gates

### SaaS Auth And Tenant Gate

Before public SaaS deployment or real seller data sync:

- [ ] Choose and document the auth provider for Vercel deployment.
- [ ] Add public signup, login, logout, session recovery, and invitation acceptance routes.
- [ ] Protect the app shell, dashboard APIs, upload APIs, approval APIs, and provider-action APIs with server-side session checks.
- [ ] Add `users`, `organizations` or `tenants`, `memberships`, `invitations`, and tenant-scoped `integration_accounts`.
- [ ] Store roles as server-owned membership state: `owner`, `admin`, `operator`, `viewer`.
- [ ] Resolve current tenant from server-side session + membership, never from a trusted client body.
- [ ] Add tenant filters to every DB query that reads or writes orders, shipments, claims, CS, approvals, uploads, jobs, notifications, audits, and provider state.
- [ ] Encrypt tenant-scoped Coupang and Ownerclan credentials; never keep production seller credentials as global env vars.
- [ ] Add audit actor attribution with `tenantId`, `userId`, `membershipRole`, and auth provider subject id.
- [ ] Add tenant-isolation tests that prove one tenant cannot read, approve, execute, upload, or receive notifications for another tenant.
- [ ] Keep `OPERATOR_API_KEY` only as a local/dev or temporary single-user fallback and block it in public SaaS mode.

### Live Mutation Gate

Before any live Coupang or Ownerclan write:

- [ ] Transaction-capable DB path exists for approval, job, provider-control, and provider outcome writes.
- [ ] Provider-control ledger exists for rate limits, circuit state, attempts, outcomes, and idempotency.
- [ ] Dry-run records the exact redacted request preview and target without network calls.
- [ ] Idempotency blocks duplicate writes by provider, vendor id, operation, target id, and request hash.
- [ ] Coupang WING OpenAPI key/IP readiness is verified with a low-impact read smoke test.
- [ ] Ownerclan write readiness is verified separately.
- [ ] Emergency kill switch disables all provider writes while read-only sync remains online.
- [ ] Timeout/unknown transport outcome re-queries provider state before retry.

### Approval Semantics

Before high-risk actions:

- [ ] Store immutable redacted approval previews.
- [ ] Track request actor, approve actor, execute actor/system job, timestamps, and provider outcome.
- [ ] Require explicit confirmation for seller cancellation, shipment suspend, return approval, refund-affecting actions, and risky CS replies.
- [ ] Block batch approval for high-risk actions until the action type is proven safe.
- [ ] Keep raw PII out of approval payloads.
- [ ] Expire approvals and force provider-state refresh before execution.

For the single-operator MVP, the compensating control is explicit confirmation + immutable preview + short expiry + fresh provider check. Future multi-user mode should add maker/checker separation.

### PII Envelope

Implement this before real order/CS payload sync:

- [ ] Define field classes: `public_operational`, `masked_operational`, `encrypted_sensitive`, `hashed_lookup`, `discard`.
- [ ] Encrypt receiver name, phone/safe number, address, customs fields, return requester contact data, and CS message bodies when retained.
- [ ] Store masked values for dashboard display.
- [ ] Recursively redact before `api_request_logs`, `jobs`, `job_runs`, `dead_letters`, `approvals`, provider outcomes, notifications, and client JSON.
- [ ] Store encrypted raw snapshots behind payload refs with retention deadlines and key version metadata.
- [ ] Build dashboard DTO allowlists; never serialize raw table rows directly to the client.
- [ ] Add leakage tests using known sample names, phone numbers, addresses, and CS messages.

### Ownerclan Contract Gate

Before live Ownerclan order placement:

- [ ] Verify account-level API approval.
- [ ] Document request/response shapes.
- [ ] Verify duplicate order placement behavior.
- [ ] Verify stock and option availability APIs.
- [ ] Verify order status polling.
- [ ] Verify tracking retrieval.
- [ ] Verify cancellation/change behavior after supplier order placement.
- [ ] Define fallback limits for manual/CSV order placement and tracking import.
- [ ] Store findings in `docs/integrations/ownerclan-contract.md`.
- [ ] Store fixtures in `src/server/ownerclan/__fixtures__/`.

## Implementation Phases

### Phase 0: Product Pivot And Documentation

Goal: Make the repo clearly describe the new service role.

Tasks:

- [x] Update `README.md` so the first target is order/CS operations, not WING non-winner import.
- [x] Update `docs/operations.md` with the order/CS operating loop.
- [x] Keep existing non-winner code temporarily, but mark it as legacy/out-of-scope.
- [x] Reword dashboard copy from item deletion to order/CS control tower.
- [x] Add a short "current roadmap" link to this TODO document.

Acceptance:

- [x] First screen communicates `주문/CS 운영 자동화`.
- [x] README links to this TODO document.
- [x] Existing non-winner routes are not deleted during this phase.

Suggested files:

- `README.md`
- `docs/operations.md`
- `src/app/page.tsx`
- `src/server/dashboard/summary.ts`

### Phase 0.5: SaaS Foundation, Auth, And Tenancy

Goal: Make the Vercel deployment usable as a SaaS product with signup/login and tenant-isolated seller workspaces before connecting real provider data.

Tasks:

- [x] Choose the production auth approach and write the decision in `docs/auth.md`.
- [x] Add public signup, login, logout, session recovery, and invitation acceptance flows.
- [x] Add a protected app shell that blocks unauthenticated dashboard access server-side.
- [x] Add tenant onboarding scaffold: create workspace, invite members, choose role, add seller profile, connect Coupang, check Ownerclan readiness.
- [x] Add `users`, `organizations` or `tenants`, `memberships`, `invitations`, and tenant-scoped `integration_accounts`.
- [ ] Replace process-wide Coupang/Ownerclan credentials with encrypted tenant-scoped integration credentials.
- [x] Resolve actor identity from session + membership; stop relying on client body `actorId`, `tenantId`, or role.
- [x] Add role policy for `owner`, `admin`, `operator`, and `viewer`.
- [ ] Add tenant scoping helpers to every server query and mutation. Foundation helper exists; full query rollout is still pending.
- [ ] Add tenant-isolation tests for dashboard reads, uploads, approvals, provider actions, notifications, and audit logs.
- [x] Keep `OPERATOR_API_KEY` available only for local/dev until the SaaS auth path is proven.

Phase 0.5 foundation delivered in the first implementation slice:

- First-party password auth selected and implemented.
- `AUTH_PROVIDER_MODE=development|password` added.
- Development sessions are HTTP-only cookies and blocked in production preflight.
- Production sessions use DB-backed `auth_sessions` rows with hashed bearer tokens.
- `/app` is protected server-side and `/` is public.
- `/sign-up`, `/sign-in`, `/session-recovery`, `/invite/[token]`, and `/logout` exist.
- `users`, `tenants`, `memberships`, `invitations`, and tenant-scoped `integration_accounts` schema exist.
- Tenant context helpers and unit tests exist.
- 쿠팡 연동 화면에서 판매자 ID, Access Key, Secret Key를 입력하고 테넌트별 encrypted credential envelope로 저장하는 1차 흐름이 존재한다.
- Playwright covers unauthenticated redirect, signup to onboarding, login to dashboard, logout, and mobile layout.

Acceptance:

- [ ] A new user can sign up or accept an invite and land in a protected workspace.
- [ ] Unauthenticated users cannot load dashboard data or call protected APIs.
- [ ] A user can access only tenants where they have membership.
- [ ] Tenant A cannot read, approve, execute, upload, or receive notifications for Tenant B in tests.
- [ ] Coupang and Ownerclan credentials are encrypted per tenant and never stored as production global env secrets. Coupang UI/storage exists; Ownerclan remains pending.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.

Suggested files:

- `docs/auth.md`
- `src/server/auth/**`
- `src/server/tenancy/**`
- `src/server/db/schema.ts`
- `src/app/(public)/**`
- `src/app/(app)/**`
- `src/app/api/**`

### Phase 1: Foundation, Transactions, Provider Control, PII

Goal: Create the safe runtime needed before real provider writes.

Tasks:

- [ ] Add transaction-capable DB helper for request/job/provider-control flows.
- [ ] Migrate approval flows away from unsafe transaction assumptions.
- [ ] Add provider-control tables for rate state, circuit state, attempts, outcomes, and idempotency.
- [ ] Implement a provider-control wrapper that all live provider calls must use.
- [ ] Add dry-run mode for provider actions.
- [ ] Add emergency provider-write kill switch.
- [ ] Expand security redaction from key-name masking to recursive structured redaction.
- [ ] Add encryption helper with key version metadata.
- [ ] Define retention rules for raw order snapshots and CS content.
- [ ] Add dashboard DTO allowlist pattern.

Acceptance:

- [ ] Provider writes cannot run while any live mutation gate check fails.
- [ ] Sample PII does not appear in logs, jobs, approvals, dead letters, notifications, provider outcomes, or dashboard JSON.
- [ ] `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` pass.

Suggested files:

- `src/server/db/**`
- `src/server/providers/**`
- `src/server/security/**`
- `src/server/env-core.ts`
- `src/app/api/approvals/route.ts`
- `docs/operations.md`

### Phase 2: Coupang Read-Only Sync

Goal: Pull provider state into the app safely and idempotently.

Tasks:

- [ ] Implement `coupang.orders.sync-minute`.
- [ ] Implement `coupang.orders.sync-day-backfill`.
- [ ] Implement `coupang.orders.refresh-single`.
- [ ] Implement `coupang.returns.sync`.
- [ ] Implement `coupang.shipments.history-sync`.
- [ ] Implement `coupang.cs.product-inquiries.sync`.
- [ ] Implement `coupang.cs.contact-center.sync`.
- [ ] Implement `coupang.cs.contact-center.refresh-single`.
- [ ] Add checkpointing and overlap windows for every sync job.
- [ ] Store provider identifiers as strings.
- [ ] Do not depend on buyer email fields.

Coupang constraints to encode in tests:

- [ ] PO day query: max 31 days, page size max 50.
- [ ] PO minute query: max 24 hours.
- [ ] Return/cancel query: separate from PO list; return-complete may be absent from PO list.
- [ ] Product inquiry query: max 7 days, page size max 50.
- [ ] Contact-center query: max 7 days, page size max 30.
- [ ] Coupang baseline rate limit: keep app cap below 5 requests/sec/vendor.
- [ ] `shipmentBoxId` can be 18 digits; keep as string.

Acceptance:

- [ ] Mocked sync persists orders, return/cancel requests, product inquiries, and contact-center inquiries idempotently.
- [ ] Re-running the same sync window does not duplicate rows or tasks.
- [ ] Removed/empty buyer email fixtures pass.

Suggested files:

- `src/server/coupang/**`
- `src/server/cron/**`
- `src/server/jobs/**`
- `src/server/db/schema.ts`
- `src/server/**/__fixtures__/**`

### Phase 3: Data Model Expansion

Goal: Add durable tables for operational automation.

Add or expand order domain:

- [ ] `order_lines`
- [ ] `order_snapshots`
- [ ] `order_events`
- [ ] `order_risk_flags`

Add fulfillment domain:

- [ ] `fulfillment_tasks`
- [ ] `ownerclan_orders`
- [ ] `shipment_updates`

Add claim/return domain:

- [ ] `claim_requests`
- [ ] `claim_events`
- [ ] `claim_tasks`

Add CS domain:

- [ ] `cs_threads`
- [ ] `cs_messages`
- [ ] `cs_drafts`
- [ ] `cs_templates`
- [ ] `cs_actions`

Add automation policy domain:

- [ ] `automation_rules`
- [ ] `automation_rule_runs`

Acceptance:

- [ ] Drizzle migration is generated and manually inspected.
- [ ] Unique indexes include provider/vendor/external id combinations.
- [ ] PII-bearing data is encrypted, masked, hashed, or discarded according to the envelope.
- [ ] Rollback notes are documented before migration.

Suggested files:

- `src/server/db/schema.ts`
- `src/server/db/migrations/**`
- `docs/operations.md`

### Phase 4: Operational Inbox And Dashboard

Goal: Replace static dashboard numbers with "what do I need to do today?"

Tasks:

- [ ] Build DB-backed summary builders.
- [ ] Show new orders needing fulfillment.
- [ ] Show waiting Ownerclan order tasks.
- [ ] Show tracking missing / waybill upload due.
- [ ] Show cancellation/return risk.
- [ ] Show unanswered product inquiries.
- [ ] Show unanswered contact-center inquiries.
- [ ] Show transferred contact-center inquiries needing confirm.
- [ ] Show failed provider/job/dead-letter state.
- [ ] Show integration readiness and kill-switch state.

Acceptance:

- [ ] Dashboard works with no provider credentials and shows actionable not-configured states. 쿠팡 연동 화면은 미연결 상태와 입력 검증을 표시한다.
- [ ] Dashboard payloads contain no raw PII.
- [ ] Static demo data is replaced by fixtures or DB-backed queries.

Suggested files:

- `src/server/dashboard/**`
- `src/app/page.tsx`
- `src/app/**`
- `src/server/notifications/**`

### Phase 5: Ownerclan Fulfillment Queue

Goal: Create safe supplier-order work without assuming live Ownerclan API availability.

Tasks:

- [ ] Map Coupang order lines to Ownerclan product/option codes.
- [ ] Create `발주 필요` tasks for eligible orders.
- [ ] Block fulfillment when cancellation/return risk exists.
- [ ] Block fulfillment when receiver info is stale.
- [ ] Block fulfillment when Ownerclan mapping is missing.
- [ ] Support manual order id entry.
- [ ] Support CSV/manual tracking import.
- [ ] Add Ownerclan API order placement only after the Ownerclan contract gate passes.
- [ ] Store Ownerclan order status and tracking status.

Acceptance:

- [ ] The system can produce `발주 필요` and `송장 업로드 가능` queues without live Ownerclan API.
- [ ] Supplier order placement cannot run when Coupang state is stale or cancellation risk exists.
- [ ] Duplicate Ownerclan order attempts are blocked locally.

Suggested files:

- `src/server/ownerclan/**`
- `src/server/fulfillment/**`
- `src/server/uploads/**`
- `docs/integrations/ownerclan-contract.md`

### Phase 6: Shipment And Waybill Execution

Goal: Prepare and execute shipment actions safely.

Tasks:

- [ ] Create tasks for product-in-preparation update.
- [ ] Create tasks for waybill upload.
- [ ] Create tasks for waybill update.
- [ ] Enforce status: product-in-preparation update only from `Payment completed`.
- [ ] Keep product-in-preparation batches under 50 `shipmentBoxId` values.
- [ ] Parse per-item partial errors and retry only retryable cases.
- [ ] Refresh single PO after product-in-preparation update to capture address changes.
- [ ] Refresh single PO before waybill upload.
- [ ] Refresh return/cancel state before waybill upload.
- [ ] Verify no shipment suspend/cancel/return risk.
- [ ] Verify courier code and invoice number format.
- [ ] Verify exact `orderId`, `shipmentBoxId`, and `vendorItemId` mapping.
- [ ] Handle duplicate waybill risk within Coupang's 6-month duplicate window.
- [ ] Validate split shipping, pre-split, estimated shipping date, and direct courier rules.

Acceptance:

- [ ] Dry-run waybill upload records intended request and redacted outcome without network calls.
- [ ] Ambiguous timeout re-queries provider state before retry.
- [ ] Fixture tests cover duplicate waybill, split shipping, direct courier, invalid courier code, invalid invoice format, and partial outcomes.

Suggested files:

- `src/server/shipments/**`
- `src/server/coupang/**`
- `src/server/providers/**`
- `src/server/approvals/**`

### Phase 7: CS Assistant

Goal: Turn CS into a managed inbox with safe drafts and approvals.

Tasks:

- [ ] Sync product inquiries.
- [ ] Sync contact-center inquiries.
- [ ] Refresh single contact-center inquiry before reply or confirm.
- [ ] Classify thread category:
  - delivery ETA
  - tracking request
  - cancellation/refund request
  - return pickup/receipt
  - product/option question
  - complaint/escalation
  - unclear/manual
- [ ] Create versioned Korean CS templates.
- [ ] Generate draft replies from templates and live order/shipment state.
- [ ] Block drafts when required variables are missing.
- [ ] Block high-risk categories into manual review.
- [ ] Add approval queue for replies.
- [ ] Execute product inquiry reply after approval.
- [ ] Execute contact-center reply after approval.
- [ ] Execute contact-center confirm after approval or deterministic policy.

Coupang CS constraints to encode:

- [ ] Product inquiry answers are one reply per `inquiryId`.
- [ ] Reply content must be JSON-safe.
- [ ] Contact-center answer only when unanswered / answer-requested.
- [ ] Contact-center answer requires `parentAnswerId`.
- [ ] Contact-center answer content length is 2-1000 characters.
- [ ] Contact-center confirm only in `TRANSFER` state.
- [ ] Contact-center confirm is unavailable after closure or 24 hours.
- [ ] Do not depend on `buyerEmail`.

Acceptance:

- [ ] Common delivery/tracking inquiry creates a draft using live order/shipment state.
- [ ] Cancellation/refund/complaint categories are manual-review by default.
- [ ] Duplicate reply attempts are blocked by idempotency and provider state.
- [ ] AI freeform replies are not auto-sent in MVP.

Suggested files:

- `src/server/cs/**`
- `src/server/coupang/**`
- `src/server/approvals/**`
- `docs/cs-templates.md`

### Phase 8: Claim / Return Workflow

Goal: Prevent fulfillment and refund mistakes around cancellation/return state.

Tasks:

- [ ] Create tasks from return/cancellation requests.
- [ ] Detect `preRefund`.
- [ ] Detect `completeConfirmType`.
- [ ] Detect `releaseStopStatus`.
- [ ] Detect partial return/cancel quantities.
- [ ] Handle `cancelType=CANCEL` query separately from return status queries.
- [ ] Approval-gate return receipt confirmation.
- [ ] Approval-gate return approval.
- [ ] Approval-gate pickup waybill upload.
- [ ] Approval-gate seller cancellation.
- [ ] Approval-gate shipment suspend / already released processing.
- [ ] Link claim context to order, fulfillment, shipment, and CS threads.

Acceptance:

- [ ] Claim dashboard shows required action, due time, risk flags, and linked context.
- [ ] Fulfillment and waybill tasks are blocked when release-stop/cancel/return risk exists.
- [ ] Refund/return-completing actions cannot auto-execute by default.

Suggested files:

- `src/server/claims/**`
- `src/server/coupang/**`
- `src/server/fulfillment/**`
- `src/server/shipments/**`

### Phase 9: Notifications And SLAs

Goal: Alert the operator before misses become customer or seller-score problems.

Tasks:

- [ ] Notify unanswered CS approaching 20 hours.
- [ ] Notify contact-center transfer approaching 24-hour risk.
- [ ] Notify waybill missing near cutoff.
- [ ] Notify cancellation after Ownerclan order placement.
- [ ] Notify return/cancel request created.
- [ ] Notify provider 403/429/circuit open.
- [ ] Notify dead-letter or repeated job failure.
- [ ] Keep notification provider abstraction for email/Slack later.

Acceptance:

- [ ] Notification tests cover de-duplication.
- [ ] Severity routing is deterministic.
- [ ] Notification payloads contain no raw PII.

Suggested files:

- `src/server/notifications/**`
- `src/server/alerts/**`
- `src/server/jobs/**`

### Phase 10: Automation Policy UI

Goal: Promote only proven safe actions from draft/approval mode to auto mode.

Tasks:

- [ ] Add automation rule admin UI.
- [ ] Default every rule to `disabled` or `draft_only`.
- [ ] Add rule modes: `disabled`, `draft_only`, `approval_required`, `auto_execute`.
- [ ] Add max daily execution caps.
- [ ] Add cooldown after failure.
- [ ] Add emergency kill switch integration.
- [ ] Add rule run history.
- [ ] Require explicit promotion for any provider write.

Promotion requirements:

- [ ] At least 20 consecutive approved successes for the same action class.
- [ ] Zero provider failures in the last 7 days.
- [ ] Zero manual corrections in the last 7 days.
- [ ] Daily cap configured.
- [ ] Rollback/disable path documented.

Eligible first auto-rules:

- [ ] Create internal tasks.
- [ ] Notify operator.
- [ ] Resolve low-risk internal housekeeping.

Later opt-in candidates:

- [ ] Upload trusted tracking for no-risk orders.
- [ ] Send narrow tracking reply when tracking already exists.

Not eligible by default:

- [ ] Seller cancellation.
- [ ] Refund/return approval.
- [ ] Complaint replies.
- [ ] Uncertain ETA promises.

Suggested files:

- `src/server/automation/**`
- `src/app/**`
- `src/server/providers/**`

## Cross-Phase Verification Checklist

Run these before treating a phase as complete:

- [ ] `pnpm test`
- [ ] `pnpm typecheck`
- [ ] `pnpm lint`
- [ ] `pnpm build`
- [ ] `pnpm test:e2e`
- [ ] Add or update detailed Playwright tests in `tests/e2e/**` for every Next.js user flow or browser-observable behavior touched by the phase.
- [ ] Confirm unauthenticated requests cannot reach protected app/API data.
- [ ] Confirm tenant isolation on every query, mutation, job, approval, notification, upload, and provider action touched by the phase.
- [ ] For schema work: `pnpm db:generate`
- [ ] Inspect generated SQL manually.
- [ ] Confirm no raw PII appears in serialized logs, API responses, notifications, dead letters, approval previews, or dashboard payloads.
- [ ] Confirm provider writes are blocked when kill switch is active.
- [ ] Confirm provider writes are blocked without fresh provider-state checks.
- [ ] Confirm retry behavior re-queries ambiguous provider state before retrying.

## Fixture Backlog

Add fixtures for these provider scenarios:

- [ ] Coupang transport 200 with business error.
- [ ] Coupang 403 and 429.
- [ ] 18-digit `shipmentBoxId`.
- [ ] Empty/removed buyer email.
- [ ] Product-in-preparation partial success with `retryRequired`.
- [ ] Duplicate waybill within 6 months.
- [ ] Split-shipping waybill request.
- [ ] Direct-courier waybill request.
- [ ] Invalid courier code.
- [ ] Invalid invoice number format.
- [ ] Cancellation query with `cancelType=CANCEL`.
- [ ] Return/cancel response with `preRefund`.
- [ ] Return/cancel response with `releaseStopStatus`.
- [ ] Return/cancel response with `completeConfirmType`.
- [ ] Return complete absent from PO list but present in return API.
- [ ] Product inquiry duplicate reply.
- [ ] Product inquiry without `buyerEmail`.
- [ ] Contact-center inquiry over 24 hours.
- [ ] Contact-center already answered/closed.
- [ ] Ownerclan duplicate order attempt.
- [ ] Ownerclan unknown post-timeout state.

## Suggested Build Order

Use this order when work resumes:

1. Phase 0: product pivot and docs.
2. Phase 0.5: SaaS auth, protected app shell, tenant model, onboarding, and tenant-scoped credentials.
3. Phase 1: transaction-safe DB, provider-control, PII envelope.
4. Phase 2: read-only Coupang sync.
5. Phase 3: data model expansion.
6. Phase 4: operational inbox dashboard.
7. Phase 5: Ownerclan fallback and contract evidence.
8. Phase 6: approval-gated shipment/waybill actions.
9. Phase 7: CS assistant.
10. Phase 8: claim/return workflow.
11. Phase 9: notifications/SLAs.
12. Phase 10: automation policy UI and later auto-execution.

Do not jump to real provider data sync or live provider writes before SaaS auth/tenant isolation, phases 1 and 2 are verified.

## Suggested Team Lanes

If using `$team`, split write ownership like this:

- DB/Foundation: `src/server/db/**`, migrations, `src/server/providers/**`, `src/server/security/**`, env/docs for secrets.
- SaaS/Auth/Tenancy: `src/server/auth/**`, `src/server/tenancy/**`, auth docs, public auth routes, app shell, membership policies.
- Coupang Sync: `src/server/coupang/**`, `src/server/cron/**`, job handlers and fixtures.
- CS Domain: `src/server/cs/**`, CS templates, CS fixtures, CS docs.
- Ownerclan/Fulfillment/Shipment: `src/server/ownerclan/**`, `src/server/fulfillment/**`, `src/server/shipments/**`, Ownerclan contract docs and fixtures.
- Dashboard/Notifications: `src/app/**`, `src/server/dashboard/**`, `src/server/notifications/**`.
- Verification: test-only fixes and final evidence report unless coordinating with a lane owner.

## Open Decisions

These require user or provider evidence later:

- [ ] Which Ownerclan API endpoints are actually enabled for this account?
- [ ] Which auth provider should be used for Vercel SaaS deployment?
- [ ] Should signup be public self-serve, invite-only beta, or owner-created accounts first?
- [ ] What billing provider and subscription model should gate usage?
- [ ] Which roles are needed beyond owner, admin, operator, and viewer?
- [ ] What is the preferred CS reply tone and template set?
- [ ] Which notifications should go to email, Slack, or only dashboard?
- [ ] What order cutoff times matter for this seller?
- [ ] Which actions should eventually be eligible for policy auto-execution?
- [ ] Whether a worker/static-egress service becomes necessary after real volume is observed.

## Auth Reference Notes

Official references checked for the SaaS planning update:

- Next.js Authentication guide: `https://nextjs.org/docs/app/guides/authentication`
- Vercel Sign in with Vercel guide: `https://vercel.com/docs/sign-in-with-vercel/getting-started`
- Next.js Server Actions and cookie mutation docs checked from the installed Next.js docs.

Use current official docs again before implementing auth because provider APIs and Next.js route conventions can change.

## Definition Of Done For This Roadmap

The roadmap is only complete when:

- [ ] The dashboard is centered on order/CS operations.
- [ ] Users can sign up, log in, and enter only authorized tenant workspaces.
- [ ] Tenant-scoped credentials, jobs, uploads, approvals, notifications, provider calls, and audit logs cannot cross tenant boundaries.
- [ ] Read-only Coupang sync is reliable and idempotent.
- [ ] PII is encrypted/masked/redacted according to the envelope.
- [ ] Ownerclan fallback works without live API.
- [ ] Ownerclan live API work is gated by documented contract evidence.
- [ ] Shipment/waybill execution is approval-gated and provider-controlled.
- [ ] CS replies are drafted from templates and approval-gated.
- [ ] Claim/return risks block unsafe fulfillment and shipment actions.
- [ ] Notifications catch CS, shipment, provider, and claim risks before SLA misses.
- [ ] Automation rules start disabled/draft-only and can be promoted only with evidence.
