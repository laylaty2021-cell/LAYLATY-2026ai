-- =====================================================================
-- Self-hosted equivalent of Supabase's auth.uid().
--
-- Run this ONLY when deploying on a self-managed PostgreSQL instance
-- WITHOUT Supabase (which already provides its own auth.uid() via GoTrue).
-- Do NOT run this file against a Supabase-managed database — it would
-- override the platform's own implementation.
--
-- The application (services/api) sets `request.jwt.claim.sub` as a
-- transaction-local setting for every authenticated request, via
-- `select set_config('request.jwt.claim.sub', $1, true)` right after
-- BEGIN and before any tenant query — see services/api/src/db.ts
-- (withUserContext). RLS policies in db/rls_policies.sql then resolve
-- the current user through this function exactly as they would on
-- Supabase.
-- =====================================================================

create or replace function auth.uid() returns uuid
language sql
stable
as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
