# 01 — ERD كامل لجميع الجداول

هذا مخطط منطقي (Logical ERD) بمستوى الـ Schemas والجداول والعلاقات الأساسية. التنفيذ الفعلي بلغة SQL موجود في [`db/schema.sql`](../../db/schema.sql).

## auth
```
users
 id (PK)
 email, phone, password_hash
 full_name, status
 created_at, updated_at
```

## platform
```
merchants
 id (PK)
 owner_user_id (FK → auth.users)
 name, status, created_at

stores
 id (PK)
 merchant_id (FK → platform.merchants)
 name, slug, business_type, currency, timezone, status

branches
 id (PK)
 store_id (FK → platform.stores)
 name, address, city, is_default

roles
 id (PK)
 store_id (FK → platform.stores, NULL = دور نظامي عام)
 name, is_system

permissions
 id (PK)
 code (unique), description

role_permissions
 role_id (FK → roles)
 permission_id (FK → permissions)

memberships
 id (PK)
 user_id (FK → auth.users)
 store_id (FK → platform.stores)
 branch_id (FK → platform.branches, NULL = كل الفروع)
 role_id (FK → platform.roles)
 status

audit_logs
 id (PK)
 store_id (FK, NULL لعمليات على مستوى المنصة)
 user_id (FK → auth.users)
 action, entity_type, entity_id
 before (jsonb), after (jsonb)
 ip_address, device_context
 created_at
```

علاقات رئيسية: `merchants 1—N stores`، `stores 1—N branches`، `stores/branches 1—N memberships`، `roles N—N permissions`.

## catalog
```
categories
 id (PK), store_id (FK), parent_id (FK self)
 name, slug

products
 id (PK), store_id (FK), category_id (FK)
 type (product | service | package)
 name, slug, status

variants
 id (PK), product_id (FK)
 sku, attributes (jsonb), status

services
 id (PK), product_id (FK)
 resource_type, duration_minutes, buffer_before_minutes, buffer_after_minutes

packages
 id (PK), store_id (FK)
 name, description

package_items
 id (PK), package_id (FK)
 item_type (variant | service), item_id
 quantity

prices
 id (PK)
 priceable_type (variant | service | package)
 priceable_id
 currency, amount
 valid_from, valid_to
```

## sales
```
carts
 id (PK), store_id (FK), customer_id (FK → crm.customers)
 status, currency, created_at

orders
 id (PK), store_id (FK), branch_id (FK)
 customer_id (FK), cart_id (FK, nullable)
 status (انظر 05-order-lifecycle ضمن 06-payment-adapter/98)
 subtotal, tax, discount, total, currency
 created_at

order_items
 id (PK), order_id (FK)
 item_type (variant | service | package)
 item_id, quantity, unit_price, tax, total

invoices
 id (PK), store_id (FK), order_id (FK)
 invoice_number (unique per store), status
 issue_date, due_date, total

invoice_items
 id (PK), invoice_id (FK)
 description, quantity, unit_price, total

payments
 id (PK), store_id (FK), order_id (FK), invoice_id (FK, nullable)
 provider, status
 amount, currency
 idempotency_key (unique)
 external_reference

refunds
 id (PK), store_id (FK), payment_id (FK)
 amount, status, reason
```

## inventory
```
warehouses
 id (PK), store_id (FK), branch_id (FK)
 name

stock
 id (PK), warehouse_id (FK), variant_id (FK)
 available_qty, reserved_qty
 unique (warehouse_id, variant_id)

stock_movements
 id (PK), store_id (FK), warehouse_id (FK), variant_id (FK)
 type (PURCHASE|SALE|RETURN|TRANSFER|ADJUSTMENT|DAMAGE|RESERVATION|RELEASE)
 quantity, reference_type, reference_id
 created_at

inventory_reservations
 id (PK), store_id (FK), variant_id (FK), order_id (FK)
 quantity, status, expires_at
```

## booking
```
resources
 id (PK), store_id (FK)
 type (hall|vehicle|photographer|makeup_artist|room|equipment|staff)
 name, capacity, metadata (jsonb)

availability
 id (PK), resource_id (FK)
 day_of_week (nullable), specific_date (nullable)
 start_time, end_time, is_available

booking_rules
 id (PK), store_id (FK), resource_id (FK, nullable = قاعدة عامة على المتجر)
 min_notice_minutes, max_duration_minutes
 buffer_before_minutes, buffer_after_minutes

bookings
 id (PK), store_id (FK), customer_id (FK), order_id (FK, nullable)
 status (DRAFT|HOLD|PENDING_PAYMENT|CONFIRMED|CHECKED_IN|COMPLETED|CANCELLED|EXPIRED|REFUND)
 start_at, end_at

booking_items
 id (PK), booking_id (FK), resource_id (FK)
 quantity, price
```

