import type { FastifyInstance } from "fastify";
import type pg from "pg";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { withServiceContext, withUserContext } from "../../db.js";
import { notFound, fromPgError } from "../../errors.js";
import { DEFAULT_ROLES } from "./defaultRoles.js";

const createStoreSchema = z.object({
  name: z.string().min(1),
  business_type: z.string().min(1),
  currency: z.string().default("SAR"),
  timezone: z.string().default("Asia/Riyadh"),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "store"}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Seeds the standard role/permission set for a brand-new store (per
 * docs/blueprint/04-roles-permissions-matrix.md) and returns a map of
 * role name -> role id.
 */
async function seedDefaultRoles(client: pg.PoolClient, storeId: string): Promise<Record<string, string>> {
  const roleIds: Record<string, string> = {};
  for (const [roleName, permissionCodes] of Object.entries(DEFAULT_ROLES)) {
    const roleResult = await client.query<{ id: string }>(
      `insert into platform.roles (store_id, name, is_system) values ($1, $2, true) returning id`,
      [storeId, roleName],
    );
    const roleId = roleResult.rows[0].id;
    roleIds[roleName] = roleId;

    if (permissionCodes.length > 0) {
      await client.query(
        `insert into platform.role_permissions (role_id, permission_id)
         select $1, id from platform.permissions where code = any($2::text[])`,
        [roleId, permissionCodes],
      );
    }
  }
  return roleIds;
}

export async function storeRoutes(app: FastifyInstance): Promise<void> {
  // Store creation is a bootstrap/tenant-provisioning operation: the caller
  // cannot yet hold a store-scoped permission for a store that doesn't
  // exist, so it runs on the BYPASSRLS service pool rather than
  // withUserContext (see docs/blueprint/15, section 2).
  app.post("/v1/stores", { preHandler: authenticate }, async (req, reply) => {
    const body = createStoreSchema.parse(req.body);

    const store = await withServiceContext(async (client) => {
      const merchant = await client.query<{ id: string }>(
        `insert into platform.merchants (owner_user_id, name) values ($1, $2) returning id`,
        [req.userId, body.name],
      );
      const merchantId = merchant.rows[0].id;

      const storeResult = await client.query(
        `insert into platform.stores (merchant_id, name, slug, business_type, currency, timezone)
         values ($1, $2, $3, $4, $5, $6)
         returning id, merchant_id, name, slug, business_type, currency, timezone, status`,
        [merchantId, body.name, slugify(body.name), body.business_type, body.currency, body.timezone],
      );
      const store = storeResult.rows[0];

      const branch = await client.query<{ id: string }>(
        `insert into platform.branches (store_id, name, is_default) values ($1, $2, true) returning id`,
        [store.id, "الفرع الرئيسي"],
      );

      const roleIds = await seedDefaultRoles(client, store.id);

      await client.query(
        `insert into platform.memberships (user_id, store_id, branch_id, role_id, status)
         values ($1, $2, $3, $4, 'active')`,
        [req.userId, store.id, null, roleIds.Owner],
      );

      await client.query(
        `insert into platform.audit_logs (store_id, user_id, action, entity_type, entity_id, after)
         values ($1, $2, 'store.created', 'store', $3, $4::jsonb)`,
        [store.id, req.userId, store.id, JSON.stringify(store)],
      );

      return { ...store, default_branch_id: branch.rows[0].id };
    });

    reply.code(201).send(store);
  });

  app.get("/v1/stores/:store_id", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };

    const store = await withUserContext(req.userId, async (client) => {
      try {
        const result = await client.query(
          "select id, merchant_id, name, slug, business_type, currency, timezone, status from platform.stores where id = $1",
          [storeId],
        );
        return result.rows[0];
      } catch (err) {
        throw fromPgError(err);
      }
    });

    if (!store) throw notFound("store");
    reply.send(store);
  });
}
