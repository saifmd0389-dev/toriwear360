# TORI-WEAR — Implementation Continuation Audit (17 November 2026)

## Release status: NOT YET APPROVED FOR PUBLIC PRODUCTION

This archive contains substantial source-code implementation work. It is not a build-verified or live-provider-certified production release.

## Implemented in this continuation

### Authentication and password recovery
- Production password reset account lookup uses MySQL rather than process-local demo users.
- Password-reset tokens are SHA-256 hashed, single-use, expire after 15 minutes, and are consumed transactionally with password update and active-session revocation.
- Reset email uses enabled Resend vault credentials or server environment credentials; responses remain generic to prevent account enumeration.
- Added persistent `StaffInvitationToken` storage, 48-hour single-use invitation tokens, transactional activation, and an Admin account-activation screen/route.
- Added request throttling for password reset, invitation issue and activation endpoints.
- Production legacy in-memory session lookups remain fail-closed; async session validation reads persistent database sessions.

### Central API & Integrations vault
- Credential records support encrypted JSON field sets, masked display, replace/rotation, enable/disable, delete and provider connection tests.
- Credential rotation disables the integration until a new successful test is recorded.
- Secrets are not returned to the browser. Test calls use fixed provider endpoints; arbitrary URL execution is not permitted.
- Resend and Meta WhatsApp notification delivery/webhook verification consume enabled vault credentials.
- Razorpay payment operations and the checkout public-key endpoint can use enabled vault credentials when complete existing payment-settings/environment credentials are absent.
- Shiprocket adapter initialization and webhook token validation can use enabled vault credentials when existing carrier credentials are absent.
- Gemini story/text and image generation can use enabled Google AI vault credentials when environment keys are absent.
- Gmail OAuth refresh-token sending is implemented for Early Access and account-security email. OpenAI supports a connection test only and has no application feature wired. Custom providers require a reviewed server-side connector.

### Dynamic Early Access coupons
- Campaign records have an optional coupon code.
- Admin campaign composer lists active coupons from the main Coupons manager.
- Draft creation and dispatch revalidate the selected coupon against the main coupon repository.
- Campaign email and WhatsApp template parameters use the selected campaign coupon rather than a hard-coded TORI100 assumption.
- New Early Access registrations no longer auto-assign TORI100.

### Persistent media storage
- Implemented Google Cloud Storage adapter using `@google-cloud/storage`.
- Implemented Shiprocket reverse-pickup creation for delivered orders, persistent RETURN shipment records, return tracking webhook status mapping, and an Admin order drawer action.
- CMS base64 and chunked upload endpoints now use the configured storage adapter.
- Chunk staging moved outside the public directory.
- Local storage path traversal is constrained. Local storage remains the development default.

## Required database migrations

- `20261117_auth_lifecycle`: creates persistent staff invitation token table.
- `20261117_early_access_notifications`: existing Early Access notification schema.
- `20261117_z_campaign_coupon_selector`: adds `couponCode` to notification campaigns after the campaign table exists.
- `20261117_zz_return_shipments`: adds a forward/return shipment discriminator and lookup index.

Set `DATABASE_URL` to the MySQL database and run `npm run db:migrate:deploy`, followed by `npm run db:generate`. Back up the database first and verify migrations against staging before production.

## Verification completed here

- Input ZIP archive integrity check passed before extraction.
- 226 TypeScript/TSX files scanned with TypeScript transpile syntax diagnostics: **zero syntax errors**.
- Static inspection confirms MySQL Prisma provider, persistent token models, provider-vault lookups, coupon campaign field, return shipment model field and CMS storage-adapter wiring.
- Removed nested release ZIPs and database backup/session artifacts from the distribution archive.

## Verification not completed

- Full TypeScript typecheck and Vite production build: not run successfully because dependencies are not installed in this environment (`vite/client` definitions are unavailable); `@google-cloud/storage` also requires a fresh dependency install.
- Prisma schema validation/client generation and migrations: not run because Prisma CLI is unavailable here.
- No staging MySQL database was supplied, so transaction/migration behavior was not end-to-end tested.
- No live Resend, Meta, Razorpay, Shiprocket, Google AI or GCS account credentials were supplied. Admin connection tests are implemented but were not executed against real accounts.
- No complete browser end-to-end regression suite was run.

## Remaining launch blockers / external verification

1. Install dependencies and run the complete TypeScript check and production build.
2. Validate Prisma schema, apply migrations to a staging MySQL database, and verify backup/restore.
3. Test password-reset and invitation email delivery, expiry, replay and concurrent consumption.
4. Test Meta approved templates and signed webhook callbacks. If sending a campaign coupon over WhatsApp, the approved template must have a final body parameter placeholder for the coupon value.
5. Run Razorpay test-mode checkout, payment signature, webhook replay/idempotency, refunds and reconciliation.
6. Run Shiprocket serviceability, rate, shipment creation, label, tracking, cancellation and reverse-pickup tests. Reverse-pickup source code is implemented but not live-verified; validate the return-shipment endpoint payload, AWB assignment and pickup scheduling against your account.
7. Configure and verify GCS bucket permissions, upload, public retrieval and deletion. No cloud credentials or bucket are included.
8. OpenAI feature wiring, arbitrary custom-provider connectors and full production-like end-to-end regression tests remain outstanding. Gmail OAuth still needs a real consent flow/refresh token and live delivery test. Reverse-pickup refunds remain a manual review/payment step.
9. Review legal pages, GST/business details, privacy/consent, returns/refunds, shipping policies, support contacts and artwork/font/photo commercial rights before launch.

**Do not treat the ZIP as production-ready until the build, staging database, backup/restore, provider tests and end-to-end commerce regression suite pass.**
