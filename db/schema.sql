-- =====================================================================
-- Laylaty Technical Blueprint v1 — PostgreSQL Schema
-- Matches docs/blueprint/01-erd.md and docs/blueprint/02-database-schema.md
-- Target: PostgreSQL 14+ (Supabase-compatible)
-- Run order: this file first, then db/rls_policies.sql
-- =====================================================================

create extension if not exists "pgcrypto"; -- for gen_random_uuid()

create schema if not exists auth;
create schema if not exists platform;
create schema if not exists catalog;
create schema if not exists sales;
create schema if not exists inventory;
create schema if not exists booking;
create schema if not exists pos;
create schema if not exists accounting;
create schema if not exists crm;
create schema if not exists logistics;
create schema if not exists integrations;
create schema if not exists notifications;

-- =====================================================================
-- auth
-- =====================================================================
create table if not exists auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    phone text unique,
    password_hash text,
    full_name text not null,
    status text not null default 'active' check (status in ('active','suspended','deleted')),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- =====================================================================
-- platform
-- =====================================================================
create table if not exists platform.merchants (
    id uuid primary key default gen_random_uuid(),
    owner_user_id uuid not null references auth.users(id),
    name text not null,
    status text not null default 'active' check (status in ('active','suspended','closed')),
    created_at timestamptz not null default now()
);

create table if not exists platform.stores (
    id uuid primary key default gen_random_uuid(),
    merchant_id uuid not null references platform.merchants(id) on delete cascade,
    name text not null,
    slug text not null unique,
    business_type text not null, -- hall | transportation | florist | photography | catering | generic ...
    currency text not null default 'SAR',
    timezone text not null default 'Asia/Riyadh',
    status text not null default 'active' check (status in ('active','suspended','closed')),
    created_at timestamptz not null default now()
);

create table if not exists platform.branches (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    name text not null,
    address text,
    city text,
    is_default boolean not null default false,
    created_at timestamptz not null default now()
);

create table if not exists platform.roles (
    id uuid primary key default gen_random_uuid(),
    store_id uuid references platform.stores(id) on delete cascade, -- null = system role
    name text not null,
    is_system boolean not null default false,
    created_at timestamptz not null default now(),
    unique (store_id, name)
);

create table if not exists platform.permissions (
    id uuid primary key default gen_random_uuid(),
    code text not null unique, -- e.g. orders.create, accounting.delete
    description text
);

create table if not exists platform.role_permissions (
    role_id uuid not null references platform.roles(id) on delete cascade,
    permission_id uuid not null references platform.permissions(id) on delete cascade,
    primary key (role_id, permission_id)
);

create table if not exists platform.memberships (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users(id) on delete cascade,
    store_id uuid not null references platform.stores(id) on delete cascade,
    branch_id uuid references platform.branches(id) on delete cascade, -- null = all branches
    role_id uuid not null references platform.roles(id),
    status text not null default 'active' check (status in ('active','suspended')),
    created_at timestamptz not null default now(),
    unique (user_id, store_id, branch_id)
);

create table if not exists platform.audit_logs (
    id uuid primary key default gen_random_uuid(),
    store_id uuid references platform.stores(id) on delete set null,
    user_id uuid references auth.users(id) on delete set null,
    action text not null,
    entity_type text not null,
    entity_id uuid,
    before jsonb,
    after jsonb,
    ip_address inet,
    device_context jsonb,
    created_at timestamptz not null default now()
);

-- =====================================================================
-- catalog
-- =====================================================================
create table if not exists catalog.categories (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    parent_id uuid references catalog.categories(id) on delete set null,
    name text not null,
    slug text not null,
    unique (store_id, slug)
);

create table if not exists catalog.products (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    category_id uuid references catalog.categories(id) on delete set null,
    type text not null check (type in ('product','service','package')),
    name text not null,
    slug text not null,
    status text not null default 'draft' check (status in ('draft','active','archived')),
    created_at timestamptz not null default now(),
    unique (store_id, slug)
);

create table if not exists catalog.variants (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references catalog.products(id) on delete cascade,
    sku text,
    attributes jsonb not null default '{}'::jsonb,
    status text not null default 'active' check (status in ('active','archived'))
);

