-- =====================================================================
-- Laylaty Technical Blueprint v1 — Row-Level Security Policies
-- Run AFTER db/schema.sql
-- Model: authenticated user -> platform.memberships -> store_id -> RLS
-- =====================================================================

-- Helper: returns the set of store_ids the current JWT user belongs to.
-- Assumes the JWT exposes the user id as auth.uid() (Supabase convention).
create or replace function platform.current_user_store_ids()
returns setof uuid
language sql stable
security definer
as $$
    select store_id
    from platform.memberships
    where user_id = auth.uid()
      and status = 'active'
$$;

-- Helper: does the current user have a given permission code on a store
-- (optionally scoped to a branch)?
create or replace function platform.has_permission(
    p_store_id uuid,
    p_permission_code text,
    p_branch_id uuid default null
) returns boolean
language sql stable
security definer
as $$
    select exists (
        select 1
        from platform.memberships m
        join platform.role_permissions rp on rp.role_id = m.role_id
        join platform.permissions p on p.id = rp.permission_id
        where m.user_id = auth.uid()
          and m.store_id = p_store_id
          and m.status = 'active'
          and p.code = p_permission_code
          and (m.branch_id is null or p_branch_id is null or m.branch_id = p_branch_id)
    )
$$;

-- =====================================================================
-- Generic pattern applied to every tenant table:
--   1. enable row level security
--   2. force it even for the table owner
--   3. one policy for SELECT/INSERT/UPDATE/DELETE keyed on store_id
-- Below is the pattern expanded for every table that carries store_id.
-- =====================================================================

-- platform.stores (special case: joined through memberships, not store_id itself)
alter table platform.stores enable row level security;
alter table platform.stores force row level security;
create policy stores_isolation on platform.stores
    using (id in (select platform.current_user_store_ids()));

-- platform.branches
alter table platform.branches enable row level security;
alter table platform.branches force row level security;
create policy branches_isolation on platform.branches
    using (store_id in (select platform.current_user_store_ids()));

-- platform.memberships (a user can see memberships of stores they belong to)
alter table platform.memberships enable row level security;
alter table platform.memberships force row level security;
create policy memberships_isolation on platform.memberships
    using (store_id in (select platform.current_user_store_ids()));

-- platform.roles
alter table platform.roles enable row level security;
alter table platform.roles force row level security;
create policy roles_isolation on platform.roles
    using (store_id is null or store_id in (select platform.current_user_store_ids()));

-- platform.audit_logs (read-only via RLS; writes go through a trusted server role)
alter table platform.audit_logs enable row level security;
alter table platform.audit_logs force row level security;
create policy audit_logs_isolation on platform.audit_logs
    for select
    using (store_id in (select platform.current_user_store_ids()));

-- catalog.*
alter table catalog.categories enable row level security;
alter table catalog.categories force row level security;
create policy categories_isolation on catalog.categories
    using (store_id in (select platform.current_user_store_ids()));

alter table catalog.products enable row level security;
alter table catalog.products force row level security;
create policy products_isolation on catalog.products
    using (store_id in (select platform.current_user_store_ids()));

alter table catalog.variants enable row level security;
alter table catalog.variants force row level security;
create policy variants_isolation on catalog.variants
    using (product_id in (
        select id from catalog.products
        where store_id in (select platform.current_user_store_ids())
    ));

alter table catalog.packages enable row level security;
alter table catalog.packages force row level security;
create policy packages_isolation on catalog.packages
    using (store_id in (select platform.current_user_store_ids()));

-- sales.*
alter table sales.carts enable row level security;
alter table sales.carts force row level security;
create policy carts_isolation on sales.carts
    using (store_id in (select platform.current_user_store_ids()));

alter table sales.orders enable row level security;
alter table sales.orders force row level security;
create policy orders_isolation on sales.orders
    using (store_id in (select platform.current_user_store_ids()));

alter table sales.order_items enable row level security;
alter table sales.order_items force row level security;
create policy order_items_isolation on sales.order_items
    using (order_id in (
        select id from sales.orders
        where store_id in (select platform.current_user_store_ids())
    ));

alter table sales.invoices enable row level security;
alter table sales.invoices force row level security;
create policy invoices_isolation on sales.invoices
    using (store_id in (select platform.current_user_store_ids()));

alter table sales.payments enable row level security;
alter table sales.payments force row level security;
create policy payments_isolation on sales.payments
    using (store_id in (select platform.current_user_store_ids()))
    with check (
        store_id in (select platform.current_user_store_ids())
        and platform.has_permission(store_id, 'payments.create')
    );

alter table sales.refunds enable row level security;
alter table sales.refunds force row level security;
create policy refunds_isolation on sales.refunds
    using (store_id in (select platform.current_user_store_ids()))
    with check (
        store_id in (select platform.current_user_store_ids())
        and platform.has_permission(store_id, 'refund.request')
    );

