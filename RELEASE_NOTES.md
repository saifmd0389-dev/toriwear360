# Tori-Wear source package — 15 November 2026

This package preserves the existing storefront, brand assets, product artwork and admin source while applying limited security cleanup.

## Important
This is **not** a production-ready release. See `LAUNCH_READINESS_REVIEW.md` for the exact changes, remaining blockers and verification limitations. Do not enable live checkout or public order acceptance until every critical blocker is resolved and staging verification passes.

## Setup
1. Extract the ZIP in a private development environment.
2. Copy `.env.example` to `.env` and supply valid private values. Never commit or upload `.env`.
3. Configure managed PostgreSQL, Firebase authorized domains, and provider credentials only in the deployment environment.
4. Install dependencies and run the project checks in a connected environment.
5. Follow the launch gates in `LAUNCH_READINESS_REVIEW.md`.
