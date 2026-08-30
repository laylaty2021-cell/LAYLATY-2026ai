# Laylaty Platform — MVP Sprint Backlog

Scope: **MVP v1 only** (see blueprint §38 `MVP SCOPE`). Everything under
§39 `FEATURES TO POSTPONE` (advanced AI, POS, accounting, public developer
API, multi-language marketplace) is explicitly out of scope here.

- **Cadence:** 2-week sprints, 13 sprints ≈ 6 months, matching the
  blueprint's Month 1–6 roadmap (§40).
- **Team:** 1 PO, 1 Tech Lead, 2 Backend, 2 Flutter, 1 Web, 1 UI/UX, 1 QA
  (blueprint §41, minimum team).
- **Definition of Ready** for any story: API contract drafted, DB tables
  from [`schema.sql`](../database/schema.sql) exist, design mock available
  (customer/merchant flows) or N/A for backend-only stories.
- **Definition of Done** for any story: unit tests pass, code reviewed,
  deployed to Staging, QA sign-off, no unresolved P1/P2 bug.

Every story references its backing table(s) in `schema.sql` so backend work
has no ambiguity about the target schema.

---

## Epic Map

| Epic | Sprints | Modules touched |
|---|---|---|
| E1 — Foundation & Auth | 1–2 | `users`, `refresh_tokens`, `otp_codes` |
| E2 — Organizations & Stores | 1–2 | `organizations`, `organization_members`, `stores`, `store_modules` |
| E3 — Catalog | 3–4 | `categories`, `products`, `product_variants`, `services`, `packages`, `package_items` |
| E4 — Merchant Dashboard | 3–4 | cross-module read APIs |
| E5 — Events Engine | 5–6 | `events`, `event_tasks`, `event_budget_items`, `event_task_templates` |
| E6 — Booking Engine | 7–8 | `booking_resources`, `resource_availability_rules`, `resource_blackout_dates`, `bookings` |
| E7 — Cart, Checkout & Orders | 9–10 | `carts`, `cart_items`, `orders`, `order_items` |
| E8 — Payments | 9–10 | `payments`, `payment_webhook_events`, `refunds` |
| E9 — Shipping & Inventory | 11 | `inventory_locations`, `inventory_stock`, `inventory_movements`, `shipments`, `shipment_events` |
| E10 — Notifications & Reports | 11–12 | `notifications` + read-model reports |
| E11 — Admin Panel | throughout | `admin_roles`, `admin_permissions`, `audit_logs` |
| E12 — Hardening & Launch | 12–13 | testing, observability, launch checklist |

---

## Sprint 0 — Project Setup (pre-Sprint 1, 1 week, Tech Lead + DevOps)

Not a delivery sprint; unblocks Sprint 1.

- [ ] Monorepo scaffolding per blueprint §5 (`apps/`, `packages/`, `infrastructure/`)
- [ ] NestJS API skeleton with `modules/` folder structure (§5)
- [ ] PostgreSQL + Redis via Docker Compose for local dev
- [ ] Apply `docs/database/schema.sql` via first migration (Prisma or TypeORM — pick one, see ADR-001 below)
- [ ] CI pipeline: lint + test on PR (blueprint §35)
- [ ] Environments: `development`, `staging`, `production` configs (§34)

**ADR-001 (to resolve before Sprint 1):** Prisma vs TypeORM. Blueprint
recommends Prisma with a Repository layer on top so modules never import
`PrismaClient` directly — this keeps the "no cross-module direct DB access"
rule (blueprint §3) enforceable in code review.

---

## Sprint 1 — Identity & Tenancy Foundations

**Goal:** a user can register/login, and the org/store shell exists.

- **S1.1** Register via phone/email + password (`users`) — OTP verification (`otp_codes`)
- **S1.2** Login issuing short-lived JWT + `refresh_tokens`; refresh & logout endpoints
- **S1.3** Password hashing (argon2/bcrypt), rate-limited login (Redis)
- **S1.4** `organizations` CRUD (owner-only create) + `organization_members` invite flow
- **S1.5** Admin RBAC tables seeded (`admin_roles`, `admin_permissions`) with `super_admin` seed role
- **S1.6** Global `AuthGuard` + `TenantContext` middleware: derives `organization_id`/`store_id` from the authenticated principal, never from request params (blueprint §6)

**Exit criteria:** Postman/E2E suite covers register → login → refresh →
create org, all requests correctly scoped to the caller's tenant.

---

## Sprint 2 — Merchant Onboarding & Store Setup

**Goal:** full onboarding wizard from blueprint §8.