-- inventory.*
alter table inventory.warehouses enable row level security;
alter table inventory.warehouses force row level security;
create policy warehouses_isolation on inventory.warehouses
    using (store_id in (select platform.current_user_store_ids()));

alter table inventory.stock_movements enable row level security;
alter table inventory.stock_movements force row level security;
create policy stock_movements_isolation on inventory.stock_movements
    using (store_id in (select platform.current_user_store_ids()));

alter table inventory.inventory_reservations enable row level security;
alter table inventory.inventory_reservations force row level security;
create policy inventory_reservations_isolation on inventory.inventory_reservations
    using (store_id in (select platform.current_user_store_ids()));

-- booking.*
alter table booking.resources enable row level security;
alter table booking.resources force row level security;
create policy resources_isolation on booking.resources
    using (store_id in (select platform.current_user_store_ids()));

alter table booking.bookings enable row level security;
alter table booking.bookings force row level security;
create policy bookings_isolation on booking.bookings
    using (store_id in (select platform.current_user_store_ids()));

alter table booking.booking_rules enable row level security;
alter table booking.booking_rules force row level security;
create policy booking_rules_isolation on booking.booking_rules
    using (store_id in (select platform.current_user_store_ids()));

-- pos.*
alter table pos.registers enable row level security;
alter table pos.registers force row level security;
create policy registers_isolation on pos.registers
    using (store_id in (select platform.current_user_store_ids()));

alter table pos.pos_transactions enable row level security;
alter table pos.pos_transactions force row level security;
create policy pos_transactions_isolation on pos.pos_transactions
    using (store_id in (select platform.current_user_store_ids()));

-- accounting.* (extra permission check: only Accountant/Owner/Administrator can write)
alter table accounting.accounts enable row level security;
alter table accounting.accounts force row level security;
create policy accounts_isolation on accounting.accounts
    using (store_id in (select platform.current_user_store_ids()));

alter table accounting.journal_entries enable row level security;
alter table accounting.journal_entries force row level security;
create policy journal_entries_isolation on accounting.journal_entries
    using (store_id in (select platform.current_user_store_ids()))
    with check (
        store_id in (select platform.current_user_store_ids())
        and platform.has_permission(store_id, 'accounting.write')
    );

alter table accounting.expenses enable row level security;
alter table accounting.expenses force row level security;
create policy expenses_isolation on accounting.expenses
    using (store_id in (select platform.current_user_store_ids()));

-- crm.*
alter table crm.customers enable row level security;
alter table crm.customers force row level security;
create policy customers_isolation on crm.customers
    using (store_id in (select platform.current_user_store_ids()));

-- logistics.*
alter table logistics.fulfillments enable row level security;
alter table logistics.fulfillments force row level security;
create policy fulfillments_isolation on logistics.fulfillments
    using (store_id in (select platform.current_user_store_ids()));

alter table logistics.vehicles enable row level security;
alter table logistics.vehicles force row level security;
create policy vehicles_isolation on logistics.vehicles
    using (store_id in (select platform.current_user_store_ids()));

-- integrations.* (isolated by store_id, but installation-level credentials
-- are never selectable directly by end users — only by the trusted server role)
alter table integrations.installations enable row level security;
alter table integrations.installations force row level security;
create policy installations_isolation on integrations.installations
    using (store_id in (select platform.current_user_store_ids()));

alter table integrations.webhooks enable row level security;
alter table integrations.webhooks force row level security;
create policy webhooks_isolation on integrations.webhooks
    using (store_id in (select platform.current_user_store_ids()));

alter table integrations.credentials enable row level security;
alter table integrations.credentials force row level security;
-- No policy created => default-deny for all roles except a bypassrls server role.
-- Credentials must only ever be read by the backend service role.

-- notifications.*
alter table notifications.preferences enable row level security;
alter table notifications.preferences force row level security;
create policy notification_preferences_isolation on notifications.preferences
    using (store_id in (select platform.current_user_store_ids()));

alter table notifications.deliveries enable row level security;
alter table notifications.deliveries force row level security;
create policy notification_deliveries_isolation on notifications.deliveries
    using (store_id in (select platform.current_user_store_ids()));

-- =====================================================================
-- Branch-scoped example (POS registers restricted to the employee's branch
-- unless the membership row has branch_id IS NULL = "all branches")
-- =====================================================================
drop policy if exists registers_isolation on pos.registers;
create policy registers_isolation on pos.registers
    using (
        store_id in (select platform.current_user_store_ids())
        and (
            branch_id in (
                select branch_id from platform.memberships
                where user_id = auth.uid() and branch_id is not null
            )
            or exists (
                select 1 from platform.memberships
                where user_id = auth.uid()
                  and store_id = pos.registers.store_id
                  and branch_id is null -- unrestricted membership = all branches
            )
        )
    );
