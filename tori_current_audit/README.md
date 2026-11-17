# Tori-Wear storefront and operations platform

This repository contains the Tori-Wear storefront, Admin Dashboard, commerce APIs and integration services.

## Requirements
- Node.js 20.19 or newer
- MySQL database (Prisma schema provider: MySQL)

## Local setup
1. Install dependencies: `npm install`
2. Copy `.env.example` to `.env` and configure private values. Never commit `.env` or bundle provider credentials.
3. Set `DATABASE_URL` to your MySQL connection string.
4. Apply migrations to a backed-up development/staging database: `npm run db:migrate:deploy`
5. Generate the Prisma client: `npm run db:generate`
6. Start the app: `npm run dev`

## Build and checks
- `npm run lint`
- `npm run build`

## Important operational guides
- `LAUNCH_READINESS_REVIEW.md` — outstanding launch gates and known limitations
- `API_INTEGRATIONS_SETUP.md` — encrypted API vault, provider connectors, Gmail OAuth and GCS configuration
- `IMPLEMENTATION_STATUS_17_NOV_2026.md` — continuation changes
- `TEST_RESULTS.md` — checks performed and checks not completed

Do not treat this archive as production-ready until the full dependency-backed build, Prisma validation, staging MySQL migration/restore, provider tests and end-to-end commerce regression suite pass.
