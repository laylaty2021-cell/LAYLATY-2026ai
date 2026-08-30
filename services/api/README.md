# @laylaty/api

The first working slice of the Laylaty MVP backend described in
[`docs/blueprint/20-roadmap-mvp-v1-v2.md`](../../docs/blueprint/20-roadmap-mvp-v1-v2.md):
Identity & Access, Stores/Branches, Catalog, Booking, Orders and Payments,
built directly on the schema and RLS policies in
[`db/schema.sql`](../../db/schema.sql) / [`db/rls_policies.sql`](../../db/rls_policies.sql).

It is a Modular Monolith (Fastify + `pg`, no ORM) per
[`docs/blueprint/00-architecture-overview.md`](../../docs/blueprint/00-architecture-overview.md) —
one deployable process, internally organized as one module per bounded
context under `src/modules/`.

## Two database roles, on purpose

Every tenant-scoped request runs through `withUserContext(userId, fn)`
([`src/db.ts`](./src/db.ts)), which opens a transaction as the
`laylaty_app` role and sets `request.jwt.claim.sub` so
[`db/rls_policies.sql`](../../db/rls_policies.sql) actually restricts rows
to the caller's stores — this is what
[`docs/blueprint/15-multi-tenant-security.md`](../../docs/blueprint/15-multi-tenant-security.md)
calls the second line of defense, and it is real here, not just documented:
`laylaty_app` has `NOSUPERUSER NOBYPASSRLS`, so a bug in a route handler's
`WHERE store_id = ...` clause still can't leak another tenant's rows.

Store creation is the one operation that must run before any membership
exists to authorize it, so it runs via `withServiceContext(fn)` on the
separate `laylaty_service` role (`BYPASSRLS`) instead — see
[`db/roles.sql`](../../db/roles.sql).

## Setup

```bash
# 1. Run the migrations, in order, as a superuser/admin role:
psql -f ../../db/schema.sql
psql -f ../../db/roles.sql
psql -f ../../db/auth_uid_selfhosted.sql   # skip this one if deploying on Supabase
psql -f ../../db/seed_permissions.sql
psql -f ../../db/rls_policies.sql

# 2. Configure and run the API
cp .env.example .env   # edit DATABASE_URL / SERVICE_DATABASE_URL if needed
npm install
npm run dev
```

## Testing

```bash
npm test
```

The test suite (`test/*.test.ts`) resets a real local Postgres database
(`laylaty_test`) before each file and drives the API through
`fastify.inject()` — no mocking of the database or RLS layer. It exists to
prove specific claims made in the blueprint are actually true of this code,
not just documented:

- **`multi-tenant.test.ts`** — a user with no membership on a store gets
  `403`/`404`, never another tenant's data.
- **`idempotency.test.ts`** — a repeated `Idempotency-Key` on
  `POST /payments` returns the original payment (no double charge, no
  second provider call), and a reused key with a different payload is
  rejected with `422`.
- **`booking.test.ts`** — an overlapping booking on the same resource is
  rejected with `409` by the database-level exclusion constraint (not
  merely application logic), and cancelling a booking frees the slot for
  reuse.

Requires passwordless `sudo -u postgres` locally (already the case in this
repo's dev containers) since the test helper shells out to `psql`/`createdb`
to reset state between runs.

## What's deliberately out of scope here

Per [`docs/blueprint/20-roadmap-mvp-v1-v2.md`](../../docs/blueprint/20-roadmap-mvp-v1-v2.md),
this slice does not yet include: multi-branch scoping, multi-warehouse
inventory, POS offline/sync, a real payment gateway (see
[`src/modules/payments/provider.ts`](./src/modules/payments/provider.ts) —
`MockPaymentProvider` implements the `PaymentProviderAdapter` interface from
[`docs/blueprint/08-payment-adapter.md`](../../docs/blueprint/08-payment-adapter.md)
so swapping in a real one is additive), accounting journal entries, refunds,
recurring (day-of-week) availability rules, or a pricing engine (order line
items take a caller-supplied `unit_price` rather than resolving
`catalog.prices` server-side).
