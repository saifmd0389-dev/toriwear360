# Tori-Wear API & Integrations

The Admin Dashboard includes **Settings → API & Integrations**. It stores provider credentials in the private `website_settings` table as AES-256-GCM encrypted JSON objects. Plaintext credentials are never returned to the browser. Existing settings RBAC permissions protect the endpoints.

## Required encryption key

Set `API_CREDENTIALS_ENCRYPTION_KEY` before saving credentials. It must represent exactly 32 bytes: 64 hexadecimal characters or base64 encoding of 32 bytes. Generate a key with:

```bash
openssl rand -hex 32
```

Back it up securely. Losing this key makes saved credentials unrecoverable. Never commit it, put it in the ZIP, or expose it through a `VITE_` variable.

## How to use the vault

1. Open Admin → Settings → API & Integrations.
2. Choose the provider and enter its required fields as a JSON object.
3. Save the credentials; the record starts disabled.
4. Run the provider connection test.
5. Enable the record only after the test succeeds.
6. To rotate credentials, use Edit. Rotation disables the record and requires a new successful test before it can be enabled.

Only fixed, provider-specific test endpoints are called. The UI does not accept arbitrary request URLs or execute arbitrary user-defined API calls. Unknown/custom providers can be stored but require a reviewed server-side connector before the application can use them.

## Supported provider connections

| Provider | Credential fields | Connected application functions |
|---|---|---|
| Resend | `apiKey`, `fromAddress`, optional `replyTo`, `webhookSecret` | Early Access email, password-reset and staff-invitation email; Resend webhook signature verification |
| Meta WhatsApp Cloud API | `accessToken`, `phoneNumberId`, `templateName`, `templateLang`, `webhookVerifyToken`, `appSecret` | Early Access WhatsApp template delivery and webhook verification |
| Razorpay | `keyId`, `keySecret`, optional `webhookSecret` | Payment order creation, payment signature verification, refunds and webhook verification; existing Admin payment settings/environment configuration takes precedence when complete |
| Shiprocket | `email`, `password`, optional `webhookSecret` | Logistics adapter authentication and webhook token validation when existing carrier settings are not already configured |
| Google AI / Gemini | `apiKey` | Gemini text/story and image generation; existing server environment key takes precedence |
| OpenAI | `apiKey` | Connection test only; no OpenAI application feature is wired to this connector yet |
| Gmail | `clientId`, `clientSecret`, `refreshToken`, `userEmail`, optional `replyTo` | Early Access email, password-reset and staff-invitation email through Gmail API; requires OAuth refresh token with `gmail.send` scope (connection test validates token refresh; a real test send validates the send scope) |
| Custom | Provider-defined fields | Stored only; requires a separately reviewed server-side connector |

For email, set `EMAIL_PROVIDER=resend` or `EMAIL_PROVIDER=gmail` to force a provider; leave it blank to auto-select Resend first, then Gmail, based on enabled vault credentials. Resend and Meta server environment variables take precedence over vault values. For Razorpay, complete existing payment-settings/environment credentials take precedence; otherwise an enabled vault record can be used. For Shiprocket, existing carrier-partner credentials take precedence; otherwise an enabled vault record can be used. Gemini uses the server environment key first, then the enabled vault key.

## MySQL migrations

The Prisma schema uses **MySQL**. Configure `DATABASE_URL` for Prisma CLI migrations, then run:

```bash
npm run db:migrate:deploy
npm run db:generate
```

The additive migrations are `20261117_auth_lifecycle` (persistent staff invitation tokens), `20261117_early_access_notifications` (campaign tables), `20261117_z_campaign_coupon_selector` (campaign coupon code), and `20261117_zz_return_shipments` (forward/return shipment discriminator). Back up the database before applying migrations. Do not run schema changes against production until you have verified a staging backup/restore.

## Authentication lifecycle

Production password-reset tokens are SHA-256 hashed in MySQL, expire after 15 minutes, are single-use, and are consumed transactionally with the password update and session revocation. Staff invitations are SHA-256 hashed, single-use, expire after 48 hours, and are activated transactionally. A public application URL is required for password-reset and invitation links (`APP_URL`, defaulting to `https://thetoriwearstore.in`). Resend additionally requires a verified sender and `EMAIL_FROM_ADDRESS`; Gmail requires the OAuth refresh-token fields above.

## Shiprocket reverse pickup

The Admin Orders drawer exposes **Request Return Pickup** for orders marked DELIVERED. The current workflow creates a full-order reverse shipment (not a partial item return), uses the customer's saved delivery address as pickup, and uses the configured warehouse as the return destination. It requires complete customer address/phone/email details, warehouse address/city/state/PIN/phone, and an enabled Shiprocket connector. The adapter creates the return order, attempts AWB assignment, then requests pickup scheduling. The return shipment is stored separately from the forward shipment so the original AWB is not overwritten. Return webhooks mark the order RETURNED and restore stock only when the reverse parcel is delivered to the warehouse. Refunds are not automatically issued; process refunds through the payment workflow after return inspection.

If Shiprocket creates a return shipment but AWB assignment remains pending, the system stores that pending return and warns not to retry immediately; reconcile the return shipment in Shiprocket first to avoid duplicate reverse orders. Live account testing is required before relying on this workflow.

## Persistent media storage

The CMS base64 and chunked upload endpoints use the storage adapter. Local storage is the development default. For Google Cloud Storage, install dependencies and set `STORAGE_PROVIDER=gcs`, `GCS_BUCKET_NAME`, and a Google Cloud service identity through Application Default Credentials (`GOOGLE_APPLICATION_CREDENTIALS` or the hosting platform identity). The existing CMS upload contract returns public URLs, so the bucket must allow public object reads; uploads call `makePublic()`. If the bucket enforces uniform bucket-level access or public access prevention, uploads will fail until the bucket policy is configured appropriately. Do not bundle service-account JSON credentials in the ZIP.

## Verification limitations

The code contains provider connection tests, but they have not been run against real provider accounts in this handoff. Razorpay test-mode checkout/webhooks/refunds, Shiprocket live shipment/tracking/reverse pickup, Meta approved template delivery, Resend sender-domain delivery, and GCS upload/retrieval still require the relevant accounts, test data and credentials. Shiprocket reverse pickup source code is implemented but not live-verified. A generic arbitrary-provider connector remains unimplemented.
