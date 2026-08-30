import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { withUserContext, requirePermission } from "../../db.js";
import { notFound } from "../../errors.js";

const createWarehouseSchema = z.object({
  name: z.string().min(1),
  branch_id: z.string().uuid().optional(),
});

const setStockSchema = z.object({
  warehouse_id: z.string().uuid(),
  variant_id: z.string().uuid(),
  quantity: z.number().nonnegative(),
});

export async function inventoryRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/stores/:store_id/warehouses", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const body = createWarehouseSchema.parse(req.body);

    const warehouse = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "inventory.adjust");
      const result = await client.query(
        `insert into inventory.warehouses (store_id, branch_id, name)
         values ($1, $2, $3)
         returning id, store_id, branch_id, name`,
        [storeId, body.branch_id ?? null, body.name],
      );
      return result.rows[0];
    });

    reply.code(201).send(warehouse);
  });

  // Sets/tops up on-hand stock for a variant in a warehouse and records the
  // adjustment as a PURCHASE movement — per
  // docs/blueprint/12-inventory-engine.md, section 1 ("لا تعديل مباشر على
  // الرصيد... بل نسجل حركة").
  app.post("/v1/stores/:store_id/inventory/stock", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const body = setStockSchema.parse(req.body);

    const stock = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "inventory.adjust");

      const warehouse = await client.query("select id from inventory.warehouses where id = $1 and store_id = $2", [
        body.warehouse_id,
        storeId,
      ]);
      if (warehouse.rowCount === 0) throw notFound("warehouse");

      const result = await client.query(
        `insert into inventory.stock (warehouse_id, variant_id, available_qty, reserved_qty)
         values ($1, $2, $3, 0)
         on conflict (warehouse_id, variant_id)
         do update set available_qty = inventory.stock.available_qty + excluded.available_qty
         returning warehouse_id, variant_id, available_qty, reserved_qty`,
        [body.warehouse_id, body.variant_id, body.quantity],
      );

      await client.query(
        `insert into inventory.stock_movements (store_id, warehouse_id, variant_id, type, quantity, reference_type)
         values ($1, $2, $3, 'PURCHASE', $4, 'manual_adjustment')`,
        [storeId, body.warehouse_id, body.variant_id, body.quantity],
      );

      return result.rows[0];
    });

    reply.code(201).send(stock);
  });

  app.get("/v1/stores/:store_id/inventory/stock", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const { variant_id: variantId } = req.query as { variant_id?: string };

    const stock = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "inventory.read");
      const result = await client.query(
        `select s.warehouse_id, s.variant_id, s.available_qty, s.reserved_qty,
                (s.available_qty - s.reserved_qty) as available_to_sell
         from inventory.stock s
         join inventory.warehouses w on w.id = s.warehouse_id
         where w.store_id = $1 and ($2::uuid is null or s.variant_id = $2)`,
        [storeId, variantId ?? null],
      );
      return result.rows;
    });

    reply.send({ data: stock });
  });
}
