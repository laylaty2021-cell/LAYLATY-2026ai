/**
 * Default role -> permission-code mapping, matching
 * docs/blueprint/04-roles-permissions-matrix.md. Seeded into
 * platform.roles/role_permissions for every new store at creation time
 * (see routes.ts) — not seeded globally, since roles are per-store.
 */
export const DEFAULT_ROLES: Record<string, string[]> = {
  Owner: [
    "stores.read", "users.manage", "catalog.read", "catalog.write", "resources.manage",
    "orders.create", "orders.read", "orders.cancel", "payments.create", "refund.request",
    "refund.approve", "accounting.read", "accounting.write", "inventory.read", "inventory.adjust",
    "bookings.read", "bookings.create", "bookings.confirm", "crm.read", "crm.write",
    "pos.sync", "apps.manage",
  ],
  Administrator: [
    "stores.read", "users.manage", "catalog.read", "catalog.write", "resources.manage",
    "orders.create", "orders.read", "orders.cancel", "payments.create", "refund.request",
    "refund.approve", "accounting.read", "inventory.read", "inventory.adjust",
    "bookings.read", "bookings.create", "bookings.confirm", "crm.read", "crm.write",
    "pos.sync", "apps.manage",
  ],
  Manager: [
    "stores.read", "catalog.read", "catalog.write", "resources.manage",
    "orders.create", "orders.read", "orders.cancel", "payments.create", "refund.request",
    "inventory.read", "inventory.adjust", "bookings.read", "bookings.create", "bookings.confirm",
    "crm.read", "crm.write", "pos.sync",
  ],
  Accountant: ["stores.read", "accounting.read", "accounting.write", "refund.approve", "crm.read"],
  Cashier: ["stores.read", "orders.create", "payments.create", "refund.request", "catalog.read", "crm.read", "pos.sync"],
  Sales: ["stores.read", "catalog.read", "orders.create", "orders.read", "crm.read", "crm.write"],
  "Inventory Manager": ["stores.read", "inventory.read", "inventory.adjust", "catalog.read"],
  "Booking Manager": ["stores.read", "bookings.read", "bookings.create", "bookings.confirm", "resources.manage", "catalog.read"],
  Marketing: ["stores.read", "crm.read", "catalog.read"],
  Support: ["stores.read", "orders.read", "crm.read", "bookings.read"],
  Driver: ["stores.read", "trips.update_status"],
  Developer: ["stores.read", "apps.manage"],
};
