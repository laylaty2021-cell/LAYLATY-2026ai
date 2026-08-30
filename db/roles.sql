-- =====================================================================
-- Application database roles.
--
-- laylaty_app     — used by services/api for all tenant-scoped request
--                    handling. NOSUPERUSER, NOBYPASSRLS: fully subject to
--                    the policies in db/rls_policies.sql.
-- laylaty_service — used only for trusted system/bootstrap operations
--                    (creating a new store + its owner membership,
--                    migrations, webhook delivery bookkeeping, audit
--                    logging, reading integrations.credentials).
--                    BYPASSRLS by design — see docs/blueprint/15
--                    (Multi-tenant Security Model, section 2). Never
--                    exposed to end-user-scoped request handling.
--
-- Run this AFTER schema.sql (tables must exist before granting on them)
-- and it is safe to run again (idempotent).
-- =====================================================================

do $$
begin
    if not exists (select 1 from pg_roles where rolname = 'laylaty_app') then
        create role laylaty_app with login password 'laylaty_app_password' nosuperuser nobypassrls;
    end if;
    if not exists (select 1 from pg_roles where rolname = 'laylaty_service') then
        create role laylaty_service with login password 'laylaty_service_password' nosuperuser bypassrls;
    end if;
end
$$;

grant usage on schema
    auth, platform, catalog, sales, inventory, booking, pos,
    accounting, crm, logistics, integrations, notifications
to laylaty_app, laylaty_service;

grant select, insert, update, delete on all tables in schema
    auth, platform, catalog, sales, inventory, booking, pos,
    accounting, crm, logistics, integrations, notifications
to laylaty_app, laylaty_service;

grant execute on all functions in schema platform, auth to laylaty_app, laylaty_service;

alter default privileges in schema
    auth, platform, catalog, sales, inventory, booking, pos,
    accounting, crm, logistics, integrations, notifications
grant select, insert, update, delete on tables to laylaty_app, laylaty_service;
