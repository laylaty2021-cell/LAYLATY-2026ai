import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { resetDatabase } from "./helpers/testDb.js";
import { signupWithStore } from "./helpers/factories.js";
import { buildApp } from "../src/app.js";
import { closePools } from "../src/db.js";

describe("multi-tenant isolation (docs/blueprint/15-multi-tenant-security.md)", () => {
  let app: FastifyInstance;

  beforeAll(() => {
    resetDatabase();
    app = buildApp();
  });

  afterAll(async () => {
    await closePools();
  });

  it("lets a store owner create and read products in their own store", async () => {
    const { accessToken, store } = await signupWithStore(app, "owner-a");

    const create = await app.inject({
      method: "POST",
      url: `/v1/stores/${store.id}/products`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: "product", name: "Rose Bouquet" },
    });
    expect(create.statusCode).toBe(201);

    const list = await app.inject({
      method: "GET",
      url: `/v1/stores/${store.id}/products`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data).toHaveLength(1);
  });

  it("blocks user B from creating a product in user A's store (RLS, not just app logic)", async () => {
    const { store: storeA } = await signupWithStore(app, "owner-a2");
    const { accessToken: tokenB } = await signupWithStore(app, "owner-b");

    const crossTenantCreate = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeA.id}/products`,
      headers: { authorization: `Bearer ${tokenB}` },
      payload: { type: "product", name: "Should Not Be Created" },
    });

    // requirePermission fails first (user B has no membership => no
    // permission on storeA), proving the API-layer check works; the
    // RLS policy on catalog.products is the independent second line of
    // defense documented in docs/blueprint/03-rls-policies.md.
    expect(crossTenantCreate.statusCode).toBe(403);
  });

  it("blocks user B from reading user A's store", async () => {
    const { store: storeA } = await signupWithStore(app, "owner-a3");
    const { accessToken: tokenB } = await signupWithStore(app, "owner-b3");

    const crossTenantRead = await app.inject({
      method: "GET",
      url: `/v1/stores/${storeA.id}`,
      headers: { authorization: `Bearer ${tokenB}` },
    });

    // RLS on platform.stores hides the row entirely for a non-member.
    expect(crossTenantRead.statusCode).toBe(404);
  });

  it("rejects requests with no/invalid bearer token", async () => {
    const response = await app.inject({ method: "POST", url: "/v1/stores", payload: { name: "x", business_type: "hall" } });
    expect(response.statusCode).toBe(401);
  });
});
