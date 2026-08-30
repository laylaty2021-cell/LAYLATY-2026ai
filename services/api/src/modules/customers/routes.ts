import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { withUserContext, requirePermission } from "../../db.js";

const createCustomerSchema = z.object({
  full_name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().optional(),
});

export async function customerRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/stores/:store_id/customers", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const body = createCustomerSchema.parse(req.body);

    const customer = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "crm.write");
      const result = await client.query(
        `insert into crm.customers (store_id, full_name, email, phone)
         values ($1, $2, $3, $4)
         returning id, store_id, full_name, email, phone`,
        [storeId, body.full_name, body.email ?? null, body.phone ?? null],
      );
      return result.rows[0];
    });

    reply.code(201).send(customer);
  });

  app.get("/v1/stores/:store_id/customers", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };

    const customers = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "crm.read");
      const result = await client.query(
        `select id, store_id, full_name, email, phone, created_at
         from crm.customers where store_id = $1 order by created_at desc`,
        [storeId],
      );
      return result.rows;
    });

    reply.send({ data: customers });
  });
}
