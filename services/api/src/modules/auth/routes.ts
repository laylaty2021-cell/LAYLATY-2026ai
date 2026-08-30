import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { withServiceContext } from "../../db.js";
import { hashPassword, verifyPassword } from "../../auth/hash.js";
import { signAccessToken } from "../../auth/jwt.js";
import { ApiError } from "../../errors.js";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

// auth.users has no RLS (it is platform-wide, not tenant-scoped — see
// docs/blueprint/15-multi-tenant-security.md), but signup/login still run
// via the service pool since there is no authenticated user yet to bind a
// tenant-scoped transaction to.
export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post("/v1/auth/signup", async (req, reply) => {
    const body = signupSchema.parse(req.body);
    const passwordHash = await hashPassword(body.password);

    const user = await withServiceContext(async (client) => {
      const existing = await client.query("select id from auth.users where email = $1", [body.email]);
      if ((existing.rowCount ?? 0) > 0) {
        throw new ApiError(409, "EMAIL_ALREADY_REGISTERED", "Email already registered");
      }
      const result = await client.query<{ id: string; email: string; full_name: string }>(
        `insert into auth.users (email, password_hash, full_name)
         values ($1, $2, $3)
         returning id, email, full_name`,
        [body.email, passwordHash, body.full_name],
      );
      return result.rows[0];
    });

    const accessToken = signAccessToken(user.id);
    reply.code(201).send({ user, access_token: accessToken });
  });

  app.post("/v1/auth/login", async (req, reply) => {
    const body = loginSchema.parse(req.body);

    const user = await withServiceContext(async (client) => {
      const result = await client.query<{
        id: string;
        email: string;
        full_name: string;
        password_hash: string;
      }>("select id, email, full_name, password_hash from auth.users where email = $1 and status = 'active'", [
        body.email,
      ]);
      return result.rows[0];
    });

    if (!user || !(await verifyPassword(body.password, user.password_hash))) {
      throw new ApiError(401, "INVALID_CREDENTIALS", "Invalid email or password");
    }

    const accessToken = signAccessToken(user.id);
    reply.send({
      user: { id: user.id, email: user.email, full_name: user.full_name },
      access_token: accessToken,
    });
  });
}
