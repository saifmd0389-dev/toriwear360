# TORIWEAR — Updated Release Audit (15 November 2026)

## Release status: NOT APPROVED FOR PUBLIC PRODUCTION LAUNCH

This package is a source-code handoff with selected security hardening. It is not a certified production release.

## Changes made in this package

1. Removed the bundled database backup export, which contained operational and authentication-related data.
2. Removed the nested older `ToriWear_production_ready.zip` to prevent accidentally deploying a stale archive.
3. Removed the persisted `.auth-sessions.json` file from the distributable package.
4. Removed default/demo password autofill and the quick-fill credential directory from the admin login screen.
5. Removed default password display/copy behavior from the partner and staff management screens; the UI now indicates that secure invitation is required.
6. Made legacy in-memory session authentication unavailable through the shared `requireAuth` middleware in production.
7. Disabled seeded in-memory legacy admin credentials in production. Development-only bootstrap requires `TORI_BOOTSTRAP_ADMIN_PASSWORD`.
8. Changed the database seed to require `TORI_INITIAL_ADMIN_PASSWORD` (at least 16 characters), generate random salts and random non-admin initial passwords, and avoid resetting existing password hashes on every seed run.
9. Made production repository lookups/session handling fail closed rather than authenticating from in-memory fallback users/sessions.

## Remaining critical blockers

- **Authentication migration is incomplete.** Several legacy route handlers and the realtime socket still call `authStore.getUserByToken` directly. The shared middleware no longer accepts that fallback in production, but direct legacy handlers must also be migrated to persistent session validation; otherwise they may still accept legacy process/disk sessions.
- **Partner/staff invitation and password-reset lifecycle is not fully implemented or verified.** New non-admin seed passwords are random and are not delivered to users; the persistent invitation/reset workflow must be completed before those accounts can be used. Do not activate partner/staff accounts until that workflow is implemented and tested. Existing database credentials are not automatically rotated by this ZIP; reset them through the real deployment after the migration is ready.
- **Production database architecture and migrations are not verified.** Configure managed PostgreSQL, apply reviewed Prisma migrations, and test backup/restore.
- **Razorpay is not a verified live integration.** Implement real order creation, signature/webhook verification, idempotency, refunds and reconciliation; then test in Razorpay test mode and with a controlled live transaction.
- **Shiprocket/carrier integration is not verified.** The current shipping implementation has synthetic tracking/AWB behavior and must be replaced with live carrier API calls before fulfilment is enabled.
- **Cloud media storage is not implemented.** Configure a real persistent object-storage adapter and verify upload/read/delete permissions.
- **Storefront/customer auth, stock reservation, COD, order lifecycle, refunds, notifications and all admin modules need end-to-end tests against the production-like database.**
- **Legal and operational readiness** (returns/refunds, privacy, terms, contact/support, shipping policy, commercial rights for artwork/fonts/photos) needs owner sign-off.

## Verification performed

- Inspected the supplied 14 November archive and its prior audit/recovery notes.
- Performed source-level edits described above.
- Ran a TypeScript compiler availability check. Full type-check/build could not run because project dependencies are not installed (`vite/client` types are missing).
- No live Firebase, database, Razorpay, Shiprocket, cloud storage, deployed domain or browser session was available.
- No payment, shipping label, customer login, or production order was executed.

## Required next gate

Keep checkout and public order acceptance disabled until the legacy auth routes are migrated, all integrations are implemented with real credentials, and a full staging test suite passes. Rotate any credentials previously present in older archives or deployment environments. Never put `.env` in the ZIP or source control.
