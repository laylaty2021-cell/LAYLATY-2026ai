import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { resetDatabase } from "./helpers/testDb.js";
import { signupWithStore } from "./helpers/factories.js";
import { buildApp } from "../src/app.js";
import { closePools } from "../src/db.js";

describe("booking double-booking prevention (docs/blueprint/11-booking-engine.md, section 4)", () => {
  let app: FastifyInstance;
  let accessToken: string;
  let storeId: string;
  let resourceId: string;

  beforeAll(async () => {
    resetDatabase();
    app = buildApp();
    const context = await signupWithStore(app, "hall-owner");
    accessToken = context.accessToken;
    storeId = context.store.id;

    const resource = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/resources`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { type: "hall", name: "Main Hall", capacity: 300 },
    });
    resourceId = resource.json().id;

    await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/resources/${resourceId}/availability`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { specific_date: "2026-10-20", start_time: "08:00", end_time: "23:00" },
    });
  });

  afterAll(async () => {
    await closePools();
  });

  it("creates a booking and computes remaining availability around it", async () => {
    const booking = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/bookings`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { resource_id: resourceId, start_at: "2026-10-20T18:00:00Z", end_at: "2026-10-21T00:00:00Z" },
    });
    expect(booking.statusCode).toBe(201);

    const availability = await app.inject({
      method: "GET",
      url: `/v1/stores/${storeId}/resources/${resourceId}/availability?from=2026-10-20&to=2026-10-20`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(availability.statusCode).toBe(200);
    const slots = availability.json();
    // 08:00-23:00 minus the 18:00-23:00 (clamped) booking leaves 08:00-18:00 free.
    expect(slots).toHaveLength(1);
    expect(slots[0].start_at).toBe("2026-10-20T08:00:00.000Z");
    expect(slots[0].end_at).toBe("2026-10-20T18:00:00.000Z");
  });

  it("rejects an overlapping booking on the same resource with 409", async () => {
    const overlapping = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/bookings`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { resource_id: resourceId, start_at: "2026-10-20T20:00:00Z", end_at: "2026-10-21T02:00:00Z" },
    });
    expect(overlapping.statusCode).toBe(409);
    expect(overlapping.json().error.code).toBe("RESOURCE_NOT_AVAILABLE");
  });

  it("allows a new booking on the freed slot after the original is cancelled", async () => {
    const first = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/bookings`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { resource_id: resourceId, start_at: "2026-10-22T10:00:00Z", end_at: "2026-10-22T12:00:00Z" },
    });
    expect(first.statusCode).toBe(201);
    const bookingId = first.json().id;

    const cancel = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/bookings/${bookingId}/cancel`,
      headers: { authorization: `Bearer ${accessToken}` },
    });
    expect(cancel.statusCode).toBe(200);

    const rebooked = await app.inject({
      method: "POST",
      url: `/v1/stores/${storeId}/bookings`,
      headers: { authorization: `Bearer ${accessToken}` },
      payload: { resource_id: resourceId, start_at: "2026-10-22T10:00:00Z", end_at: "2026-10-22T12:00:00Z" },
    });
    expect(rebooked.statusCode).toBe(201);
  });
});
