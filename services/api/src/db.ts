import pg from "pg";
import { config } from "./config.js";

// Return SQL `date` columns (oid 1082) as plain 'YYYY-MM-DD' strings
// instead of node-postgres's default JS Date (which is timezone-sensitive
// and easy to mis-serialize, e.g. by string-interpolating it directly).
// Affects booking.availability.specific_date, sales.invoices.issue_date, etc.
pg.types.setTypeParser(1082, (value: string) => value);

// RLS-protected pool — connects as `laylaty_app` (NOSUPERUSER, NOBYPASSRLS).
// Every tenant-scoped query in the app must go through withUserContext()
// on this pool so that db/rls_policies.sql actually applies.
export const appPool = new pg.Pool({ connectionString: config.databaseUrl });

// Service pool — connects as `laylaty_service` (BYPASSRLS). Reserved for
// trusted bootstrap operations (store creation) per
// docs/blueprint/15-multi-tenant-security.md, section 2.
export const servicePool = new pg.Pool({ connectionString: config.serviceDatabaseUrl });

/**
 * Runs `fn` inside a transaction on the RLS-protected pool, with
 * `request.jwt.claim.sub` set to `userId` for the duration of the
 * transaction. `auth.uid()` (native on Supabase, or the shim in
 * db/auth_uid_selfhosted.sql for self-hosted deployments) reads this
 * setting, which is what every RLS policy in db/rls_policies.sql keys off.
 */
export async function withUserContext<T>(
  userId: string,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await appPool.connect();
  try {
    await client.query("BEGIN");
    await client.query("select set_config('request.jwt.claim.sub', $1, true)", [userId]);
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Runs `fn` inside a transaction on the BYPASSRLS service pool. */
export async function withServiceContext<T>(fn: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await servicePool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/** Checks a permission via platform.has_permission(); throws 403 if absent. */
export async function requirePermission(
  client: pg.PoolClient,
  storeId: string,
  permissionCode: string,
): Promise<void> {
  const result = await client.query<{ has_permission: boolean }>(
    "select platform.has_permission($1, $2) as has_permission",
    [storeId, permissionCode],
  );
  if (!result.rows[0]?.has_permission) {
    const { forbidden } = await import("./errors.js");
    throw forbidden(`Missing required permission: ${permissionCode}`);
  }
}

export async function closePools(): Promise<void> {
  await Promise.all([appPool.end(), servicePool.end()]);
}
