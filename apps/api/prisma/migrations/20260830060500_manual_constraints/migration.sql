-- Manual constraints that Prisma's schema language cannot express.
-- These mirror docs/database/schema.sql exactly (CHECK constraints and the
-- anti-double-booking EXCLUDE constraint). Keep this migration in sync if
-- prisma/schema.prisma changes shape for any of these tables.

-- ---------------------------------------------------------------- Users
ALTER TABLE "users"
  ADD CONSTRAINT chk_user_contact CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

-- ------------------------------------------------------------- Catalog
ALTER TABLE "products" ADD CONSTRAINT chk_products_base_price CHECK ("base_price" >= 0);
ALTER TABLE "services" ADD CONSTRAINT chk_services_price CHECK ("price" >= 0);
ALTER TABLE "packages" ADD CONSTRAINT chk_packages_price CHECK ("price" >= 0);
ALTER TABLE "package_items" ADD CONSTRAINT chk_package_items_quantity CHECK ("quantity" > 0);
ALTER TABLE "product_variants" ADD CONSTRAINT chk_product_variants_price CHECK ("price" >= 0);

-- ------------------------------------------------------------ Inventory
ALTER TABLE "inventory_stock"
  ADD CONSTRAINT chk_inventory_on_hand CHECK ("quantity_on_hand" >= 0),
  ADD CONSTRAINT chk_inventory_reserved CHECK ("quantity_reserved" >= 0),
  ADD CONSTRAINT chk_reserved_le_on_hand CHECK ("quantity_reserved" <= "quantity_on_hand");

-- --------------------------------------------------------------- Booking
ALTER TABLE "booking_resources" ADD CONSTRAINT chk_booking_resources_base_price CHECK ("base_price" >= 0);

ALTER TABLE "resource_availability_rules"
  ADD CONSTRAINT chk_availability_day_of_week CHECK ("day_of_week" BETWEEN 0 AND 6),
  ADD CONSTRAINT chk_availability_time_order CHECK ("start_time" < "end_time");

ALTER TABLE "bookings"
  ADD CONSTRAINT chk_booking_time_order CHECK ("starts_at" < "ends_at"),
  ADD CONSTRAINT chk_bookings_total_price CHECK ("total_price" >= 0);

-- Anti-double-booking guarantee (docs/database/erd.md §4): no two
-- held/confirmed bookings on the same resource may have overlapping ranges.
-- Requires the btree_gist extension, already created by the init migration.
ALTER TABLE "bookings" ADD CONSTRAINT excl_bookings_no_overlap
  EXCLUDE USING gist (
    "resource_id" WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
  ) WHERE ("status" IN ('held', 'confirmed'));

-- ----------------------------------------------------------------- Events
ALTER TABLE "event_budget_items"
  ADD CONSTRAINT chk_budget_planned_amount CHECK ("planned_amount" >= 0),
  ADD CONSTRAINT chk_budget_actual_amount CHECK ("actual_amount" >= 0);

-- --------------------------------------------------------------- Commerce
ALTER TABLE "cart_items"
  ADD CONSTRAINT chk_cart_items_quantity CHECK ("quantity" > 0),
  ADD CONSTRAINT chk_cart_items_unit_price CHECK ("unit_price" >= 0);

ALTER TABLE "orders"
  ADD CONSTRAINT chk_orders_subtotal CHECK ("subtotal" >= 0),
  ADD CONSTRAINT chk_orders_total_amount CHECK ("total_amount" >= 0);

ALTER TABLE "order_items"
  ADD CONSTRAINT chk_order_items_quantity CHECK ("quantity" > 0),
  ADD CONSTRAINT chk_order_items_unit_price CHECK ("unit_price" >= 0),
  ADD CONSTRAINT chk_order_items_total_price CHECK ("total_price" >= 0);

-- --------------------------------------------------------------- Payments
ALTER TABLE "payments" ADD CONSTRAINT chk_payments_amount CHECK ("amount" >= 0);
ALTER TABLE "refunds" ADD CONSTRAINT chk_refunds_amount CHECK ("amount" > 0);

-- ---------------------------------------------------------------- Reviews
ALTER TABLE "reviews" ADD CONSTRAINT chk_reviews_rating CHECK ("rating" BETWEEN 1 AND 5);