create table if not exists catalog.services (
    id uuid primary key default gen_random_uuid(),
    product_id uuid not null references catalog.products(id) on delete cascade,
    resource_type text not null, -- hall | vehicle | photographer | makeup_artist | room | equipment | staff
    duration_minutes int not null,
    buffer_before_minutes int not null default 0,
    buffer_after_minutes int not null default 0
);

create table if not exists catalog.packages (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    name text not null,
    description text
);

create table if not exists catalog.package_items (
    id uuid primary key default gen_random_uuid(),
    package_id uuid not null references catalog.packages(id) on delete cascade,
    item_type text not null check (item_type in ('variant','service')),
    item_id uuid not null,
    quantity numeric not null default 1
);

create table if not exists catalog.prices (
    id uuid primary key default gen_random_uuid(),
    priceable_type text not null check (priceable_type in ('variant','service','package')),
    priceable_id uuid not null,
    currency text not null default 'SAR',
    amount numeric(14,2) not null,
    valid_from timestamptz not null default now(),
    valid_to timestamptz
);

-- =====================================================================
-- sales
-- =====================================================================
create table if not exists sales.carts (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    customer_id uuid,
    status text not null default 'open' check (status in ('open','converted','abandoned')),
    currency text not null default 'SAR',
    created_at timestamptz not null default now()
);

