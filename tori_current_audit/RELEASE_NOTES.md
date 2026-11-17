# Tori-Wear source package — 17 November 2026

This is an implementation-continuation source package, not a build-verified production release.

## New source implementations in this handoff
- Persistent, hashed, single-use MySQL password-reset tokens and transactional session revocation.
- Persistent, hashed, single-use staff invitation tokens, 48-hour expiry and an Admin activation screen.
- Resend and Gmail OAuth email sending through the central encrypted API vault.
- Encrypted multi-field API credential records, masked admin management, provider connection tests and rotation/enable controls.
- Provider-vault credential resolution for Meta WhatsApp, Razorpay, Shiprocket and Google AI/Gemini.
- Dynamic coupon selection and validation per Early Access campaign; removed hard-coded TORI100 campaign assumptions.
- Google Cloud Storage adapter and CMS upload integration for base64 and chunked media uploads.
- Shiprocket reverse-pickup creation, persistent return shipment tracking and Admin Orders return action.
- Updated MySQL migration instructions, environment template and audit/test reports.

## Security and packaging
- No `.env`, local auth-session file, database backup or service-account JSON credentials are included.
- API credentials are encrypted with AES-256-GCM. Configure `API_CREDENTIALS_ENCRYPTION_KEY` before saving credentials.
- Unknown/custom APIs cannot execute arbitrary URLs. A reviewed server-side connector is required.

## Required setup
1. Run `npm install` to resolve dependencies (including `@google-cloud/storage`) and generate/update the npm lockfile.
2. Configure server environment values from `.env.example` outside the ZIP.
3. Back up the MySQL database, validate migrations on staging, then run `npm run db:migrate:deploy` and `npm run db:generate`.
4. Run `npm run lint` and `npm run build` in an environment with dependencies installed.
5. Configure and test provider accounts, OAuth scopes, GCS bucket permissions and end-to-end store flows.

Read `LAUNCH_READINESS_REVIEW.md`, `API_INTEGRATIONS_SETUP.md` and `TEST_RESULTS.md` before deployment.
