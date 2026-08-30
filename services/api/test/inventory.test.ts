import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { resetDatabase } from "./helpers/testDb.js";
import { signupWithStore } from "./helpers/factories.js";
import { buildApp } from "../src/app.js";
import { closePools } from "../src/db.js";

describe("inventory reservation lifecycle (docs/blueprint/12-inventory-engine.md)", () => {
  let app: FastifyInstance;
  let accessToken: string;
  let storeId: string;
  let warehouseId: string;
  let variantId: string;

  beforeAll(async () => {
    resetDatabase();
    app = buildApp();
    const context = await signupWithStore(app, "florist");
    accessToken = context.accessToken;
    storeId = context.store.id;

    const product = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/products`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: "product", name: "Rose Bouquet" },
    });
    const productId = product.json().id;

    const variant = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/products/${productId}/variants`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { sku: "ROSE-RED-M" },
    });
    variantId = variant.json().id;

    const warehouse = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/warehouses`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { name: "Main Warehouse" },
    });
    warehouseId = warehouse.json().id;

    await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/inventory/stock`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { warehouse_id: warehouseId, variant_id: variantId, quantity: 10 },
    });
  });

  afterAll(async () => {
    await closePools();
  });

  async function getStock() {
    const response = await app.inject({
      method: "GET",
      url: `/v1/stores/${storeId}/inventory/stock?variant_id=${variantId}`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    return response.json().data[0];
  }

  it("reserves stock when an order is created (Available to Sell = available - reserved)", async () => {
    const before = await getStock();
    expect(before).toMatchObject({ available_qty: "10", reserved_qty: "0", available_to_sell: "10" });

    const order = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/orders`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { items: [{ item_type: "variant", item_id: variantId, quantity: 3, unit_price: 50 }] },
    });
    expect(order.statusCode).toBe(201);

    const after = await getStock();
    expect(after).toMatchObject({ available_qty: "10", reserved_qty: "3", available_to_sell: "7" });
  });

  it("rejects an order that exceeds available-to-sell with 409 INSUFFICIENT_STOCK", async () => {
    const order = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/orders`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { items: [{ item_type: "variant", item_id: variantId, quantity: 999, unit_price: 50 }] },
    });
    expect(order.statusCode).toBe(409);
    expect(order.json().error.code).toBe("INSUFFICIENT_STOCK");

    // The failed reservation attempt must not have partially reserved
    // anything (it ran inside the same transaction as order creation).
    const stock = await getStock();
    expect(stock.reserved_qty).toBe("3");
  });

  it("consumes the reservation (decrements available_qty) once payment is captured", async () => {
    const order = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/orders`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { items: [{ item_type: "variant", item_id: variantId, quantity: 2, unit_price: 50 }] },
    });
    const orderId = order.json().id;

    await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/payments`,
      headers: { authorization: `Bearer ${accessToken}`, "idempotency-key": randomUUID() },
      payload: { order_id: orderId, amount: 100, currency: "SAR", provider: "mock" },
    });

    const stock = await getStock();
    // 10 - 3 (still reserved from test 1) - 2 (just consumed) = 5 available;
    // reserved stays at 3 (the earlier order is still PENDING_PAYMENT).
    expect(stock).toMatchObject({ available_qty: "8", reserved_qty: "3", available_to_sell: "5" });
  });

  it("releases the reservation back to available-to-sell when the order is cancelled", async () => {
    const order = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/orders`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { items: [{ item_type: "variant", item_id: variantId, quantity: 1, unit_price: 50 }] },
    });
    const orderId = order.json().id;

    const beforeCancel = await getStock();
    expect(beforeCancel).toMatchObject({ available_qty: "8", reserved_qty: "4" });

    const cancel = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/orders/${orderId}/cancel`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(cancel.statusCode).toBe(200);

    const afterCancel = await getStock();
    expect(afterCancel).toMatchObject({ available_qty: "8", reserved_qty: "3", available_to_sell: "5" });
  });
});
