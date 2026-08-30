import Fastify, { type FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { ApiError } from "./errors.js";
import { authRoutes } from "./modules/auth/routes.js";
import { storeRoutes } from "./modules/stores/routes.js";
import { productRoutes } from "./modules/products/routes.js";
import { customerRoutes } from "./modules/customers/routes.js";
import { bookingRoutes } from "./modules/bookings/routes.js";
import { orderRoutes } from "./modules/orders/routes.js";
import { paymentRoutes } from "./modules/payments/routes.js";

export function buildApp(): FastifyInstance {
  const app = Fastify({ logger: false });

  app.get("/health", async () => ({ status: "ok" }));

  app.register(authRoutes);
  app.register(storeRoutes);
  app.register(productRoutes);
  app.register(customerRoutes);
  app.register(bookingRoutes);
  app.register(orderRoutes);
  app.register(paymentRoutes);

  // Standard error envelope from docs/blueprint/05-rest-api.md, section 1.
  app.setErrorHandler((err, _req, reply) => {
    if (err instanceof ApiError) {
      reply.status(err.status).send({ error: { code: err.code, message: err.message, details: err.details } });
      return;
    }
    if (err instanceof ZodError) {
      reply.status(400).send({
        error: { code: "VALIDATION_ERROR", message: "Request validation failed", details: err.issues },
      });
      return;
    }
    // eslint-disable-next-line no-console
    console.error(err);
    reply.status(500).send({ error: { code: "INTERNAL_ERROR", message: "Unexpected error" } });
  });

  return app;
}
