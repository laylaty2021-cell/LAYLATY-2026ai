import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { withUserContext, requirePermission } from "../../db.js";
import { notFound } from "../../errors.js";
import { reserveStockForOrder, releaseReservationsForOrder } from "../inventory/service.js";

const orderItemSchema = z.object({
  item_type: z.enum(["variant", "service", "package"]),
  item_id: z.string().uuid(),
  quantity: z.number().positive().default(1),
  // MVP simplification: the caller supplies the unit price directly.
  // A pricing engine resolving catalog.prices server-side is out of scope
  // for MVP — see docs/blueprint/20-roadmap-mvp-v1-v2.md.
  unit_price: z.number().nonnegative(),
});

const createOrderSchema = z.object({
  branch_id: z.string().uuid().optional(),
  customer_id: z.string().uuid().optional(),
  items: z.array(orderItemSchema).min(1),
});

export async function orderRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/stores/:store_id/orders", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const body = createOrderSchema.parse(req.body);
    const subtotal = body.items.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);

    const order = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "orders.create");

      const orderResult = await client.query(
        `insert into sales.orders (store_id, branch_id, customer_id, status, subtotal, tax, discount, total)
         values ($1, $2, $3, 'PENDING_PAYMENT', $4, 0, 0, $4)
         returning id, store_id, branch_id, customer_id, status, subtotal, tax, discount, total, currency, created_at`,
        [storeId, body.branch_id ?? null, body.customer_id ?? null, subtotal],
      );
      const order = orderResult.rows[0];

      for (const item of body.items) {
        await client.query(
          `insert into sales.order_items (order_id, item_type, item_id, quantity, unit_price, tax, total)
           values ($1, $2, $3, $4, $5, 0, $6)`,
          [order.id, item.item_type, item.item_id, item.quantity, item.unit_price, item.unit_price * item.quantity],
        );
      }

      // Reserving stock inside the same transaction as the order/items
      // insert means insufficient stock rolls the whole order back — no
      // order is ever left referencing a reservation that failed.
      await reserveStockForOrder(client, storeId, order.id, body.items);

      return order;
    });

    reply.code(201).send(order);
  });

  app.get("/v1/stores/:store_id/orders/:order_id", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId, order_id: orderId } = req.params as { store_id: string; order_id: string };

    const order = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "orders.read");
      const orderResult = await client.query(
        `select id, store_id, branch_id, customer_id, status, subtotal, tax, discount, total, currency, created_at
         from sales.orders where id = $1 and store_id = $2`,
        [orderId, storeId],
      );
      const order = orderResult.rows[0];
      if (!order) return null;

      const items = await client.query(
        `select id, item_type, item_id, quantity, unit_price, tax, total
         from sales.order_items where order_id = $1`,
        [orderId],
      );
      return { ...order, items: items.rows };
    });

    if (!order) throw notFound("order");
    reply.send(order);
  });

  app.get("/v1/stores/:store_id/orders", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const { status } = req.query as { status?: string };

    const orders = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "orders.read");
      const result = await client.query(
        `select id, store_id, branch_id, customer_id, status, subtotal, tax, discount, total, currency, created_at
         from sales.orders
         where store_id = $1 and ($2::text is null or status = $2)
         order by created_at desc`,
        [storeId, status ?? null],
      );
      return result.rows;
    });

    reply.send({ data: orders });
  });

  app.post("/v1/stores/:store_id/orders/:order_id/cancel", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId, order_id: orderId } = req.params as { store_id: string; order_id: string };

    const order = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "orders.cancel");
      const result = await client.query(
        `update sales.orders set status = 'CANCELLED', updated_at = now()
         where id = $1 and store_id = $2 and status in ('DRAFT', 'PENDING_PAYMENT')
         returning id, store_id, status`,
        [orderId, storeId],
      );
      const order = result.rows[0];
      if (order) {
        await releaseReservationsForOrder(client, orderId);
      }
      return order;
    });

    if (!order) throw notFound("order");
    reply.send(order);
  });
}
