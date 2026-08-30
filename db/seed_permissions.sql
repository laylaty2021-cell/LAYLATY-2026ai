-- =====================================================================
-- Global permission catalog — run once per environment, after schema.sql.
-- Matches docs/blueprint/04-roles-permissions-matrix.md.
-- Store-scoped roles (platform.roles) and their role_permissions are
-- seeded per-store at store-creation time by the API
-- (services/api/src/modules/stores/defaultRoles.ts), not here — this
-- file only seeds the permission codes themselves, which are global
-- and referenced by every store's roles via role_permissions.
-- =====================================================================

insert into platform.permissions (code, description) values
    ('stores.create',      'Create a new store'),
    ('stores.read',        'Read store details'),
    ('users.manage',       'Manage memberships and role assignments'),
    ('catalog.read',       'Read products, services and packages'),
    ('catalog.write',      'Create/update products, services and packages'),
    ('orders.create',      'Create orders'),
    ('orders.read',        'Read orders'),
    ('orders.cancel',      'Cancel orders'),
    ('payments.create',    'Create payments'),
    ('refund.request',     'Request a refund'),
    ('refund.approve',     'Approve a requested refund'),
    ('accounting.read',    'Read accounting data'),
    ('accounting.write',   'Create journal entries and expenses'),
    ('accounting.delete',  'Delete accounting records (not granted to any default role)'),
    ('inventory.read',     'Read stock levels and movements'),
    ('inventory.adjust',   'Record stock movements/adjustments'),
    ('bookings.read',      'Read bookings and availability'),
    ('bookings.create',    'Create bookings'),
    ('bookings.confirm',   'Confirm a booking'),
    ('resources.manage',   'Create/update bookable resources (halls, vehicles, staff...)'),
    ('crm.read',           'Read customers'),
    ('crm.write',          'Create/update customers'),
    ('pos.sync',           'Sync offline POS transactions'),
    ('trips.update_status','Update assigned trip status'),
    ('apps.manage',        'Manage installed apps, API keys and webhooks')
on conflict (code) do nothing;
