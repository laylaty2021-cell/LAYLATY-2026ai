import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { withUserContext, requirePermission } from "../../db.js";
import { ApiError } from "../../errors.js";
import { MockPaymentProvider } from "./provider.js";

const createPaymentSchema = z.object({
  order_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default("SAR"),
  provider: z.string().default("mock"),
});

const provider = new MockPaymentProvider();

/**
 * Idempotent payment creation, implementing
 * docs/blueprint/08-payment-adapter.md, section 4: the `Idempotency-Key`
 * header maps 1:1 to `sales.payments.idempotency_key` (a UNIQUE column —
 * see db/schema.sql). A repeated key with the same order_id/amount returns
 * the original payment without calling the provider a second time; a
 * repeated key with a different order_id/amount is rejected (422) rather
 * than silently processed against the wrong payload.
 */
export async function paymentRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/stores/:store_id/payments", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const idempotencyKey = req.headers["idempotency-key"];
    if (typeof idempotencyKey !== "string" || idempotencyKey.length === 0) {
      throw new ApiError(400, "IDEMPOTENCY_KEY_REQUIRED", "Idempotency-Key header is required");
    }
    const body = createPaymentSchema.parse(req.body);

    const { payment, isNew } = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "payments.create");

      const assertSamePayload = (existingPayment: { order_id: string; amount: string | number }) => {
        if (existingPayment.order_id !== body.order_id || Number(existingPayment.amount) !== body.amount) {
          throw new ApiError(
            422,
            "IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD",
            "This Idempotency-Key was already used with a different order_id/amount",
          );
        }
      };

      // Idempotency replay check comes FIRST, before validating the
      // order's current status: by the time a client retries with the
      // same key, the first attempt may have already moved the order to
      // PAID, and that must not turn a legitimate replay into a 409.
      const existingByKey = await client.query(
        `select id, store_id, order_id, provider, status, amount, currency, idempotency_key
         from sales.payments where idempotency_key = $1`,
        [idempotencyKey],
      );
      if ((existingByKey.rowCount ?? 0) > 0) {
        const existingPayment = existingByKey.rows[0];
        assertSamePayload(existingPayment);
        return { payment: existingPayment, isNew: false };
      }

      const order = await client.query("select id, status from sales.orders where id = $1 and store_id = $2", [
        body.order_id,
        storeId,
      ]);
      if (order.rowCount === 0) {
        throw new ApiError(404, "ORDER_NOT_FOUND", "Order not found");
      }
      if (order.rows[0].status !== "PENDING_PAYMENT") {
        throw new ApiError(409, "ORDER_NOT_PAYABLE", "Order status does not allow payment", {
          current_status: order.rows[0].status,
        });
      }

      let inserted;
      try {
        inserted = await client.query(
          `insert into sales.payments (store_id, order_id, provider, status, amount, currency, idempotency_key)
           values ($1, $2, $3, 'INITIATED', $4, $5, $6)
           returning id, store_id, order_id, provider, status, amount, currency, idempotency_key`,
          [storeId, body.order_id, body.provider, body.amount, body.currency, idempotencyKey],
        );
      } catch (err) {
        const pgErr = err as { code?: string };
        if (pgErr.code !== "23505") throw err;

        // Lost the race: another concurrent request with the same key
        // inserted first between our SELECT and this INSERT.
        const existing = await client.query(
          `select id, store_id, order_id, provider, status, amount, currency, idempotency_key
           from sales.payments where idempotency_key = $1`,
          [idempotencyKey],
        );
        const existingPayment = existing.rows[0];
        assertSamePayload(existingPayment);
        return { payment: existingPayment, isNew: false };
      }

      const newPayment = inserted.rows[0];
      const result = await provider.createPayment({ amount: body.amount, currency: body.currency });

      const updated = await client.query(
        `update sales.payments set status = $1, external_reference = $2 where id = $3
         returning id, store_id, order_id, provider, status, amount, currency, idempotency_key`,
        [result.status, result.externalReference, newPayment.id],
      );

      if (result.status === "CAPTURED") {
        await client.query("update sales.orders set status = 'PAID', updated_at = now() where id = $1", [
          body.order_id,
        ]);
      }

      return { payment: updated.rows[0], isNew: true };
    });

    reply.code(isNew ? 201 : 200).send(payment);
  });
}
