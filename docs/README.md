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
| [`../apps/api`](../apps/api) | The NestJS backend — every module from the schema is implemented (auth, organizations, stores, catalog, inventory, events, bookings, carts/orders, payments, shipping, notifications, reviews, admin), not just scaffolded. 7 e2e + 3 unit tests pass against a live Postgres. |
| [`../apps/customer`](../apps/customer) | The Flutter customer app. `auth` and `events` (the Event Dashboard — the platform's differentiator screen) are real, working code wired to `apps/api`; other features are scaffolded per the architecture doc, not yet implemented. |
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
   (Flutter customer app, Next.js merchant/admin panels — the latter not
   yet built) — every endpoint in the sprint backlog has a matching path
   here.
4. `sprint-backlog.md` sequences the work needed to build against that
   schema and contract, sprint by sprint, with explicit exit criteria.
5. `apps/api` implements that contract end to end: every module owns its
   own tables and is only reachable from other modules through its
   exported service (`TenantAccessService` gates every merchant-side
   write), matching the Modular Monolith boundary from the blueprint.
6. `apps/customer` consumes that contract from the client side — its
   `auth`/`events` `data/` classes are hand-written directly against
   `openapi.yaml`'s schemas, so the two never drift on a field name.

## Known gaps (not yet built)

- **Next.js merchant/admin dashboards** — `docs/api/openapi.yaml` covers
  their endpoints (`/merchant/*`, `/admin/*`), but no frontend exists yet.
- **Flutter features beyond auth/events** — stores, catalog, bookings,
  cart, orders, notifications, profile (see the `NOTE.md` in each
  `apps/customer/lib/features/*` folder).
- **Real payment/shipping providers** — `apps/api` ships a swappable
  provider interface with a mock implementation; no live Moyasar/HyperPay/
  Tap or carrier integration yet.
- **Fine-grained admin RBAC** — `admin_roles`/`admin_permissions` tables
  and seed data exist, but the current `AdminGuard` only checks
  `userType === 'admin'`, not per-permission.
- **Image upload, real deployment target, advanced search/observability**
  — explicitly deferred per the blueprint's own postponement list.

## Validating things locally

```bash
# The hand-written SQL schema
createdb laylaty_dev
psql -d laylaty_dev -v ON_ERROR_STOP=1 -f docs/database/schema.sql

# The OpenAPI contract
npx @redocly/cli lint docs/api/openapi.yaml

# The backend
cd apps/api && cp .env.example .env && npm install
npx prisma migrate deploy && npx prisma db seed && npm run build && npm test

# The Flutter app
cd apps/customer && flutter pub get && flutter analyze && flutter test
```
