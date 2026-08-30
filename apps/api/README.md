# Laylaty API

NestJS modular-monolith backend for the Laylaty platform. See
[`../../docs`](../../docs) for the architecture this scaffold implements:

- [`docs/database/schema.sql`](../../docs/database/schema.sql) — source of
  truth for the data model. [`prisma/schema.prisma`](prisma/schema.prisma)
  mirrors it; the ORM-inexpressible bits (the anti-double-booking `EXCLUDE`
  constraint, `CHECK` constraints) live in
  [`prisma/migrations/20260830060500_manual_constraints`](prisma/migrations/20260830060500_manual_constraints/migration.sql).
- [`docs/api/openapi.yaml`](../../docs/api/openapi.yaml) — the REST contract
  this API implements, endpoint by endpoint.
- [`docs/backlog/sprint-backlog.md`](../../docs/backlog/sprint-backlog.md) —
  every module listed there (auth, organizations, stores, catalog,
  inventory, events, bookings, carts/orders, payments, shipping,
  notifications, reviews, admin) is implemented in `src/modules/*`, wired
  end to end, and covered by the e2e suite below — this is a working MVP
  backend, not a scaffold of stubs.

## Local development

```bash
cp .env.example .env
docker compose -f ../../infrastructure/docker-compose.yml up -d postgres redis
npm install
npx prisma migrate deploy
npx prisma db seed   # wedding task templates, categories, admin roles — see prisma/seed.ts
npm run start:dev
```

API listens on `http://localhost:3000/v1`. Health check: `GET /v1/health`.

Without the seed step, the app still runs correctly — it just means no
`event_task_templates` exist yet, so creating a `wedding` event won't
auto-populate its task timeline (blueprint §17), and there are no seeded
categories or admin roles to assign.

## Tests

```bash
npm test              # unit tests (mocked Prisma/Jwt — no DB needed)
npm run test:e2e       # end-to-end (needs DATABASE_URL pointing at a real Postgres)
```

`test/auth.e2e-spec.ts` covers the Sprint 1 auth flow in isolation.
`test/full-flow.e2e-spec.ts` walks a realistic cross-module scenario:
merchant onboarding (org → store → service → booking resource) → a
customer planning an event → booking-slot discovery with a concurrent
double-hold correctly rejected (`409`, enforced by the database, not
application code) → cart checkout → idempotent payment creation →
idempotent webhook settlement → the order landing in `paid`.

## Known follow-up: dependency pins

This scaffold pins `@nestjs/*` to the v10 line (plus `@nestjs/config@^3`,
`@nestjs/throttler@^5`, `@nestjs/swagger@^7`) because the newly-released
Nest v12 line isn't yet supported by that ecosystem of plugins. `npm audit`
currently reports findings transitively pulled in by that pin (notably via
`multer`/`qs`/`lodash` in `@nestjs/platform-express` and `@nestjs/config`).
Re-run `npm audit` and consider bumping the Nest major once those plugins
publish v11/v12-compatible releases — don't `npm audit fix --force` blindly,
it will downgrade/upgrade across a Nest major and needs the same build+test
validation this scaffold went through.

## Architecture rule this codebase enforces

No module imports another module's Prisma queries directly — every module
talks to Postgres only through its own service built on the shared
`PrismaService` (`src/common/prisma`). Cross-module reads go through the
other module's exported service, never around it. This is the "Modular
Monolith" boundary from the blueprint, kept enforceable in code review
today and mechanically extractable into real microservices later if a
module's load ever justifies it.
