import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { resetDatabase } from "./helpers/testDb.js";
import { signupWithStore } from "./helpers/factories.js";
import { buildApp } from "../src/app.js";
import { closePools } from "../src/db.js";

describe("payment idempotency (docs/blueprint/08-payment-adapter.md, section 4)", () => {
  let app: FastifyInstance;
  let accessToken: string;
  let storeId: string;
  let orderId: string;

  beforeAll(async () => {
    resetDatabase();
    app = buildApp();
    const context = await signupWithStore(app, "payer");
    accessToken = context.accessToken;
    storeId = context.store.id;

    const order = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/orders`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { items: [{ item_type: "variant", item_id: randomUUID(), quantity: 1, unit_price: 500 }] },
    });
    orderId = order.json().id;
  });

  afterAll(async () => {
    await closePools();
  });

  it("returns the same payment for a repeated Idempotency-Key + same payload, without double charging", async () => {
    const key = randomUUID();
    const payload = { order_id: orderId, amount: 500, currency: "SAR", provider: "mock" };

    const first = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/payments`,
      headers: { authorization: `Bearer ${accessToken}`, "idempotency-key": key },
      payload,
    });
    expect(first.statusCode).toBe(201);
    const firstPayment = first.json();
    expect(firstPayment.status).toBe("CAPTURED");

    const second = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/payments`,
      headers: { authorization: `Bearer ${accessToken}`, "idempotency-key": key },
      payload,
    });
    expect(second.statusCode).toBe(200); // replay, not a new resource
    expect(second.json().id).toBe(firstPayment.id);

    const order = await app.inject({
      method: "GET",
      url: `/v1/stores/${storeId}/orders/${orderId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(order.json().status).toBe("PAID");

    // The order is no longer PENDING_PAYMENT, so a second real payment
    // attempt (different key) against it must be rejected outright.
    const thirdAttempt = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/payments`,
      headers: { authorization: `Bearer ${accessToken}`, "idempotency-key": randomUUID() },
      payload,
    });
    expect(thirdAttempt.statusCode).toBe(409);
    expect(thirdAttempt.json().error.code).toBe("ORDER_NOT_PAYABLE");
  });

  it("rejects a reused Idempotency-Key with a different amount", async () => {
    const order = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/orders`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { items: [{ item_type: "variant", item_id: randomUUID(), quantity: 1, unit_price: 200 }] },
    });
    const freshOrderId = order.json().id;
    const key = randomUUID();

    const first = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/payments`,
      headers: { authorization: `Bearer ${accessToken}`, "idempotency-key": key },
      payload: { order_id: freshOrderId, amount: 200, currency: "SAR", provider: "mock" },
    });
    expect(first.statusCode).toBe(201);

    const conflicting = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/payments`,
      headers: { authorization: `Bearer ${accessToken}`, "idempotency-key": key },
      payload: { order_id: freshOrderId, amount: 999, currency: "SAR", provider: "mock" },
    });
    expect(conflicting.statusCode).toBe(422);
    expect(conflicting.json().error.code).toBe("IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_PAYLOAD");
  });

  it("requires the Idempotency-Key header", async () => {
    const response = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/payments`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { order_id: orderId, amount: 500, currency: "SAR", provider: "mock" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("IDEMPOTENCY_KEY_REQUIRED");
  });
});
