import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { authenticate } from "../../middleware/authenticate.js";
import { withUserContext, requirePermission } from "../../db.js";
import { notFound, fromPgError } from "../../errors.js";
import { subtractRanges } from "./availability.js";

const createResourceSchema = z.object({
  type: z.enum(["hall", "vehicle", "photographer", "makeup_artist", "room", "equipment", "staff"]),
  name: z.string().min(1),
  capacity: z.number().int().positive().optional(),
});

// MVP simplification: specific-date availability windows only. Recurring
// day_of_week rules (also supported by db/schema.sql) are deferred to V1
// per docs/blueprint/20-roadmap-mvp-v1-v2.md.
const createAvailabilitySchema = z.object({
  specific_date: z.string().date(),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

const createBookingSchema = z.object({
  resource_id: z.string().uuid(),
  customer_id: z.string().uuid().optional(),
  start_at: z.string().datetime(),
  end_at: z.string().datetime(),
});

export async function bookingRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/stores/:store_id/resources", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const body = createResourceSchema.parse(req.body);

    const resource = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "resources.manage");
      const result = await client.query(
        `insert into booking.resources (store_id, type, name, capacity)
         values ($1, $2, $3, $4)
         returning id, store_id, type, name, capacity`,
        [storeId, body.type, body.name, body.capacity ?? null],
      );
      return result.rows[0];
    });

    reply.code(201).send(resource);
  });

  app.post(
    "/v1/stores/:store_id/resources/:resource_id/availability",
    { preHandler: authenticate },
    async (req, reply) => {
      const { store_id: storeId, resource_id: resourceId } = req.params as {
        store_id: string;
        resource_id: string;
      };
      const body = createAvailabilitySchema.parse(req.body);

      const availability = await withUserContext(req.userId, async (client) => {
        await requirePermission(client, storeId, "resources.manage");
        const resource = await client.query("select id from booking.resources where id = $1 and store_id = $2", [
          resourceId,
          storeId,
        ]);
        if (resource.rowCount === 0) throw notFound("resource");

        const result = await client.query(
          `insert into booking.availability (resource_id, specific_date, start_time, end_time, is_available)
           values ($1, $2, $3, $4, true)
           returning id, resource_id, specific_date, start_time, end_time, is_available`,
          [resourceId, body.specific_date, body.start_time, body.end_time],
        );
        return result.rows[0];
      });

      reply.code(201).send(availability);
    },
  );

  app.get(
    "/v1/stores/:store_id/resources/:resource_id/availability",
    { preHandler: authenticate },
    async (req, reply) => {
      const { store_id: storeId, resource_id: resourceId } = req.params as {
        store_id: string;
        resource_id: string;
      };
      const { from, to } = req.query as { from: string; to: string };

      const slots = await withUserContext(req.userId, async (client) => {
        await requirePermission(client, storeId, "bookings.read");

        const availabilityRows = await client.query<{
          specific_date: string;
          start_time: string;
          end_time: string;
        }>(
          `select specific_date, start_time, end_time
           from booking.availability
           where resource_id = $1 and is_available = true
             and specific_date between $2 and $3`,
          [resourceId, from, to],
        );

        // Upper bound is midnight AFTER `to` (not `to` itself) so a
        // same-day from/to range still covers the full day, not a
        // zero-width instant at midnight.
        const bookedRows = await client.query<{ start_at: Date; end_at: Date }>(
          `select b.start_at, b.end_at
           from booking.booking_items bi
           join booking.bookings b on b.id = bi.booking_id
           where bi.resource_id = $1
             and b.status not in ('CANCELLED', 'EXPIRED')
             and b.start_at < ($3::date + interval '1 day') and b.end_at > $2::timestamptz`,
          [resourceId, from, to],
        );
        const blocks = bookedRows.rows.map((r) => ({ start: new Date(r.start_at), end: new Date(r.end_at) }));

        return availabilityRows.rows.flatMap((row) => {
          const base = {
            start: new Date(`${row.specific_date}T${row.start_time}Z`),
            end: new Date(`${row.specific_date}T${row.end_time}Z`),
          };
          return subtractRanges(base, blocks).map((s) => ({
            start_at: s.start.toISOString(),
            end_at: s.end.toISOString(),
            is_available: true,
          }));
        });
      });

      reply.send(slots);
    },
  );

  app.post("/v1/stores/:store_id/bookings", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId } = req.params as { store_id: string };
    const body = createBookingSchema.parse(req.body);

    const booking = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "bookings.create");
      try {
        const bookingResult = await client.query(
          `insert into booking.bookings (store_id, customer_id, status, start_at, end_at)
           values ($1, $2, 'DRAFT', $3, $4)
           returning id, store_id, customer_id, status, start_at, end_at`,
          [storeId, body.customer_id ?? null, body.start_at, body.end_at],
        );
        const booking = bookingResult.rows[0];

        await client.query(
          `insert into booking.booking_items (booking_id, resource_id, time_range)
           values ($1, $2, tstzrange($3::timestamptz, $4::timestamptz, '[)'))`,
          [booking.id, body.resource_id, body.start_at, body.end_at],
        );

        return booking;
      } catch (err) {
        throw fromPgError(err);
      }
    });

    reply.code(201).send(booking);
  });

  app.post("/v1/stores/:store_id/bookings/:booking_id/hold", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId, booking_id: bookingId } = req.params as { store_id: string; booking_id: string };

    const booking = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "bookings.create");
      const result = await client.query(
        `update booking.bookings set status = 'HOLD'
         where id = $1 and store_id = $2 and status = 'DRAFT'
         returning id, store_id, status, start_at, end_at`,
        [bookingId, storeId],
      );
      return result.rows[0];
    });

    if (!booking) throw notFound("booking");
    reply.send(booking);
  });

  app.post(
    "/v1/stores/:store_id/bookings/:booking_id/confirm",
    { preHandler: authenticate },
    async (req, reply) => {
      const { store_id: storeId, booking_id: bookingId } = req.params as { store_id: string; booking_id: string };

      const booking = await withUserContext(req.userId, async (client) => {
        await requirePermission(client, storeId, "bookings.confirm");
        const result = await client.query(
          `update booking.bookings set status = 'CONFIRMED'
           where id = $1 and store_id = $2 and status in ('HOLD', 'PENDING_PAYMENT')
           returning id, store_id, status, start_at, end_at`,
          [bookingId, storeId],
        );
        return result.rows[0];
      });

      if (!booking) throw notFound("booking");
      reply.send(booking);
    },
  );

  app.post("/v1/stores/:store_id/bookings/:booking_id/cancel", { preHandler: authenticate }, async (req, reply) => {
    const { store_id: storeId, booking_id: bookingId } = req.params as { store_id: string; booking_id: string };

    const booking = await withUserContext(req.userId, async (client) => {
      await requirePermission(client, storeId, "bookings.create");
      const result = await client.query(
        `update booking.bookings set status = 'CANCELLED'
         where id = $1 and store_id = $2 and status not in ('COMPLETED', 'CANCELLED')
         returning id, store_id, status`,
        [bookingId, storeId],
      );
      const booking = result.rows[0];
      if (booking) {
        // Release the held time slot: null out time_range so the
        // exclusion constraint (db/schema.sql) no longer considers it.
        await client.query("update booking.booking_items set time_range = null where booking_id = $1", [
          bookingId,
        ]);
      }
      return booking;
    });

    if (!booking) throw notFound("booking");
    reply.send(booking);
  });
}
