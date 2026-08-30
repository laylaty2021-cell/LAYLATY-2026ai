# Laylaty Platform — Entity Relationship Diagram (ERD)

This ERD mirrors [`schema.sql`](./schema.sql) exactly — every entity, field name,
and relationship below has a matching table in the SQL. The diagram is split into
six domain views (matching the backend modules) because a single 40-table
diagram is unreadable; a combined key-relationship map closes the section.

Conventions:
- `PK` primary key, `FK` foreign key, `UK` unique key
- All primary keys are `UUID` (`gen_random_uuid()`)
- All monetary columns are `NUMERIC(12,2)` with an explicit `currency`
- Polymorphic references (`item_type` + `item_id`) are drawn as dashed notes,
  not real FKs, since Postgres cannot enforce polymorphic FKs directly

---

## 1. Identity & Multi-Tenant Root

```mermaid
erDiagram
    USERS ||--o{ REFRESH_TOKENS : has
    USERS ||--o{ ADDRESSES : has
    USERS ||--o{ ADMIN_USER_ROLES : "granted"
    ADMIN_ROLES ||--o{ ADMIN_USER_ROLES : "assigned to"
    ADMIN_ROLES ||--o{ ADMIN_ROLE_PERMISSIONS : has
    ADMIN_PERMISSIONS ||--o{ ADMIN_ROLE_PERMISSIONS : "granted by"

    USERS ||--o{ ORGANIZATIONS : owns
    USERS ||--o{ ORGANIZATION_MEMBERS : "is member of"
    ORGANIZATIONS ||--o{ ORGANIZATION_MEMBERS : has
    ORGANIZATIONS ||--o{ STORES : owns
    STORES ||--o{ STORE_MODULES : enables

    USERS {
        uuid id PK
        citext email UK
        varchar phone UK
        text password_hash
        user_type user_type
        user_status status
    }
    ORGANIZATIONS {
        uuid id PK
        uuid owner_user_id FK
        varchar name
        org_status status
    }
    STORES {
        uuid id PK
        uuid organization_id FK
        citext slug UK
        business_type business_type
        store_status status
        jsonb settings
    }
    STORE_MODULES {
        uuid store_id FK
        varchar module_key
        boolean enabled
    }
```

