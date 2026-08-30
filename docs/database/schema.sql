-- ============================================================================
-- LAYLATY PLATFORM — DATABASE SCHEMA (PostgreSQL 15+)
-- ============================================================================
-- Architecture: Modular Monolith / Multi-Tenant / Event-Centric / Unified Commerce
-- Each section below maps 1:1 to a backend module (modules/*) described in the
-- engineering blueprint. No module may query another module's tables directly
-- in application code — this file defines the physical contract only.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 0. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";     -- case-insensitive email/slug lookups
CREATE EXTENSION IF NOT EXISTS "pg_trgm";    -- fuzzy / ILIKE search acceleration

-- ----------------------------------------------------------------------------
-- 0.1 SHARED HELPERS
-- ----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ----------------------------------------------------------------------------
-- 0.2 ENUM TYPES
-- ----------------------------------------------------------------------------
CREATE TYPE user_status            AS ENUM ('active', 'suspended', 'pending_verification', 'deleted');
CREATE TYPE user_type              AS ENUM ('customer', 'merchant', 'admin');

CREATE TYPE org_status             AS ENUM ('pending', 'active', 'suspended', 'rejected');
CREATE TYPE store_status           AS ENUM ('draft', 'pending_review', 'active', 'suspended', 'closed');
CREATE TYPE business_type          AS ENUM (
  'wedding_hall', 'florist', 'photographer', 'restaurant',
  'beauty', 'transportation', 'catering', 'other'
);
CREATE TYPE org_member_role        AS ENUM ('owner', 'manager', 'staff', 'accountant');

CREATE TYPE sellable_item_type     AS ENUM ('product', 'service', 'booking', 'package');
CREATE TYPE catalog_item_status    AS ENUM ('draft', 'active', 'archived', 'out_of_stock');

CREATE TYPE booking_status         AS ENUM ('held', 'confirmed', 'cancelled', 'completed', 'expired');

CREATE TYPE event_status           AS ENUM ('planning', 'confirmed', 'completed', 'cancelled');
CREATE TYPE event_task_status      AS ENUM ('pending', 'in_progress', 'done', 'skipped');
CREATE TYPE budget_item_status     AS ENUM ('planned', 'reserved', 'paid');

CREATE TYPE cart_status            AS ENUM ('active', 'converted', 'abandoned');

CREATE TYPE order_status           AS ENUM (
  'pending_payment', 'paid', 'processing', 'ready',
  'shipped', 'delivered', 'completed', 'cancelled', 'refunded'
);

CREATE TYPE payment_status         AS ENUM ('pending', 'authorized', 'succeeded', 'failed', 'refunded', 'partially_refunded');
CREATE TYPE payment_target_type    AS ENUM ('order', 'booking');

CREATE TYPE refund_status          AS ENUM ('pending', 'succeeded', 'failed');

CREATE TYPE shipment_status        AS ENUM (
  'pending', 'label_created', 'picked_up', 'in_transit',
  'out_for_delivery', 'delivered', 'failed', 'cancelled'
);

CREATE TYPE notification_channel   AS ENUM ('push', 'sms', 'email', 'in_app');
CREATE TYPE notification_status   AS ENUM ('queued', 'sent', 'failed', 'read');

CREATE TYPE inventory_movement_type AS ENUM ('reserve', 'release', 'confirm', 'adjust', 'restock');

-- ============================================================================
-- 1. IDENTITY MODULE
-- ============================================================================

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email              CITEXT UNIQUE,
  phone              VARCHAR(20) UNIQUE,
  password_hash      TEXT NOT NULL,
  full_name          VARCHAR(150) NOT NULL,
  avatar_url         TEXT,
  user_type          user_type NOT NULL DEFAULT 'customer',
  status             user_status NOT NULL DEFAULT 'pending_verification',
  locale             VARCHAR(10) NOT NULL DEFAULT 'ar',
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_user_contact CHECK (email IS NOT NULL OR phone IS NOT NULL)
);
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_users_user_type ON users(user_type);
CREATE INDEX idx_users_status ON users(status);

CREATE TABLE refresh_tokens (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash         TEXT NOT NULL,
  revoked_at         TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);

CREATE TABLE otp_codes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier         VARCHAR(150) NOT NULL,     -- phone or email
  code_hash          TEXT NOT NULL,
  purpose            VARCHAR(30) NOT NULL,      -- login, register, reset_password
  consumed_at        TIMESTAMPTZ,
  expires_at         TIMESTAMPTZ NOT NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_otp_identifier ON otp_codes(identifier);

-- Admin RBAC (Super Admin / Support / Finance ...)
CREATE TABLE admin_roles (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                VARCHAR(50) UNIQUE NOT NULL,   -- super_admin, support, finance
  name               VARCHAR(100) NOT NULL
);

CREATE TABLE admin_permissions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key                VARCHAR(100) UNIQUE NOT NULL   -- orders.refund, users.suspend, ...
);

CREATE TABLE admin_role_permissions (
  role_id            UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  permission_id      UUID NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE admin_user_roles (
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id            UUID NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, role_id)
);

CREATE TABLE addresses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label              VARCHAR(50),
  city               VARCHAR(100) NOT NULL,
  district           VARCHAR(100),
  address_line       TEXT NOT NULL,
  latitude           NUMERIC(9,6),
  longitude          NUMERIC(9,6),
  is_default         BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_addresses_user_id ON addresses(user_id);

-- ============================================================================
-- 2. ORGANIZATIONS & STORES MODULE (Multi-Tenant root)
-- ============================================================================

CREATE TABLE organizations (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_user_id          UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  name                   VARCHAR(200) NOT NULL,
  commercial_registration VARCHAR(50),
  tax_number             VARCHAR(50),
  status                 org_status NOT NULL DEFAULT 'pending',
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_organizations_updated_at BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_organizations_owner ON organizations(owner_user_id);
CREATE INDEX idx_organizations_status ON organizations(status);

CREATE TABLE organization_members (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role               org_member_role NOT NULL DEFAULT 'staff',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);

CREATE TABLE stores (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name               VARCHAR(200) NOT NULL,
  slug               CITEXT UNIQUE NOT NULL,
  business_type      business_type NOT NULL,
  description        TEXT,
  logo_url           TEXT,
  cover_url          TEXT,
  city               VARCHAR(100),
  status             store_status NOT NULL DEFAULT 'draft',
  settings           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_stores_updated_at BEFORE UPDATE ON stores
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_stores_organization_id ON stores(organization_id);
CREATE INDEX idx_stores_status ON stores(status);
CREATE INDEX idx_stores_business_type ON stores(business_type);
CREATE INDEX idx_stores_city ON stores(city);

-- Business Template System: which modules a store has enabled
CREATE TABLE store_modules (
  store_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  module_key         VARCHAR(50) NOT NULL,   -- catalog, booking, inventory, shipping, packages
  enabled            BOOLEAN NOT NULL DEFAULT true,
  config             JSONB NOT NULL DEFAULT '{}',
  PRIMARY KEY (store_id, module_key)
);

-- ============================================================================
-- 3. CATALOG MODULE (Unified Commerce: Product / Service / Package)
-- ============================================================================

CREATE TABLE categories (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id          UUID REFERENCES categories(id) ON DELETE SET NULL,
  name               VARCHAR(150) NOT NULL,
  slug               CITEXT UNIQUE NOT NULL,
  applies_to         sellable_item_type,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);

CREATE TABLE products (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id        UUID REFERENCES categories(id) ON DELETE SET NULL,
  name               VARCHAR(200) NOT NULL,
  slug               CITEXT NOT NULL,
  description        TEXT,
  base_price         NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
  currency           VARCHAR(3) NOT NULL DEFAULT 'SAR',
  status             catalog_item_status NOT NULL DEFAULT 'draft',
  requires_shipping  BOOLEAN NOT NULL DEFAULT true,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
CREATE TRIGGER trg_products_updated_at BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_products_store_id ON products(store_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_status ON products(status);
CREATE INDEX idx_products_name_trgm ON products USING gin (name gin_trgm_ops);

CREATE TABLE product_variants (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku                VARCHAR(100) UNIQUE,
  attributes         JSONB NOT NULL DEFAULT '{}',  -- {"color":"red","size":"M"}
  price              NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_product_variants_product_id ON product_variants(product_id);

CREATE TABLE services (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  category_id        UUID REFERENCES categories(id) ON DELETE SET NULL,
  name               VARCHAR(200) NOT NULL,
  slug               CITEXT NOT NULL,
  description        TEXT,
  price              NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  currency           VARCHAR(3) NOT NULL DEFAULT 'SAR',
  duration_minutes   INTEGER,
  status             catalog_item_status NOT NULL DEFAULT 'draft',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
CREATE TRIGGER trg_services_updated_at BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_services_store_id ON services(store_id);
CREATE INDEX idx_services_status ON services(status);

CREATE TABLE packages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name               VARCHAR(200) NOT NULL,
  slug               CITEXT NOT NULL,
  description        TEXT,
  price              NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  currency           VARCHAR(3) NOT NULL DEFAULT 'SAR',
  status             catalog_item_status NOT NULL DEFAULT 'draft',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (store_id, slug)
);
CREATE TRIGGER trg_packages_updated_at BEFORE UPDATE ON packages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_packages_store_id ON packages(store_id);

-- A package bundles other sellable items (product/service/booking resource)
CREATE TABLE package_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  package_id         UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
  item_type          sellable_item_type NOT NULL,
  item_id            UUID NOT NULL,   -- polymorphic ref to products/services/booking_resources
  quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0)
);
CREATE INDEX idx_package_items_package_id ON package_items(package_id);
CREATE INDEX idx_package_items_item ON package_items(item_type, item_id);

-- ============================================================================
-- 4. INVENTORY MODULE
-- ============================================================================

CREATE TABLE inventory_locations (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name               VARCHAR(150) NOT NULL,
  address            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_locations_store_id ON inventory_locations(store_id);

CREATE TABLE inventory_stock (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id         UUID NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  location_id        UUID NOT NULL REFERENCES inventory_locations(id) ON DELETE CASCADE,
  quantity_on_hand   INTEGER NOT NULL DEFAULT 0 CHECK (quantity_on_hand >= 0),
  quantity_reserved  INTEGER NOT NULL DEFAULT 0 CHECK (quantity_reserved >= 0),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (variant_id, location_id),
  CONSTRAINT chk_reserved_le_on_hand CHECK (quantity_reserved <= quantity_on_hand)
);
CREATE TRIGGER trg_inventory_stock_updated_at BEFORE UPDATE ON inventory_stock
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_inventory_stock_variant_id ON inventory_stock(variant_id);

CREATE TABLE inventory_movements (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stock_id           UUID NOT NULL REFERENCES inventory_stock(id) ON DELETE CASCADE,
  movement_type      inventory_movement_type NOT NULL,
  quantity           INTEGER NOT NULL,
  reference_type     VARCHAR(30),      -- order, adjustment
  reference_id       UUID,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_inventory_movements_stock_id ON inventory_movements(stock_id);
CREATE INDEX idx_inventory_movements_reference ON inventory_movements(reference_type, reference_id);

-- ============================================================================
-- 5. BOOKING ENGINE MODULE
-- ============================================================================

-- A bookable resource: hall, room, car, photographer, studio ...
CREATE TABLE booking_resources (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  name               VARCHAR(200) NOT NULL,
  description        TEXT,
  capacity           INTEGER,
  base_price         NUMERIC(12,2) NOT NULL CHECK (base_price >= 0),
  currency           VARCHAR(3) NOT NULL DEFAULT 'SAR',
  status             catalog_item_status NOT NULL DEFAULT 'active',
  settings           JSONB NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_booking_resources_updated_at BEFORE UPDATE ON booking_resources
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_booking_resources_store_id ON booking_resources(store_id);

-- Recurring weekly availability (opening hours)
CREATE TABLE resource_availability_rules (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id        UUID NOT NULL REFERENCES booking_resources(id) ON DELETE CASCADE,
  day_of_week        SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time         TIME NOT NULL,
  end_time           TIME NOT NULL,
  CONSTRAINT chk_availability_time_order CHECK (start_time < end_time)
);
CREATE INDEX idx_availability_rules_resource_id ON resource_availability_rules(resource_id);

-- One-off blackout dates (maintenance, holidays)
CREATE TABLE resource_blackout_dates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id        UUID NOT NULL REFERENCES booking_resources(id) ON DELETE CASCADE,
  starts_at          TIMESTAMPTZ NOT NULL,
  ends_at            TIMESTAMPTZ NOT NULL,
  reason             VARCHAR(200)
);
CREATE INDEX idx_blackout_dates_resource_id ON resource_blackout_dates(resource_id);

CREATE TABLE bookings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resource_id        UUID NOT NULL REFERENCES booking_resources(id) ON DELETE RESTRICT,
  customer_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  event_id           UUID,   -- FK added after events table (section 6)
  order_id           UUID,   -- FK added after orders table (section 7)
  starts_at          TIMESTAMPTZ NOT NULL,
  ends_at            TIMESTAMPTZ NOT NULL,
  status             booking_status NOT NULL DEFAULT 'held',
  hold_expires_at    TIMESTAMPTZ,        -- NULL once confirmed
  total_price        NUMERIC(12,2) NOT NULL CHECK (total_price >= 0),
  currency           VARCHAR(3) NOT NULL DEFAULT 'SAR',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT chk_booking_time_order CHECK (starts_at < ends_at)
);
CREATE TRIGGER trg_bookings_updated_at BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_bookings_resource_id ON bookings(resource_id);
CREATE INDEX idx_bookings_customer_id ON bookings(customer_id);
CREATE INDEX idx_bookings_event_id ON bookings(event_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_bookings_hold_expires_at ON bookings(hold_expires_at) WHERE status = 'held';

-- Prevents double-booking at the database level (in addition to app-level
-- row locking during the create-hold transaction). Requires btree_gist.
CREATE EXTENSION IF NOT EXISTS btree_gist;
ALTER TABLE bookings ADD CONSTRAINT excl_bookings_no_overlap
  EXCLUDE USING gist (
    resource_id WITH =,
    tstzrange(starts_at, ends_at) WITH &&
  ) WHERE (status IN ('held', 'confirmed'));

-- ============================================================================
-- 6. EVENTS MODULE (the platform's differentiator: EVENT as the center)
-- ============================================================================

CREATE TABLE events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name               VARCHAR(200) NOT NULL,
  event_type         VARCHAR(50) NOT NULL,   -- wedding, engagement, birthday, corporate
  event_date         DATE NOT NULL,
  city               VARCHAR(100),
  budget_total       NUMERIC(12,2),
  currency           VARCHAR(3) NOT NULL DEFAULT 'SAR',
  status             event_status NOT NULL DEFAULT 'planning',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_events_updated_at BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_events_customer_id ON events(customer_id);
CREATE INDEX idx_events_event_date ON events(event_date);
CREATE INDEX idx_events_status ON events(status);

ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_event FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;

-- Event Automation Engine: task templates instantiated per event based on
-- days-before-event offsets (see blueprint "EVENT AUTOMATION")
CREATE TABLE event_task_templates (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type         VARCHAR(50) NOT NULL,
  title              VARCHAR(200) NOT NULL,
  days_before_event  INTEGER NOT NULL,
  category           VARCHAR(50)
);

CREATE TABLE event_tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  title              VARCHAR(200) NOT NULL,
  category           VARCHAR(50),
  due_date           DATE,
  status             event_task_status NOT NULL DEFAULT 'pending',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_event_tasks_updated_at BEFORE UPDATE ON event_tasks
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_event_tasks_event_id ON event_tasks(event_id);
CREATE INDEX idx_event_tasks_status ON event_tasks(status);

CREATE TABLE event_budget_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category           VARCHAR(50) NOT NULL,   -- hall, flowers, photography...
  planned_amount     NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_amount      NUMERIC(12,2) NOT NULL DEFAULT 0,
  status             budget_item_status NOT NULL DEFAULT 'planned',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_event_budget_items_event_id ON event_budget_items(event_id);

-- ============================================================================
-- 7. COMMERCE MODULE (Cart -> Order, polymorphic across sellable items)
-- ============================================================================

CREATE TABLE carts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  event_id           UUID REFERENCES events(id) ON DELETE SET NULL,
  status             cart_status NOT NULL DEFAULT 'active',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_carts_updated_at BEFORE UPDATE ON carts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_carts_customer_id ON carts(customer_id);
CREATE INDEX idx_carts_store_id_status ON carts(store_id, status);

CREATE TABLE cart_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cart_id            UUID NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  item_type          sellable_item_type NOT NULL,
  item_id            UUID NOT NULL,            -- polymorphic: product/service/package id
  variant_id         UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  booking_id         UUID REFERENCES bookings(id) ON DELETE SET NULL,
  quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price         NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_cart_items_cart_id ON cart_items(cart_id);

CREATE TABLE orders (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number       VARCHAR(30) UNIQUE NOT NULL,
  customer_id        UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  store_id           UUID NOT NULL REFERENCES stores(id) ON DELETE RESTRICT,
  event_id           UUID REFERENCES events(id) ON DELETE SET NULL,
  status             order_status NOT NULL DEFAULT 'pending_payment',
  subtotal           NUMERIC(12,2) NOT NULL CHECK (subtotal >= 0),
  tax_amount         NUMERIC(12,2) NOT NULL DEFAULT 0,
  shipping_fee       NUMERIC(12,2) NOT NULL DEFAULT 0,
  total_amount       NUMERIC(12,2) NOT NULL CHECK (total_amount >= 0),
  currency           VARCHAR(3) NOT NULL DEFAULT 'SAR',
  shipping_address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_store_id_status_created ON orders(store_id, status, created_at);
CREATE INDEX idx_orders_event_id ON orders(event_id);

ALTER TABLE bookings
  ADD CONSTRAINT fk_bookings_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL;

CREATE TABLE order_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  item_type          sellable_item_type NOT NULL,
  item_id            UUID NOT NULL,
  variant_id         UUID REFERENCES product_variants(id) ON DELETE SET NULL,
  booking_id         UUID REFERENCES bookings(id) ON DELETE SET NULL,
  name_snapshot      VARCHAR(200) NOT NULL,   -- denormalized at purchase time
  quantity           INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price         NUMERIC(12,2) NOT NULL CHECK (unit_price >= 0),
  total_price        NUMERIC(12,2) NOT NULL CHECK (total_price >= 0)
);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_item ON order_items(item_type, item_id);

-- ============================================================================
-- 8. PAYMENTS MODULE
-- ============================================================================

CREATE TABLE payments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type        payment_target_type NOT NULL,
  target_id          UUID NOT NULL,             -- orders.id or bookings.id
  provider           VARCHAR(50) NOT NULL,      -- moyasar, hyperpay, tap ...
  provider_payment_id VARCHAR(150),
  idempotency_key    VARCHAR(150) UNIQUE NOT NULL,
  amount             NUMERIC(12,2) NOT NULL CHECK (amount >= 0),
  currency           VARCHAR(3) NOT NULL DEFAULT 'SAR',
  status             payment_status NOT NULL DEFAULT 'pending',
  raw_response       JSONB,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_payments_updated_at BEFORE UPDATE ON payments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_payments_target ON payments(target_type, target_id);
CREATE INDEX idx_payments_status ON payments(status);

-- Idempotent webhook ingestion: provider + event_id must be unique so a
-- duplicated webhook delivery never double-processes a payment.
CREATE TABLE payment_webhook_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider           VARCHAR(50) NOT NULL,
  event_id           VARCHAR(150) NOT NULL,
  event_type         VARCHAR(100) NOT NULL,
  payload            JSONB NOT NULL,
  processed_at       TIMESTAMPTZ,
  received_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

CREATE TABLE refunds (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id         UUID NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  amount             NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  reason             TEXT,
  status             refund_status NOT NULL DEFAULT 'pending',
  requested_by       UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_refunds_payment_id ON refunds(payment_id);

-- ============================================================================
-- 9. LOGISTICS / SHIPPING MODULE
-- ============================================================================

CREATE TABLE shipments (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id           UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  provider           VARCHAR(50) NOT NULL,
  tracking_number    VARCHAR(150),
  status             shipment_status NOT NULL DEFAULT 'pending',
  label_url          TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_shipments_updated_at BEFORE UPDATE ON shipments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE INDEX idx_shipments_order_id ON shipments(order_id);

CREATE TABLE shipment_events (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id        UUID NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status             shipment_status NOT NULL,
  description        TEXT,
  occurred_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_shipment_events_shipment_id ON shipment_events(shipment_id);

-- ============================================================================
-- 10. NOTIFICATIONS MODULE
-- ============================================================================

CREATE TABLE notifications (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel            notification_channel NOT NULL,
  event_key          VARCHAR(100) NOT NULL,   -- booking.confirmed, payment.success ...
  payload            JSONB NOT NULL DEFAULT '{}',
  status             notification_status NOT NULL DEFAULT 'queued',
  sent_at            TIMESTAMPTZ,
  read_at            TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- ============================================================================
-- 11. REVIEWS MODULE
-- ============================================================================

CREATE TABLE reviews (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  store_id           UUID NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
  item_type          sellable_item_type,
  item_id            UUID,
  order_id           UUID REFERENCES orders(id) ON DELETE SET NULL,
  rating             SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment            TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reviews_store_id ON reviews(store_id);
CREATE INDEX idx_reviews_item ON reviews(item_type, item_id);

-- ============================================================================
-- 12. AUDIT LOG MODULE (platform-wide, immutable)
-- ============================================================================

CREATE TABLE audit_logs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id           UUID REFERENCES users(id) ON DELETE SET NULL,
  action             VARCHAR(100) NOT NULL,     -- payment.refund, user.suspend ...
  entity_type        VARCHAR(50) NOT NULL,
  entity_id          UUID NOT NULL,
  before_state       JSONB,
  after_state        JSONB,
  ip_address         INET,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
