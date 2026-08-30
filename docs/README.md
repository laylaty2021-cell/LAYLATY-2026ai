# Laylaty Engineering Documentation

This folder turns the platform engineering blueprint into executable
engineering artifacts.

| Document | Purpose |
|---|---|
| [`database/schema.sql`](database/schema.sql) | Complete PostgreSQL DDL for the MVP — all modules, enums, constraints, and indexes. Validated to apply cleanly on PostgreSQL 16. |
| [`database/erd.md`](database/erd.md) | Entity Relationship Diagrams (Mermaid), split by domain, plus the Booking and Order state machines. |
| [`api/openapi.yaml`](api/openapi.yaml) | OpenAPI 3.0 contract for the MVP REST API, endpoint by endpoint, matching the schema and sprint backlog. Lints clean with `@redocly/cli`. |
| [`backlog/sprint-backlog.md`](backlog/sprint-backlog.md) | MVP delivery plan as 13 two-week sprints, mapped to schema tables and blueprint sections. |
| [`mobile/flutter-architecture.md`](mobile/flutter-architecture.md) | Customer app structure (Feature-Based, Riverpod), matching the OpenAPI contract feature-by-feature. |
| [`../apps/api`](../apps/api) | The NestJS backend itself — not just documentation. Modular-monolith scaffold with a working Auth module (register/OTP/login/refresh, tested end-to-end against Postgres) and boundary placeholders for every other module from the schema. |
| [`../infrastructure/docker-compose.yml`](../infrastructure/docker-compose.yml) | Postgres + Redis + API + worker, one command for local dev. |
| [`../.github/workflows/ci.yml`](../.github/workflows/ci.yml) | CI: validates `schema.sql` against real Postgres, lints the OpenAPI spec, and runs the API's lint/build/unit/e2e suite. |

## How these fit together

1. `schema.sql` is the source of truth for the data model — every table
   referenced in the backlog, the ERD, or `apps/api/prisma/schema.prisma`
   exists there verbatim.
2. `erd.md` explains *why* the schema is shaped the way it is (tenant
   isolation, unified commerce polymorphism, booking concurrency safety,
   payment idempotency).
3. `openapi.yaml` is the contract between `apps/api` and both frontends
   (Flutter customer app, Next.js merchant/admin panels) — every endpoint
   in the sprint backlog has a matching path here.
4. `sprint-backlog.md` sequences the work needed to build against that
   schema and contract, sprint by sprint, with explicit exit criteria.
5. `apps/api` is Sprint 1 actually built: a real Auth module wired to
   Postgres via Prisma, plus every other module from the schema declared
   as an explicit boundary (an empty `@Module({})` pointing at the sprint
   that implements it) so the target architecture is visible in the code
   from day one, not just in this folder.

## Validating things locally

```bash
# The hand-written SQL schema
createdb laylaty_dev
psql -d laylaty_dev -v ON_ERROR_STOP=1 -f docs/database/schema.sql

# The OpenAPI contract
npx @redocly/cli lint docs/api/openapi.yaml

# The backend itself
cd apps/api && cp .env.example .env && npm install
npx prisma migrate deploy && npm run build && npm test
```
