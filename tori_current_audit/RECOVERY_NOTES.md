# TORIWEAR project recovery notes

## Repairs applied
- Fixed a missing closing `});` in `server/authStore.ts` that caused TypeScript parser errors in the staff 2FA login branch.
- Removed the public customer "Instant Sign In as Saif" shortcut and its automatic fallback when Firebase Google sign-in fails. Customers must now complete real Google authentication.
- Made Firebase browser-local persistence awaitable before starting Google sign-in.
- Updated the server Content Security Policy to allow the Firebase/Google authentication endpoints and Google-hosted profile images.

## Security cleanup
- The distributable project intentionally does not include `.env` because it contained server credentials and secrets.
- The distributable project intentionally does not include the `backups/` database export because it contains staff credential hashes, 2FA secrets, and partner information.
- Keep the original uploaded ZIP in a secure location if you need that backup. Do not publish or share it.
- Rotate the database password, session secret, 2FA encryption key, and any payment gateway secrets from the excluded `.env` file if they were real/active.

## Setup
1. Copy `.env.example` to `.env` only in a private local/deployment environment.
2. Fill in valid server-side values. Never commit or upload `.env`.
3. In Firebase Console, open Authentication -> Settings -> Authorized domains and add the exact Google AI Studio preview hostname and your production hostname.
4. In Firebase Console -> Authentication -> Sign-in method, ensure Google is enabled.
5. Install dependencies with `npm install`, then run `npm run dev`.

## Verification limitation
The TypeScript/TSX source files passed a syntax-transpilation check after repair. A full dependency-backed build could not be completed in this environment because the package registry connection timed out during dependency installation. Run `npm install` and `npm run build` in Google AI Studio or a connected local environment to complete the full build check.
