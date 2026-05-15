# Auth And Tenancy ADR

Status: accepted for Phase 0.5 foundation
Last updated: 2026-05-15 KST

## Decision

Use Clerk as the production authentication provider for the Vercel SaaS deployment.

The local/test path uses `AUTH_PROVIDER_MODE=development` with an HTTP-only development session cookie so the app shell, onboarding, and Playwright tests can run before real Clerk keys are available. Public Vercel production must not enable development sessions; user-accessible production auth uses `AUTH_PROVIDER_MODE=clerk`.

## Why Clerk

- Official Next.js App Router support for `ClerkProvider`, `clerkMiddleware()` in `src/proxy.ts`, and server-side `auth()`.
- Hosted signup/login plus prebuilt sign-in/sign-up components, which keeps this product focused on order/CS operations instead of password/session security.
- Organization support for future workspace switching, invitations, and role mapping.
- Clear publishable key versus server secret split for Vercel.

Official references checked:

- https://clerk.com/docs/nextjs/getting-started/quickstart
- https://clerk.com/docs/reference/nextjs/app-router/auth
- https://clerk.com/docs/reference/nextjs/overview
- https://clerk.com/docs/nextjs/guides/organizations/getting-started
- https://clerk.com/docs/guides/organizations/add-members/invitations

## Local Session Contract

Development mode creates a session with:

- auth provider subject id
- local user id
- tenant id, name, and slug
- membership role
- email and display name

This lets server components and route handlers exercise the same authorization path as production. It is not a production auth system.

Before a tenant-scoped API writes `users`, `tenants`, `memberships`, `approvals`, or `uploads`, it upserts the local user and tenant rows and then re-derives the effective role from the local active membership.

## Production Contract

User-accessible production deployment must set:

- `AUTH_PROVIDER_MODE=clerk`
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`
- `CLERK_SECRET_KEY`

Pre-public bootstrap production may temporarily use `AUTH_PROVIDER_MODE=development` only with `AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION=false`. That state keeps the public login and signup forms closed while infrastructure, database, Blob storage, cron, and routing are verified.

`AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION=true` is rejected for public Vercel production. It may only be used for local/E2E runs or protected non-production Vercel preview validation before Clerk keys exist.

The app stores local `users`, `tenants`, `memberships`, and `invitations` so provider identity is not treated as the only source of product authorization. Clerk proves identity; local membership state owns app roles and tenant access.

Unknown Clerk organization roles and authenticated users without an active organization are denied tenant access instead of being promoted to an owner-like role.

## Tenant Rules

- The current tenant comes from server-resolved session membership.
- Client-supplied tenant ids are selectors only after membership verification.
- Route handlers must call tenant helpers before tenant-scoped reads or writes.
- Coupang credentials are tenant-scoped `integration_accounts` rows, written from the protected app UI, and stored with the Phase 1 encryption envelope. Ownerclan credentials remain a later integration.

## Remaining Work

- Add Clerk webhook reconciliation so local `users`, `tenants`, and `memberships` stay synchronized outside first tenant-scoped API writes.
- Build production invitation creation with Clerk Organization invitations plus local `invitations`.
- Add Ownerclan and later marketplace credential entry screens using the same encrypted tenant-scoped pattern.
- Add billing and plan enforcement once product packaging is decided.