- **S2.1** Business type selection (`stores.business_type` enum)
- **S2.2** Store creation (`stores`: name, slug uniqueness check, logo/cover upload to Object Storage)
- **S2.3** `store_modules` enablement per Business Template (§9) — seed default module sets per `business_type`
- **S2.4** Organization KYC fields (`commercial_registration`, `tax_number`) + admin approval flow (`org_status`)
- **S2.5** Merchant web app: onboarding wizard screens (Next.js)
- **S2.6** Admin panel: pending-organization approval queue

**Exit criteria:** a merchant can go from signup to an `active` store with
the correct modules enabled for their business type, gated on admin approval.

---

## Sprint 3 — Catalog: Products & Services

**Goal:** merchants can list sellable items.

- **S3.1** `categories` tree CRUD (admin-managed, public read)
- **S3.2** Product CRUD + `product_variants` (`products`, `product_variants`)
- **S3.3** Service CRUD (`services`) with `duration_minutes`
- **S3.4** Image upload pipeline → Object Storage, async resize via BullMQ worker
- **S3.5** Public storefront read APIs: list/search products & services by store, category, city (Postgres full-text search per §15)
- **S3.6** Merchant dashboard: catalog management UI

**Exit criteria:** a florist store can publish products; a photographer
store can publish services; both are visible on the public storefront.

---

## Sprint 4 — Catalog: Packages & Merchant Dashboard Home

**Goal:** bundling + first real merchant dashboard.

- **S4.1** `packages` + `package_items` CRUD (bundle products/services/booking resources)
- **S4.2** Merchant dashboard home: dynamic widgets per business type (§20 — "Today's Bookings" for halls, "Orders Today" for flower shops)
- **S4.3** Basic merchant reports: revenue-to-date, item counts (no BI yet)
- **S4.4** Customer app: browse stores/catalog screens (Flutter, `features/stores`, `features/catalog`)

**Exit criteria:** a "باقة زفاف كاملة" package can be created bundling a
hall + florist + photographer item, and appears correctly on the storefront.

---

## Sprint 5 — Events Engine: Core

**Goal:** the platform's differentiator ships — Event as first-class object.

- **S5.1** `events` CRUD (customer creates an event: type, date, city, budget)
- **S5.2** `event_tasks` CRUD, manual add/complete
- **S5.3** `event_budget_items` CRUD, planned vs actual tracking
- **S5.4** Customer app: Event Dashboard screen (§21 — days remaining, budget status, tasks)
- **S5.5** Customer app: `EVENT` creation flow wired into registration funnel

**Exit criteria:** a customer can create a wedding event and see a working
dashboard with manually-added tasks and budget lines.

---

## Sprint 6 — Event Automation

**Goal:** the "90/60/45/30/14/7/1 day" journey from §17 is automatic.

- **S6.1** `event_task_templates` seed data per `event_type` (wedding, birthday, corporate)
- **S6.2** Scheduled worker (BullMQ cron): on event creation, instantiate `event_tasks` from templates based on `days_before_event` offsets against `events.event_date`
- **S6.3** Reminder worker: daily job flags due/overdue tasks, queues notification jobs (stub — real send in Sprint 11)
- **S6.4** Rule-based recommendation stub (§18): "event_type = wedding AND no hall booking yet → recommend wedding halls" surfaced on Event Dashboard

**Exit criteria:** creating a wedding event 90 days out auto-populates the
correct task timeline with no manual entry.

---

## Sprint 7 — Booking Engine: Resources & Availability

**Goal:** bookable resources exist with real availability rules.

- **S7.1** `booking_resources` CRUD (hall/car/studio) scoped to store
- **S7.2** `resource_availability_rules` (weekly opening hours) CRUD
- **S7.3** `resource_blackout_dates` CRUD (maintenance/holiday blocks)
- **S7.4** Availability query API: given a resource + date range, return free slots (rules − blackout − existing bookings)
- **S7.5** Merchant dashboard: calendar view (read-only first)

**Exit criteria:** querying availability for a hall correctly excludes
blacked-out dates and respects weekly hours.

---

## Sprint 8 — Booking Engine: Holds & State Machine

**Goal:** race-condition-proof booking creation (blueprint §11, §14 second
half of ADR concerns).

- **S8.1** `POST /bookings` creates a `held` row inside a DB transaction; rely on the `EXCLUDE USING gist` constraint on `bookings` (see `erd.md` §4) to guarantee no double-booking under concurrent requests — **do not** implement availability check + insert as two separate statements
- **S8.2** Hold TTL worker: expire `held` bookings past `hold_expires_at` → `expired`, freeing the slot
- **S8.3** Booking cancellation flow (customer/merchant) → `cancelled`
- **S8.4** Customer app: date picker + hold creation UI
- **S8.5** Load test: two concurrent hold requests for the same slot — verify exactly one succeeds (this is a mandatory QA gate, not optional)