**Tenant isolation rule:** every row below the `STORES` line carries a
`store_id` (or reaches one transitively). The API layer derives `store_id` /
`organization_id` from the authenticated user's session — it is **never**
accepted as a client-supplied parameter (see blueprint, "MULTI-TENANT
ARCHITECTURE").

---

## 2. Catalog — Unified Commerce (Product / Service / Package)

```mermaid
erDiagram
    STORES ||--o{ PRODUCTS : sells
    STORES ||--o{ SERVICES : sells
    STORES ||--o{ PACKAGES : sells
    STORES ||--o{ BOOKING_RESOURCES : offers
    CATEGORIES ||--o{ PRODUCTS : classifies
    CATEGORIES ||--o{ SERVICES : classifies
    CATEGORIES ||--o{ CATEGORIES : "parent of"
    PRODUCTS ||--o{ PRODUCT_VARIANTS : has
    PACKAGES ||--o{ PACKAGE_ITEMS : bundles
    PACKAGE_ITEMS }o--|| PRODUCTS : "item_id (polymorphic)"
    PACKAGE_ITEMS }o--|| SERVICES : "item_id (polymorphic)"
    PACKAGE_ITEMS }o--|| BOOKING_RESOURCES : "item_id (polymorphic)"

    PRODUCTS {
        uuid id PK
        uuid store_id FK
        uuid category_id FK
        numeric base_price
        catalog_item_status status
    }
    PRODUCT_VARIANTS {
        uuid id PK
        uuid product_id FK
        varchar sku UK
        jsonb attributes
        numeric price
    }
    SERVICES {
        uuid id PK
        uuid store_id FK
        integer duration_minutes
        numeric price
    }
    PACKAGES {
        uuid id PK
        uuid store_id FK
        numeric price
    }
    PACKAGE_ITEMS {
        uuid id PK
        uuid package_id FK
        sellable_item_type item_type
        uuid item_id "polymorphic"
        integer quantity
    }
```

`item_type` + `item_id` is the "Sellable Item" polymorphism described in the
blueprint's `UNIFIED COMMERCE ENGINE` — the same pattern recurs in
`cart_items`, `order_items`, and `reviews`.

---

## 3. Inventory

```mermaid
erDiagram
    PRODUCT_VARIANTS ||--o{ INVENTORY_STOCK : "stocked as"
    INVENTORY_LOCATIONS ||--o{ INVENTORY_STOCK : holds
    INVENTORY_STOCK ||--o{ INVENTORY_MOVEMENTS : logs

    INVENTORY_STOCK {
        uuid id PK
        uuid variant_id FK
        uuid location_id FK
        int quantity_on_hand
        int quantity_reserved
    }
    INVENTORY_MOVEMENTS {
        uuid id PK
        uuid stock_id FK
        inventory_movement_type movement_type
        int quantity
        varchar reference_type
        uuid reference_id
    }
```

**Available stock formula (enforced by `CHECK`):**
`quantity_on_hand - quantity_reserved >= 0`. Adding an item to a cart issues a
`reserve` movement; payment success issues `confirm`; cart expiry/cancel
issues `release` (see blueprint, "INVENTORY ENGINE").

---

## 4. Booking Engine

```mermaid
erDiagram
    BOOKING_RESOURCES ||--o{ RESOURCE_AVAILABILITY_RULES : "opens per weekday"
    BOOKING_RESOURCES ||--o{ RESOURCE_BLACKOUT_DATES : blocks
    BOOKING_RESOURCES ||--o{ BOOKINGS : reserved
    USERS ||--o{ BOOKINGS : books
    EVENTS ||--o{ BOOKINGS : "attached to"
    ORDERS ||--o{ BOOKINGS : "paid via"

    BOOKING_RESOURCES {
        uuid id PK
        uuid store_id FK
        int capacity
        numeric base_price
    }
    BOOKINGS {
        uuid id PK
        uuid resource_id FK
        uuid customer_id FK
        uuid event_id FK
        uuid order_id FK
        timestamptz starts_at
        timestamptz ends_at
        booking_status status
        timestamptz hold_expires_at
    }
```

**Double-booking prevention** is enforced at the database level with a
`PostgreSQL EXCLUDE USING gist` constraint on
`(resource_id, tstzrange(starts_at, ends_at))` for `status IN ('held',
'confirmed')` — this is the physical implementation of the blueprint's
"منع الحجز المزدوج" rule; it is a hard guarantee, not just an
application-level `is_available?` check.

**Booking state machine:**

```mermaid
stateDiagram-v2
    [*] --> held: create hold (TTL, e.g. 15 min)
    held --> confirmed: payment webhook succeeded
    held --> expired: hold TTL elapsed (worker)
    held --> cancelled: customer cancels hold
    confirmed --> cancelled: refund / merchant cancels
    confirmed --> completed: event date passed
    expired --> [*]
    cancelled --> [*]
    completed --> [*]
```

---

## 5. Events, Commerce & Payments

```mermaid
erDiagram
    USERS ||--o{ EVENTS : plans
    EVENTS ||--o{ EVENT_TASKS : contains
    EVENTS ||--o{ EVENT_BUDGET_ITEMS : contains
    EVENTS ||--o{ BOOKINGS : includes
    EVENTS ||--o{ ORDERS : includes
    USERS ||--o{ CARTS : owns
    STORES ||--o{ CARTS : "shopped at"
    CARTS ||--o{ CART_ITEMS : contains
    CART_ITEMS }o--o| PRODUCT_VARIANTS : references
    CART_ITEMS }o--o| BOOKINGS : references
    USERS ||--o{ ORDERS : places
    STORES ||--o{ ORDERS : fulfills
    ORDERS ||--o{ ORDER_ITEMS : contains
    ORDERS ||--o{ PAYMENTS : "paid by"
    BOOKINGS ||--o{ PAYMENTS : "paid by"
    PAYMENTS ||--o{ REFUNDS : refunded_by
    ORDERS ||--o{ SHIPMENTS : fulfilled_by
    SHIPMENTS ||--o{ SHIPMENT_EVENTS : tracks

    EVENTS {
        uuid id PK
        uuid customer_id FK
        varchar event_type
        date event_date
        numeric budget_total
        event_status status
    }
    ORDERS {
        uuid id PK
        varchar order_number UK
        uuid customer_id FK
        uuid store_id FK
        uuid event_id FK
        order_status status
        numeric total_amount
    }
    PAYMENTS {
        uuid id PK
        payment_target_type target_type
        uuid target_id "polymorphic: order or booking"
        varchar idempotency_key UK
        payment_status status
    }
    PAYMENT_WEBHOOK_EVENTS {
        uuid id PK
        varchar provider
        varchar event_id
        timestamptz processed_at
    }
```

**Payment idempotency** is enforced by `UNIQUE (provider, event_id)` on
`payment_webhook_events` (a duplicate provider webhook delivery is a no-op)
and by `payments.idempotency_key UNIQUE` on the create-payment side — the
direct implementation of the blueprint's "كل عملية دفع يجب أن تكون
Idempotent" rule.

**Order state machine:**

```mermaid
stateDiagram-v2
    [*] --> pending_payment
    pending_payment --> paid: webhook verified
    pending_payment --> cancelled: timeout / customer cancel
    paid --> processing: merchant accepts
    processing --> ready: items prepared
    ready --> shipped: carrier picked up
    shipped --> delivered: carrier confirms
    delivered --> completed: return window closed
    paid --> refunded: refund issued
    processing --> refunded
    completed --> [*]
    cancelled --> [*]
    refunded --> [*]
```

---

## 6. Notifications, Reviews & Audit

```mermaid
erDiagram
    USERS ||--o{ NOTIFICATIONS : receives
    USERS ||--o{ REVIEWS : writes
    STORES ||--o{ REVIEWS : "reviewed on"
    USERS ||--o{ AUDIT_LOGS : "acted as"

    NOTIFICATIONS {
        uuid id PK
        uuid user_id FK
        notification_channel channel
        varchar event_key
        notification_status status
    }
    REVIEWS {
        uuid id PK
        uuid customer_id FK
        uuid store_id FK
        sellable_item_type item_type
        uuid item_id "polymorphic"
        smallint rating
    }
    AUDIT_LOGS {
        uuid id PK
        uuid actor_id FK
        varchar action
        varchar entity_type
        uuid entity_id
        jsonb before_state
        jsonb after_state
    }
```

---

## 7. Cross-Domain Key Map (condensed)

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ STORES : owns
    STORES ||--o{ PRODUCTS : sells
    STORES ||--o{ SERVICES : sells
    STORES ||--o{ BOOKING_RESOURCES : offers
    STORES ||--o{ PACKAGES : sells
    USERS ||--o{ EVENTS : plans
    EVENTS ||--o{ BOOKINGS : includes
    EVENTS ||--o{ ORDERS : includes
    BOOKING_RESOURCES ||--o{ BOOKINGS : "reserved as"
    CARTS ||--o{ CART_ITEMS : contains
    ORDERS ||--o{ ORDER_ITEMS : contains
    ORDERS ||--o{ PAYMENTS : settled_by
    ORDERS ||--o{ SHIPMENTS : fulfilled_by
    BOOKINGS ||--o{ PAYMENTS : settled_by
```

This is the visual proof of the blueprint's central claim: **`EVENTS`, not
`STORES`, sits at the top of the customer-facing graph** — an event fans out
into bookings and orders across many different stores, which is the
structural difference from a single-store commerce platform (Salla/Zid model).
