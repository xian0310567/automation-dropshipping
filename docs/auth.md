# Auth And Tenancy ADR

Status: accepted for Phase 0.6 direct auth
Last updated: 2026-05-16 KST

## Decision

Use a first-party email/password authentication flow backed by the Neon database.

Production runs with `AUTH_PROVIDER_MODE=password`. The app stores password hashes in `password_credentials`, stores only hashed bearer session tokens in `auth_sessions`, and sends the raw session token only as an HTTP-only cookie. Local and Playwright runs may still use `AUTH_PROVIDER_MODE=development` with the existing HTTP-only development session cookie.

## Why Direct Auth

- The operator does not want to manage a separate Clerk/Auth0-style service.
- The current product needs one straightforward SaaS login path before billing, organization switching, or advanced invitations.
- The existing tenant model already has `users`, `tenants`, and `memberships`, so direct auth can map login identity to the same authorization path.

## Password And Session Contract

- Sign up creates a `users` row, a `password_credentials` row, one tenant workspace, and an owner `memberships` row.
- Passwords are hashed with `scrypt` and per-password random salt. Plaintext passwords are never stored.
- Sign in verifies the hash, creates an `auth_sessions` row, and sets `oc_session` as an HTTP-only cookie.
- `auth_sessions.token_hash` stores a SHA-256 hash of the cookie token. The raw bearer token is not persisted.
- Login and signup actions consume DB-backed `auth_rate_limits` attempts before expensive password work.
- Logout revokes the current DB session and clears both production and development cookies.
- Sessions expire after 14 days.

## Production Contract

User-accessible production deployment should set:

- `AUTH_PROVIDER_MODE=password`
- `AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION=false`
- `DATABASE_URL`
- `DATABASE_DIRECT_URL`
- `CRON_SECRET`
- `BLOB_READ_WRITE_TOKEN`
- `PII_ENCRYPTION_KEY`

`AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION=true` is rejected for public Vercel production. It may only be used for local/E2E runs or protected non-production preview validation.

## Tenant Rules

- The current tenant comes from the server-resolved session membership.
- Client-supplied tenant ids are selectors only after membership verification.
- Route handlers must call tenant helpers before tenant-scoped reads or writes.
- Coupang credentials are tenant-scoped `integration_accounts` rows, written from the protected app UI, and stored with the Phase 1 encryption envelope. Ownerclan credentials remain a later integration.

## Remaining Work

- Add password reset or magic-link recovery before inviting external operators.
- Build production invitation acceptance against local `invitations`; password mode currently disables invite acceptance until that flow exists.
- Add account management screens for changing password, disabling users, and revoking sessions.
- Add billing and plan enforcement once product packaging is decided.