**Exit criteria:** concurrency test in S8.5 passes consistently across 100 runs.

---

## Sprint 9 — Cart, Checkout & Order Creation

**Goal:** unify products/services/bookings into one checkout.

- **S9.1** `carts` + `cart_items` (polymorphic `item_type`/`item_id`, optional `booking_id`)
- **S9.2** Cart → Order conversion: `orders` + `order_items` created atomically, price snapshot (`name_snapshot`, `unit_price`) taken at conversion time
- **S9.3** Inventory reservation on add-to-cart (`inventory_movements: reserve`) per §14 — release on cart abandonment (worker)
- **S9.4** Order numbering scheme (`order_number` human-readable, unique)
- **S9.5** Customer app: cart & checkout screens

**Exit criteria:** a cart mixing a product (with variant), a service, and a
pending booking hold converts into one order with correct line items.

---

## Sprint 10 — Payments

**Goal:** real money moves, safely (blueprint §12 payment architecture).

- **S10.1** Payment Provider abstraction interface (`createPayment`, `verifyPayment`, `getPaymentStatus`, `refundPayment`, `handleWebhook`) — implement one provider first (e.g. Moyasar/HyperPay/Tap, pick per market)
- **S10.2** `payments` row created with a generated `idempotency_key` before redirecting to provider
- **S10.3** Webhook endpoint: verify signature → upsert into `payment_webhook_events` keyed on `(provider, event_id)` → process only if `processed_at IS NULL` → update `payments.status` → update `orders.status`/`bookings.status`
- **S10.4** **Hard rule:** order/booking is only marked paid from the verified webhook path, never from the client-side redirect return (§12, "مهم")
- **S10.5** `refunds` flow, admin-initiated, calls `refundPayment()`
- **S10.6** Confirm inventory reservation → `confirm` movement on payment success; release on failure

**Exit criteria:** replaying the same webhook payload twice results in
exactly one recorded payment and no duplicate order state transitions.

---

## Sprint 11 — Shipping, Notifications, Inventory polish

**Goal:** physical fulfillment + communications come online.

- **S11.1** Shipping Provider abstraction (`getRates`, `createShipment`, `trackShipment`) — one provider integrated
- **S11.2** `shipments` + `shipment_events` lifecycle wired to order status (§13 stage diagram)
- **S11.3** Notification Service: `notifications` table + BullMQ workers for push/SMS/email dispatch on events (`booking.confirmed`, `payment.success`, `order.delivered`, `event.reminder`)
- **S11.4** Multi-location `inventory_locations`/`inventory_stock` for merchants with >1 warehouse
- **S11.5** Merchant dashboard: order fulfillment & shipment tracking UI

**Exit criteria:** a paid order for a physical product produces tracking
updates visible to the customer and triggers the right notifications.

---

## Sprint 12 — Admin Panel & Reporting

**Goal:** platform operators can run the business (§19).

- **S12.1** Admin panel: Users, Organizations, Stores, Categories management
- **S12.2** Admin panel: Orders/Bookings/Payments/Refunds views with `super_admin` vs `support` permission split (support cannot touch financial settings, per §19)
- **S12.3** `audit_logs` write-through on every sensitive admin action (refunds, suspensions) — who/what/when/from-where (§25)
- **S12.4** Basic merchant reports: revenue by period, booking utilization, order status breakdown
- **S12.5** Dashboard-level metrics wiring (API response time, error rate, payment failure rate — §37, minimum viable observability)

**Exit criteria:** an admin can refund a payment and the action is fully
traceable in `audit_logs` with before/after state.

---

## Sprint 13 — Hardening, Testing & Launch Prep

**Goal:** production-readiness (§36, §38 exit).

- **S13.1** Full regression pass: Payment, Booking, Checkout, Inventory, Permissions test suites (§36 "أهم الاختبارات") — these four are release blockers, not nice-to-have
- **S13.2** Security pass: rate limiting, input validation, webhook signature checks, HTTPS-only, dependency audit (§23)
- **S13.3** Daily backup + PITR configured on production Postgres (§30)
- **S13.4** Load test on booking concurrency and checkout paths at expected launch volume
- **S13.5** Staging → Production promotion rehearsal via CI/CD pipeline (§35)
- **S13.6** Launch checklist sign-off: PO + Tech Lead + QA

**Exit criteria:** MVP scope (§38) fully deployed to Production, all four
release-blocking test suites green, rollback plan documented.

---

## Explicit Non-Goals for This Backlog

Per blueprint §39, do **not** create stories in this backlog for:
Advanced AI planning/recommendations, full accounting/POS, advanced CRM,
multi-language marketplace, public developer API, Elasticsearch/OpenSearch
migration, or the microservices split (§44) — all revisited only after MVP
metrics justify them.
