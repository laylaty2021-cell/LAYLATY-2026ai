import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { withUserContext, requirePermission } from "../../db.js";
import { fromPgError } from "../../errors.js";

const createProductSchema = z.object({
  type: z.enum(["product", "service", "package"]),
  name: z.string().min(1),
  category_id: z.string().uuid().optional(),
});

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9؀-ۿ]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base || "product"}-${Math.random().toString(36).slice(2, 8)}`;
}

export async function productRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/stores/:store_id/products", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const body = createProductSchema.parse(req.body);

    const product = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "catalog.write");
      try {
        const result = await client.query(
          `insert into catalog.products (store_id, category_id, type, name, slug, status)
           values ($1, $2, $3, $4, $5, 'active')
           returning id, store_id, category_id, type, name, slug, status`,
          [storeId, body.category_id ?? null, body.type, body.name, slugify(body.name)],
        );
        return result.rows[0];
      } catch (err) {
        throw fromPgError(err);
      }
    });

    reply.code(201).send(product);
  });

  app.get("/v1/stores/:store_id/products", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const { type } = req.query as { type?: string };

    const products = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "catalog.read");
      const result = await client.query(
        `select id, store_id, category_id, type, name, slug, status, created_at
         from catalog.products
         where store_id = $1 and ($2::text is null or type = $2)
         order by created_at desc`,
        [storeId, type ?? null],
      );
      return result.rows;
    });

    reply.send({ data: products });
  });
}
