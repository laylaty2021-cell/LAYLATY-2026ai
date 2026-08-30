# Laylaty Engineering Documentation

This folder turns the platform engineering blueprint into executable
engineering artifacts.

| Document | Purpose |
|---|---|
| [`database/schema.sql`](database/schema.sql) | Complete PostgreSQL DDL for the MVP — all modules, enums, constraints, and indexes. Validated to apply cleanly on PostgreSQL 16. |
| [`database/erd.md`](database/erd.md) | Entity Relationship Diagrams (Mermaid), split by domain, plus the Booking and Order state machines. |
| [`backlog/sprint-backlog.md`](backlog/sprint-backlog.md) | MVP delivery plan as 13 two-week sprints, mapped to schema tables and blueprint sections. |

## How these fit together

1. `schema.sql` is the source of truth for the data model — every table
   referenced in the backlog or drawn in the ERD exists there verbatim.
2. `erd.md` explains *why* the schema is shaped the way it is (tenant
   isolation, unified commerce polymorphism, booking concurrency safety,
   payment idempotency).
3. `sprint-backlog.md` sequences the work needed to build against that
   schema, sprint by sprint, with explicit exit criteria per sprint.

## Validating the schema locally

```bash
createdb laylaty_dev
psql -d laylaty_dev -v ON_ERROR_STOP=1 -f docs/database/schema.sql
```