create table if not exists sales.orders (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    branch_id uuid references platform.branches(id),
    customer_id uuid,
    cart_id uuid references sales.carts(id),
    status text not null default 'DRAFT' check (status in (
        'DRAFT','PENDING_PAYMENT','PAID','CONFIRMED','PROCESSING','READY',
        'FULFILLED','COMPLETED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED','FAILED','EXPIRED'
    )),
    subtotal numeric(14,2) not null default 0,
    tax numeric(14,2) not null default 0,
    discount numeric(14,2) not null default 0,
    total numeric(14,2) not null default 0,
    currency text not null default 'SAR',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists sales.order_items (
    id uuid primary key default gen_random_uuid(),
    order_id uuid not null references sales.orders(id) on delete cascade,
    item_type text not null check (item_type in ('variant','service','package')),
    item_id uuid not null,
    quantity numeric not null default 1,
    unit_price numeric(14,2) not null,
    tax numeric(14,2) not null default 0,
    total numeric(14,2) not null
);

create table if not exists sales.invoices (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    order_id uuid references sales.orders(id),
    invoice_number text not null,
    status text not null default 'draft' check (status in ('draft','issued','paid','void')),
    issue_date date not null default current_date,
    due_date date,
    total numeric(14,2) not null default 0,
    unique (store_id, invoice_number)
);

create table if not exists sales.invoice_items (
    id uuid primary key default gen_random_uuid(),
    invoice_id uuid not null references sales.invoices(id) on delete cascade,
    description text not null,
    quantity numeric not null default 1,
    unit_price numeric(14,2) not null,
    total numeric(14,2) not null
);

create table if not exists sales.payments (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    order_id uuid references sales.orders(id),
    invoice_id uuid references sales.invoices(id),
    provider text not null, -- e.g. moyasar, tap, hyperpay
    status text not null default 'INITIATED' check (status in (
        'INITIATED','PENDING','AUTHORIZED','CAPTURED','FAILED','CANCELLED','REFUNDED','PARTIALLY_REFUNDED'
    )),
    amount numeric(14,2) not null,
    currency text not null default 'SAR',
    idempotency_key text not null unique,
    external_reference text,
    created_at timestamptz not null default now()
);

create table if not exists sales.refunds (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    payment_id uuid not null references sales.payments(id),
    amount numeric(14,2) not null,
    status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED','COMPLETED')),
    reason text,
    created_at timestamptz not null default now()
);

-- =====================================================================
-- inventory
-- =====================================================================
create table if not exists inventory.warehouses (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    branch_id uuid references platform.branches(id),
    name text not null
);

create table if not exists inventory.stock (
    id uuid primary key default gen_random_uuid(),
    warehouse_id uuid not null references inventory.warehouses(id) on delete cascade,
    variant_id uuid not null references catalog.variants(id) on delete cascade,
    available_qty numeric not null default 0,
    reserved_qty numeric not null default 0,
    unique (warehouse_id, variant_id)
);

create table if not exists inventory.stock_movements (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    warehouse_id uuid not null references inventory.warehouses(id),
    variant_id uuid not null references catalog.variants(id),
    type text not null check (type in (
        'PURCHASE','SALE','RETURN','TRANSFER','ADJUSTMENT','DAMAGE','RESERVATION','RELEASE'
    )),
    quantity numeric not null,
    reference_type text,
    reference_id uuid,
    created_at timestamptz not null default now()
);

create table if not exists inventory.inventory_reservations (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    variant_id uuid not null references catalog.variants(id),
    order_id uuid references sales.orders(id),
    quantity numeric not null,
    status text not null default 'ACTIVE' check (status in ('ACTIVE','RELEASED','CONSUMED','EXPIRED')),
    expires_at timestamptz
);

-- =====================================================================
-- booking
-- =====================================================================
create table if not exists booking.resources (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    type text not null check (type in ('hall','vehicle','photographer','makeup_artist','room','equipment','staff')),
    name text not null,
    capacity int,
    metadata jsonb not null default '{}'::jsonb
);

create table if not exists booking.availability (
    id uuid primary key default gen_random_uuid(),
    resource_id uuid not null references booking.resources(id) on delete cascade,
    day_of_week int check (day_of_week between 0 and 6),
    specific_date date,
    start_time time not null,
    end_time time not null,
    is_available boolean not null default true,
    check (day_of_week is not null or specific_date is not null)
);

create table if not exists booking.booking_rules (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    resource_id uuid references booking.resources(id) on delete cascade,
    min_notice_minutes int not null default 0,
    max_duration_minutes int,
    buffer_before_minutes int not null default 0,
    buffer_after_minutes int not null default 0
);

create table if not exists booking.bookings (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    customer_id uuid,
    order_id uuid references sales.orders(id),
    status text not null default 'DRAFT' check (status in (
        'DRAFT','HOLD','PENDING_PAYMENT','CONFIRMED','CHECKED_IN','COMPLETED','CANCELLED','EXPIRED','REFUND'
    )),
    start_at timestamptz not null,
    end_at timestamptz not null,
    created_at timestamptz not null default now()
);

create table if not exists booking.booking_items (
    id uuid primary key default gen_random_uuid(),
    booking_id uuid not null references booking.bookings(id) on delete cascade,
    resource_id uuid not null references booking.resources(id),
    quantity numeric not null default 1,
    price numeric(14,2) not null default 0
);

-- prevent double-booking of the same resource for overlapping time ranges
alter table booking.booking_items add column if not exists time_range tstzrange;

-- =====================================================================
-- pos
-- =====================================================================
create table if not exists pos.registers (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    branch_id uuid not null references platform.branches(id),
    name text not null
);

create table if not exists pos.terminals (
    id uuid primary key default gen_random_uuid(),
    register_id uuid not null references pos.registers(id) on delete cascade,
    device_id text not null unique,
    name text,
    status text not null default 'active' check (status in ('active','inactive'))
);

create table if not exists pos.cash_sessions (
    id uuid primary key default gen_random_uuid(),
    register_id uuid not null references pos.registers(id) on delete cascade,
    opened_by uuid not null references auth.users(id),
    opening_balance numeric(14,2) not null default 0,
    closing_balance numeric(14,2),
    opened_at timestamptz not null default now(),
    closed_at timestamptz,
    status text not null default 'open' check (status in ('open','closed'))
);

create table if not exists pos.cash_movements (
    id uuid primary key default gen_random_uuid(),
    cash_session_id uuid not null references pos.cash_sessions(id) on delete cascade,
    type text not null check (type in ('in','out')),
    amount numeric(14,2) not null,
    reason text
);

create table if not exists pos.pos_transactions (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    terminal_id uuid not null references pos.terminals(id),
    order_id uuid references sales.orders(id),
    device_id text not null,
    local_transaction_id text not null,
    server_transaction_id uuid,
    sync_status text not null default 'PENDING' check (sync_status in ('PENDING','SYNCED','CONFLICT','FAILED')),
    created_at timestamptz not null default now(),
    unique (device_id, local_transaction_id)
);

-- =====================================================================
-- accounting
-- =====================================================================
create table if not exists accounting.accounts (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    parent_id uuid references accounting.accounts(id),
    code text not null,
    name text not null,
    type text not null check (type in ('asset','liability','equity','revenue','expense')),
    unique (store_id, code)
);

create table if not exists accounting.fiscal_periods (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    name text not null,
    start_date date not null,
    end_date date not null,
    status text not null default 'open' check (status in ('open','closed'))
);

create table if not exists accounting.journal_entries (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    fiscal_period_id uuid references accounting.fiscal_periods(id),
    reference_type text,
    reference_id uuid,
    description text,
    posted_by uuid references auth.users(id),
    created_at timestamptz not null default now()
);

create table if not exists accounting.journal_lines (
    id uuid primary key default gen_random_uuid(),
    journal_entry_id uuid not null references accounting.journal_entries(id) on delete cascade,
    account_id uuid not null references accounting.accounts(id),
    debit numeric(14,2) not null default 0,
    credit numeric(14,2) not null default 0,
    check (debit >= 0 and credit >= 0),
    check (not (debit > 0 and credit > 0))
);

create table if not exists accounting.expenses (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    branch_id uuid references platform.branches(id),
    category text not null,
    amount numeric(14,2) not null,
    vendor text,
    date date not null default current_date,
    status text not null default 'recorded' check (status in ('recorded','approved','rejected'))
);

create table if not exists accounting.tax_transactions (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    reference_type text not null,
    reference_id uuid not null,
    tax_type text not null,
    rate numeric(6,4) not null,
    amount numeric(14,2) not null
);

-- =====================================================================
-- crm
-- =====================================================================
create table if not exists crm.customers (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    full_name text not null,
    email text,
    phone text,
    created_at timestamptz not null default now()
);

create table if not exists crm.customer_addresses (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references crm.customers(id) on delete cascade,
    label text,
    address_line text not null,
    city text,
    is_default boolean not null default false
);

create table if not exists crm.customer_notes (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references crm.customers(id) on delete cascade,
    author_user_id uuid references auth.users(id),
    note text not null,
    created_at timestamptz not null default now()
);

create table if not exists crm.customer_events (
    id uuid primary key default gen_random_uuid(),
    customer_id uuid not null references crm.customers(id) on delete cascade,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- =====================================================================
-- logistics
-- =====================================================================
create table if not exists logistics.carriers (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    name text not null,
    type text not null check (type in ('external','internal'))
);

create table if not exists logistics.vehicles (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    plate_number text,
    type text,
    capacity int,
    status text not null default 'active' check (status in ('active','maintenance','inactive'))
);

create table if not exists logistics.drivers (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    user_id uuid references auth.users(id),
    license_number text,
    status text not null default 'active' check (status in ('active','inactive'))
);

create table if not exists logistics.fulfillments (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    order_id uuid not null references sales.orders(id),
    type text not null check (type in ('shipping','transportation')),
    carrier_id uuid references logistics.carriers(id),
    status text not null default 'PENDING'
);

create table if not exists logistics.shipments (
    id uuid primary key default gen_random_uuid(),
    fulfillment_id uuid not null references logistics.fulfillments(id) on delete cascade,
    tracking_number text,
    status text not null default 'PENDING'
);

create table if not exists logistics.trips (
    id uuid primary key default gen_random_uuid(),
    fulfillment_id uuid not null references logistics.fulfillments(id) on delete cascade,
    vehicle_id uuid references logistics.vehicles(id),
    driver_id uuid references logistics.drivers(id),
    route jsonb,
    pickup_at timestamptz,
    dropoff_at timestamptz,
    passengers_count int,
    status text not null default 'PENDING'
);

-- =====================================================================
-- integrations
-- =====================================================================
create table if not exists integrations.apps (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    slug text not null unique,
    developer_id uuid references auth.users(id),
    status text not null default 'draft' check (status in ('draft','submitted','approved','rejected','suspended')),
    scopes jsonb not null default '[]'::jsonb
);

create table if not exists integrations.app_versions (
    id uuid primary key default gen_random_uuid(),
    app_id uuid not null references integrations.apps(id) on delete cascade,
    version text not null,
    manifest jsonb not null default '{}'::jsonb,
    unique (app_id, version)
);

create table if not exists integrations.installations (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    app_id uuid not null references integrations.apps(id),
    status text not null default 'active' check (status in ('active','suspended','uninstalled')),
    installed_at timestamptz not null default now(),
    unique (store_id, app_id)
);

create table if not exists integrations.credentials (
    id uuid primary key default gen_random_uuid(),
    installation_id uuid not null references integrations.installations(id) on delete cascade,
    key_name text not null,
    encrypted_value text not null
);

create table if not exists integrations.permissions (
    id uuid primary key default gen_random_uuid(),
    app_id uuid not null references integrations.apps(id) on delete cascade,
    permission_code text not null
);

create table if not exists integrations.webhooks (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    installation_id uuid references integrations.installations(id) on delete cascade,
    url text not null,
    events jsonb not null default '[]'::jsonb,
    secret text not null,
    status text not null default 'active' check (status in ('active','disabled'))
);

create table if not exists integrations.webhook_deliveries (
    id uuid primary key default gen_random_uuid(),
    webhook_id uuid not null references integrations.webhooks(id) on delete cascade,
    event_type text not null,
    payload jsonb not null,
    status text not null default 'PENDING' check (status in ('PENDING','DELIVERED','FAILED')),
    attempt_count int not null default 0,
    last_attempt_at timestamptz
);

create table if not exists integrations.app_events (
    id uuid primary key default gen_random_uuid(),
    app_id uuid not null references integrations.apps(id) on delete cascade,
    event_type text not null,
    payload jsonb not null default '{}'::jsonb,
    created_at timestamptz not null default now()
);

-- =====================================================================
-- notifications
-- =====================================================================
create table if not exists notifications.templates (
    id uuid primary key default gen_random_uuid(),
    store_id uuid references platform.stores(id) on delete cascade, -- null = system template
    event_type text not null,
    channel text not null check (channel in ('push','sms','email','whatsapp')),
    body_template text not null
);

create table if not exists notifications.preferences (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    user_id uuid references auth.users(id), -- null = default for store
    event_type text not null,
    channel text not null check (channel in ('push','sms','email','whatsapp')),
    enabled boolean not null default true
);

create table if not exists notifications.deliveries (
    id uuid primary key default gen_random_uuid(),
    store_id uuid not null references platform.stores(id) on delete cascade,
    event_type text not null,
    channel text not null,
    recipient text not null,
    status text not null default 'PENDING' check (status in ('PENDING','SENT','FAILED')),
    provider_reference text,
    created_at timestamptz not null default now()
);

-- =====================================================================
-- Indexes on the tenant column (store_id) — required for RLS performance
-- =====================================================================
create index if not exists idx_stores_merchant on platform.stores(merchant_id);
create index if not exists idx_branches_store on platform.branches(store_id);
create index if not exists idx_memberships_store on platform.memberships(store_id);
create index if not exists idx_memberships_user on platform.memberships(user_id);
create index if not exists idx_products_store on catalog.products(store_id);
create index if not exists idx_orders_store on sales.orders(store_id);
create index if not exists idx_orders_status on sales.orders(store_id, status);
create index if not exists idx_payments_store on sales.payments(store_id);
create index if not exists idx_bookings_store_time on booking.bookings(store_id, start_at, end_at);
create index if not exists idx_stock_movements_store on inventory.stock_movements(store_id);
create index if not exists idx_pos_transactions_store on pos.pos_transactions(store_id);
create index if not exists idx_journal_entries_store on accounting.journal_entries(store_id);
create index if not exists idx_customers_store on crm.customers(store_id);
create index if not exists idx_audit_logs_store on platform.audit_logs(store_id);
