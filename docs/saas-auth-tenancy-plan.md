# SaaS Auth And Tenancy Plan

Last updated: 2026-05-15 KST
Related TODO: [order-cs-automation-todo.md](order-cs-automation-todo.md)

## Purpose

This product should be deployable on Vercel as a SaaS application, not only as a local single-operator dashboard. Users need to sign up, log in, join or create a seller workspace, and use the order/CS automation service only inside authorized tenant boundaries.

The temporary `OPERATOR_API_KEY` flow remains useful for local MVP development, but it is not the production auth model.

## Target Shape

- Public landing, signup, login, logout, session recovery, and invitation acceptance.
- Protected app shell for all dashboard, order, CS, approval, upload, and integration screens.
- Organization or tenant workspaces for each seller operation.
- Membership roles: `owner`, `admin`, `operator`, `viewer`.
- Tenant-scoped Coupang and Ownerclan integration accounts.
- Tenant-scoped jobs, uploads, approvals, notifications, provider calls, and audit logs.
- First-run onboarding for workspace creation, seller profile, Coupang credentials, Ownerclan readiness, and notification setup.

## Auth Provider Decision

Do not implement auth until the provider is chosen and documented. Candidate directions:

- Managed SaaS auth provider: fastest for signup/login, invitations, sessions, and future team management.
- Auth.js/NextAuth-style self-managed auth: more control, more responsibility for account/session/invitation behavior.
- Vercel Sign in with Vercel: useful for owner/admin scenarios, but not necessarily enough for public seller signup.

Decision criteria:

- Works cleanly with Next.js App Router and Vercel deployment.
- Supports server-side session checks in route handlers and server components.
- Supports invitations or can be paired with local invitation records.
- Allows reliable mapping from auth subject to local `users`, `tenants`, and `memberships`.
- Has a clear production secret model and documented publishable/server-only key split.
- Does not force provider credentials or PII into client-visible state.

Official references checked for this planning pass:

- Next.js Authentication guide: `https://nextjs.org/docs/app/guides/authentication`
- Vercel Sign in with Vercel guide: `https://vercel.com/docs/sign-in-with-vercel/getting-started`
- Clerk Next.js App Router auth reference: `https://clerk.com/docs/reference/nextjs/app-router/auth`

Re-check current official docs before implementation.

## Data Model Backlog

- [ ] `users`: local user profile, auth provider subject id, status, timestamps.
- [ ] `tenants` or `organizations`: workspace name, owner, status, plan, created time.
- [ ] `memberships`: user, tenant, role, status.
- [ ] `invitations`: tenant, email, role, token hash, expiry, accepted metadata.
- [ ] `tenant_integration_accounts`: tenant-scoped Coupang/Ownerclan credential refs, encrypted payload refs, readiness state.
- [ ] Audit actor fields on sensitive tables: `tenantId`, `userId`, `membershipRole`, auth provider subject id.

## Route And API Backlog

- [ ] Public route group for landing, signup, login, session recovery, and invitation acceptance.
- [ ] Protected app route group for the dashboard and all operations pages.
- [ ] Server-side auth guard for all dashboard data loaders and protected route handlers.
- [ ] Tenant context resolver that uses session + membership, never trusted client body fields.
- [ ] Role policy helper for owner/admin/operator/viewer checks.
- [ ] Tenant-scoped query helper for server modules.
- [ ] Onboarding routes for workspace setup and integration readiness.

## Security Gates

- [ ] Unauthenticated users cannot load protected pages or call protected APIs.
- [ ] Users can access only tenants where they have active membership.
- [ ] Tenant ids supplied from client bodies, query strings, or route params are treated as selectors only after server membership verification.
- [ ] Tenant A cannot read, approve, execute, upload, notify, or audit Tenant B data.
- [ ] Production Coupang and Ownerclan credentials are encrypted per tenant and never stored as global env secrets.
- [ ] Vercel Cron uses `CRON_SECRET`, then derives tenant work from database schedules.
- [ ] `OPERATOR_API_KEY` is local/dev only once public SaaS mode is enabled.

## Suggested Build Order

1. Choose auth provider and document the ADR in this file or a follow-up `docs/auth.md`.
2. Add auth/session plumbing and protected app shell.
3. Add tenant, membership, invitation, and role model.
4. Add tenant context resolver and tenant-scoped query helpers.
5. Move integration credentials into encrypted tenant-scoped records.
6. Add onboarding.
7. Add tenant-isolation tests across dashboard, uploads, approvals, jobs, notifications, provider actions, and audits.
8. Continue with provider-control, PII envelope, and read-only Coupang sync.

## Open Decisions

- [ ] Public self-serve signup, invite-only beta, or owner-created accounts first?
- [ ] Which auth provider should be used?
- [ ] Which billing provider and plan limits should gate usage?
- [ ] Whether every user gets one default tenant or must create/join a tenant explicitly.
- [ ] Whether `viewer` can see masked PII or only aggregate status.