## pos
```
registers
 id (PK), store_id (FK), branch_id (FK), name

terminals
 id (PK), register_id (FK)
 device_id (unique), name, status

cash_sessions
 id (PK), register_id (FK)
 opened_by (FK → auth.users), opening_balance, closing_balance
 opened_at, closed_at, status

cash_movements
 id (PK), cash_session_id (FK)
 type (in|out), amount, reason

pos_transactions
 id (PK), store_id (FK), terminal_id (FK), order_id (FK, nullable)
 device_id, local_transaction_id
 server_transaction_id (nullable حتى تتم المزامنة)
 sync_status (PENDING|SYNCED|CONFLICT|FAILED)
 unique (device_id, local_transaction_id)
 created_at
```

## accounting
```
accounts
 id (PK), store_id (FK), parent_id (FK self)
 code, name, type (asset|liability|equity|revenue|expense)

fiscal_periods
 id (PK), store_id (FK)
 name, start_date, end_date, status

journal_entries
 id (PK), store_id (FK), fiscal_period_id (FK)
 reference_type, reference_id, description
 posted_by (FK → auth.users), created_at

journal_lines
 id (PK), journal_entry_id (FK), account_id (FK)
 debit, credit
 -- invariant: SUM(debit) = SUM(credit) لكل journal_entry

expenses
 id (PK), store_id (FK), branch_id (FK)
 category, amount, vendor, date, status

tax_transactions
 id (PK), store_id (FK)
 reference_type, reference_id
 tax_type, rate, amount
```

## crm
```
customers
 id (PK), store_id (FK)
 full_name, email, phone, created_at

customer_addresses
 id (PK), customer_id (FK)
 label, address_line, city, is_default

customer_notes
 id (PK), customer_id (FK)
 author_user_id (FK → auth.users), note, created_at

customer_events
 id (PK), customer_id (FK)
 event_type, payload (jsonb), created_at
```

## logistics (امتداد للبندين 108 و109)
```
carriers
 id (PK), store_id (FK)
 name, type (external|internal)

vehicles
 id (PK), store_id (FK)
 plate_number, type, capacity, status

drivers
 id (PK), store_id (FK), user_id (FK → auth.users)
 license_number, status

fulfillments
 id (PK), store_id (FK), order_id (FK)
 type (shipping|transportation)
 carrier_id (FK, nullable للنقل الداخلي)
 status

shipments
 id (PK), fulfillment_id (FK)
 tracking_number, status

trips
 id (PK), fulfillment_id (FK)
 vehicle_id (FK), driver_id (FK)
 route (jsonb), pickup_at, dropoff_at
 passengers_count, status
```

## integrations
```
apps
 id (PK), name, slug, developer_id (FK → auth.users)
 status, scopes (jsonb)

app_versions
 id (PK), app_id (FK)
 version, manifest (jsonb)

installations
 id (PK), store_id (FK), app_id (FK)
 status, installed_at

credentials
 id (PK), installation_id (FK)
 key_name, encrypted_value

permissions
 id (PK), app_id (FK)
 permission_code

webhooks
 id (PK), store_id (FK), installation_id (FK, nullable)
 url, events (jsonb), secret, status

webhook_deliveries
 id (PK), webhook_id (FK)
 event_type, payload (jsonb)
 status, attempt_count, last_attempt_at

app_events
 id (PK), app_id (FK)
 event_type, payload (jsonb), created_at
```

## notifications (امتداد للبندين 117 و118)
```
templates
 id (PK), store_id (FK, NULL = قالب نظامي)
 event_type, channel (push|sms|email|whatsapp), body_template

preferences
 id (PK), store_id (FK), user_id (FK, nullable = تفضيل افتراضي للمتجر)
 event_type, channel, enabled

deliveries
 id (PK), store_id (FK)
 event_type, channel, recipient
 status, provider_reference, created_at
```

## مخطط العلاقات رفيع المستوى

```
merchants ──< stores ──< branches
                │
                ├──< memberships >── users
                │         │
                │      roles >── role_permissions ──< permissions
                │
                ├──< categories ──< products ──< variants ──< prices
                │                       │
                │                       └──< services
                │
                ├──< resources ──< availability
                │        │
                │        └──< booking_items >── bookings ──< order? (0..1)
                │
                ├──< warehouses ──< stock
                │        └──< stock_movements
                │
                ├──< orders ──< order_items
                │       ├──< invoices ──< invoice_items
                │       ├──< payments ──< refunds
                │       └──< fulfillments ──< shipments / trips
                │
                ├──< registers ──< terminals ──< pos_transactions
                │
                ├──< accounts ──< journal_lines >── journal_entries
                │
                └──< customers ──< customer_addresses / notes / events
```
